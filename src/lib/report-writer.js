/**
 * 研报写作阶段 —— 把子代理交回、经 Check 核验的证据写成观点驱动的报告。
 *
 * 研究与写作分离（同 Anthropic 多代理研究系统 / LangChain open_deep_research / STORM）：
 *   1. 证据池：汇总本会话子任务的核验结果，统一编号 E1..En，子代理 findings 编号 F1..Fn
 *   2. 综合：独立调用产出论点骨架（BLUF + 核心判断 + 分论点），判断必须挂已核验证据
 *   3. 成文：干净上下文、单一 writer，按骨架写；事实句带 [E#]，判断句明示并给置信度
 *   4. 校验与渲染：确定性 lint（未知引用 / 未核验当事实 / 清单化 / 无核心判断），
 *      不过则修订一次；最后 [E#] 换成顺序编号，附证据附录
 *
 * 判断句不走蕴含核验（它本来就不是原文的复述），但必须写明依据与置信度——
 * 这是给判断开的合法通道，否则模型为了过核验只敢罗列事实。
 */

import { streamChatWithTools } from './ai-client.js';
import { MODALITY_LABEL } from './task-report.js';
import { emitUsage } from './usage.js';

export const USABLE_VERDICTS = new Set(['entailment-pass', 'cross-source-pass', 'notebook-verified']);

export const VERDICT_LABEL = {
  'entailment-pass': '核验通过',
  'cross-source-pass': '多源核验通过',
  overclaim: '过度推断',
  'source-conflict': '与来源矛盾',
  'citation-fail': '引文不符',
  'source-unverified': '未能核验',
  'notebook-verified': '笔记本已核实',
  'notebook-open': '笔记本待核实',
};

export const ESTIMATIVE_TERMS = ['几乎不可能', '很不可能', '不太可能', '约五五开', '较可能', '很可能', '几乎肯定'];

const CONF_LABEL = { high: '高', medium: '中', low: '低' };
const MAX_POOL_ITEMS = 220;
const MIN_USABLE_EVIDENCE = 2;
const SYNTH_MAX_ROUNDS = 3;

export const LENGTH_TARGETS = {
  brief: { label: '1200–2000 字', minChars: 900 },
  standard: { label: '2500–5000 字', minChars: 1800 },
  deep: { label: '5000–9000 字', minChars: 3500 },
};

function normClaimKey(text) {
  return String(text || '').toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, '');
}

function sourceKey(s) {
  return s.doc_id ? `${s.doc_id}#${s.anchor || ''}` : (s.url || s.note || '');
}

function mergeSources(a, b) {
  const seen = new Set(a.map(sourceKey));
  const out = a.slice();
  for (const s of b) {
    const k = sourceKey(s);
    if (k && !seen.has(k)) {
      seen.add(k);
      out.push(s);
    }
  }
  return out;
}

function sourcesFromCheckedClaim(c) {
  const all = Array.isArray(c.evidence) ? c.evidence : [];
  const passed = all.filter((e) => e && e.status === 'citation-pass');
  return (passed.length ? passed : all).map((e) => ({
    doc_id: String(e?.evidence?.doc_id || ''),
    anchor: String(e?.evidence?.anchor || ''),
    quote: String(e?.evidence?.quote || ''),
    url: String(e?.sourceUrl || ''),
  })).filter((s) => s.doc_id || s.url);
}

/**
 * 汇总证据池。sessions 是 ctx.subagentSessions 的值；notes 是笔记本条目（主代理挑选过的）。
 * 返回 { items, findings, usableCount, taskCount }，items 按“可用优先”编号。
 */
export function buildEvidencePool({ sessions = [], notes = [], taskIds = null, maxItems = MAX_POOL_ITEMS } = {}) {
  const wanted = Array.isArray(taskIds) && taskIds.length ? new Set(taskIds.map(String)) : null;
  const raw = [];
  const byKey = new Map();
  const localRefs = new Map();
  const rawFindings = [];
  let taskCount = 0;

  const add = (item, localRef) => {
    const key = normClaimKey(item.claim);
    if (!key) return;
    let target = byKey.get(key);
    if (target) {
      target.sources = mergeSources(target.sources, item.sources);
      if (item.usable && !target.usable) {
        target.usable = true;
        target.verdict = item.verdict;
      }
      target.independentSources = Math.max(target.independentSources, item.independentSources);
      if (!target.attribution && item.attribution) target.attribution = item.attribution;
      if (!target.eventTime && item.eventTime) target.eventTime = item.eventTime;
    } else {
      target = item;
      byKey.set(key, target);
      raw.push(target);
    }
    if (localRef) localRefs.set(localRef, target);
  };

  for (const s of sessions) {
    if (!s || !s.verification || !Array.isArray(s.verification.claims)) continue;
    if (wanted && !wanted.has(String(s.id))) continue;
    taskCount += 1;
    const task = String(s.description || s.type || '');
    for (const c of s.verification.claims) {
      const verdict = String(c.verdict || 'source-unverified');
      add({
        claim: String(c.claim || '').trim(),
        attribution: String(c.attribution || ''),
        modality: String(c.modality || 'reported'),
        eventTime: String(c.eventTime || c.event_time || ''),
        confidence: String(c.confidence || 'medium'),
        verdict,
        usable: USABLE_VERDICTS.has(verdict),
        independentSources: Number(c.independentSources) || 0,
        reason: String(c.reason || ''),
        origin: 'task',
        taskId: String(s.id),
        task,
        sources: sourcesFromCheckedClaim(c),
      }, `${s.id}::${c.id}`);
    }
    for (const f of (s.report && Array.isArray(s.report.findings) ? s.report.findings : [])) {
      rawFindings.push({ ...f, taskId: String(s.id), task });
    }
  }

  for (const n of notes) {
    if (!n || n.supersededBy || n.status === 'refuted' || n.status === 'dropped') continue;
    const verdict = n.status === 'verified' ? 'notebook-verified' : 'notebook-open';
    add({
      claim: String(n.claim || '').trim(),
      attribution: '',
      modality: 'reported',
      eventTime: '',
      confidence: String(n.confidence || 'medium'),
      verdict,
      usable: verdict === 'notebook-verified',
      independentSources: 0,
      reason: '',
      origin: 'notebook',
      taskId: '',
      task: '调研笔记本',
      sources: (n.sources || []).map((src) => ({
        doc_id: String(src.doc_id || ''), anchor: String(src.anchor || ''), quote: '', url: String(src.url || ''), note: String(src.note || ''),
      })),
    });
  }

  const ordered = [...raw.filter((i) => i.usable), ...raw.filter((i) => !i.usable)].slice(0, Math.max(1, maxItems));
  ordered.forEach((item, i) => { item.id = `E${i + 1}`; });
  const kept = new Set(ordered);

  const toIds = (taskId, list) => (Array.isArray(list) ? list : [])
    .map((local) => localRefs.get(`${taskId}::${local}`))
    .filter((item) => item && kept.has(item))
    .map((item) => item.id);
  const findings = rawFindings.map((f, i) => ({
    id: `F${i + 1}`,
    task: f.task,
    question: String(f.question || ''),
    answer: String(f.answer || ''),
    confidence: String(f.confidence || 'medium'),
    supporting: toIds(f.taskId, f.supporting),
    contradicting: toIds(f.taskId, f.contradicting),
  })).filter((f) => f.question && f.answer);

  return {
    items: ordered,
    findings,
    usableCount: ordered.filter((i) => i.usable).length,
    taskCount,
  };
}

function itemMeta(item) {
  const parts = [MODALITY_LABEL[item.modality] || item.modality];
  if (item.attribution) parts.push(item.attribution);
  if (item.eventTime) parts.push(`事件时间 ${item.eventTime}`);
  if (item.independentSources) parts.push(`独立信源 ${item.independentSources}`);
  parts.push(`置信 ${CONF_LABEL[item.confidence] || item.confidence}`);
  return parts.join('｜');
}

function clip(text, n) {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

export function formatPoolForPrompt(pool, { quoteChars = 220 } = {}) {
  const usable = pool.items.filter((i) => i.usable);
  const other = pool.items.filter((i) => !i.usable);
  const line = (item) => {
    const quote = item.sources.find((s) => s.quote);
    const ref = item.sources.map(sourceKey).filter(Boolean).slice(0, 2).join('、');
    return [
      `[${item.id}] ${itemMeta(item)}`,
      `    主张：${item.claim}`,
      quote ? `    引文：「${clip(quote.quote, quoteChars)}」${ref ? `（${ref}）` : ''}` : (ref ? `    出处：${ref}` : ''),
    ].filter(Boolean).join('\n');
  };
  const parts = [`## 可作为事实使用的证据（${usable.length} 条，已通过运行时核验）`, ...usable.map(line)];
  if (other.length) {
    parts.push('', `## 未通过核验 / 待核实（${other.length} 条）——只能在“分歧与不确定性”里提及，并写明“未经核实”`);
    for (const item of other) parts.push(`${line(item)}\n    核验结论：${VERDICT_LABEL[item.verdict] || item.verdict}${item.reason ? `（${clip(item.reason, 80)}）` : ''}`);
  }
  if (pool.findings.length) {
    parts.push('', '## 子代理的初步判断（findings：读过全文的一线判断，可采纳也可推翻，但要说明理由）');
    for (const f of pool.findings) {
      const refs = [
        f.supporting.length ? `支撑 ${f.supporting.join(',')}` : '',
        f.contradicting.length ? `反对 ${f.contradicting.join(',')}` : '',
      ].filter(Boolean).join('；');
      parts.push(`[${f.id}]（${f.task}｜置信 ${CONF_LABEL[f.confidence] || f.confidence}）问：${f.question}\n    答：${f.answer}${refs ? `\n    ${refs}` : ''}`);
    }
  }
  return parts.join('\n');
}

const refArray = (description) => ({ type: 'array', items: { type: 'string' }, description });

export const OUTLINE_TOOL = {
  type: 'function',
  function: {
    name: 'submit_outline',
    description: '提交研报的论点骨架。只有本工具成功才进入写作。',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: '报告标题：点明结论或核心问题，不要只写对象名。' },
        bluf: { type: 'string', description: '一句话回答核心问题（≤150 字）。读者只看这一句也知道结论。' },
        key_judgments: {
          type: 'array',
          minItems: 1,
          maxItems: 6,
          items: {
            type: 'object',
            properties: {
              judgment: { type: 'string', description: '一个判断（不是事实复述）：趋势、原因、影响、比较或预测。' },
              likelihood: { type: 'string', enum: ESTIMATIVE_TERMS, description: '对预测/推断类判断给估计性用语；纯定性判断可省略。' },
              confidence: { type: 'string', enum: ['high', 'medium', 'low'], description: '分析置信度：证据质量、独立信源数、一致性。' },
              basis: refArray('支撑该判断的证据 id（E#），至少一条已核验证据。'),
              counter: refArray('削弱或反对该判断的证据 id。'),
              reasoning: { type: 'string', description: '从证据到判断的推理链，一到三句。' },
            },
            required: ['judgment', 'confidence', 'basis', 'reasoning'],
          },
        },
        sections: {
          type: 'array',
          minItems: 1,
          maxItems: 7,
          items: {
            type: 'object',
            properties: {
              heading: { type: 'string', description: '章节标题，最好本身就是论点。' },
              thesis: { type: 'string', description: '本章主题句：一个判断，正文围绕它论证。' },
              points: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    point: { type: 'string', description: '支撑主题句的分论点。' },
                    basis: refArray('该分论点用到的证据 id。'),
                  },
                  required: ['point', 'basis'],
                },
              },
            },
            required: ['heading', 'thesis', 'points'],
          },
        },
        uncertainties: {
          type: 'array',
          items: {
            type: 'object',
            properties: { issue: { type: 'string' }, basis: refArray('相关证据 id（可含未核验证据）。') },
            required: ['issue'],
          },
        },
        outlook: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              indicator: { type: 'string', description: '接下来值得盯的可观察信号。' },
              implication: { type: 'string', description: '出现该信号说明什么、会如何改变判断。' },
            },
            required: ['indicator', 'implication'],
          },
        },
        gaps: { type: 'array', items: { type: 'string' }, description: '查过但证据不足、影响结论的缺口。' },
      },
      required: ['title', 'bluf', 'key_judgments', 'sections'],
    },
  },
};

const asList = (v) => (Array.isArray(v) ? v : []);
const strIds = (v) => asList(v).map((x) => String(x || '').trim().toUpperCase()).filter(Boolean);

export function validateOutline(raw, pool) {
  if (!raw || typeof raw !== 'object') return { error: '骨架必须是对象。' };
  const byId = new Map(pool.items.map((i) => [i.id, i]));
  const errors = [];
  const checkIds = (ids, where) => {
    const unknown = ids.filter((id) => !byId.has(id));
    if (unknown.length) errors.push(`${where} 引用了不存在的证据：${unknown.join(', ')}`);
  };
  const title = String(raw.title || '').trim();
  const bluf = String(raw.bluf || '').trim();
  if (!title) errors.push('title 不能为空');
  if (!bluf) errors.push('bluf 不能为空');
  const minJudgments = pool.usableCount >= 6 ? 2 : 1;
  const kj = asList(raw.key_judgments).map((k, i) => {
    const basis = strIds(k?.basis);
    const counter = strIds(k?.counter);
    const judgment = String(k?.judgment || '').trim();
    if (!judgment) errors.push(`key_judgments[${i}] 缺 judgment`);
    checkIds(basis, `key_judgments[${i}].basis`);
    checkIds(counter, `key_judgments[${i}].counter`);
    if (!basis.some((id) => byId.get(id)?.usable)) {
      errors.push(`key_judgments[${i}]「${clip(judgment, 30)}」没有任何已核验证据支撑；补 basis 或删掉这条判断`);
    }
    return {
      judgment,
      likelihood: ESTIMATIVE_TERMS.includes(k?.likelihood) ? k.likelihood : '',
      confidence: ['high', 'medium', 'low'].includes(k?.confidence) ? k.confidence : 'medium',
      basis,
      counter,
      reasoning: String(k?.reasoning || '').trim(),
    };
  });
  if (kj.length < minJudgments) errors.push(`key_judgments 至少 ${minJudgments} 条`);
  const sections = asList(raw.sections).map((s, i) => {
    const heading = String(s?.heading || '').trim();
    const thesis = String(s?.thesis || '').trim();
    if (!heading || !thesis) errors.push(`sections[${i}] 需要 heading 和 thesis`);
    const points = asList(s?.points).map((p, j) => {
      const basis = strIds(p?.basis);
      checkIds(basis, `sections[${i}].points[${j}]`);
      return { point: String(p?.point || '').trim(), basis };
    }).filter((p) => p.point);
    return { heading, thesis, points };
  });
  const minSections = pool.usableCount >= 6 ? 2 : 1;
  if (sections.length < minSections) errors.push(`sections 至少 ${minSections} 个`);
  const uncertainties = asList(raw.uncertainties).map((u, i) => {
    const basis = strIds(u?.basis);
    checkIds(basis, `uncertainties[${i}]`);
    return { issue: String(u?.issue || '').trim(), basis };
  }).filter((u) => u.issue);
  const outlook = asList(raw.outlook).map((o) => ({
    indicator: String(o?.indicator || '').trim(),
    implication: String(o?.implication || '').trim(),
  })).filter((o) => o.indicator);
  const gaps = asList(raw.gaps).map((g) => String(g || '').trim()).filter(Boolean);
  if (errors.length) return { error: errors.slice(0, 10).join('；') };
  return { outline: { title, bluf, key_judgments: kj, sections, uncertainties, outlook, gaps } };
}

function briefBlock(args, now) {
  const lines = [`今天：${now.toISOString().slice(0, 10)}`, `核心问题：${String(args.question || '').trim()}`];
  if (args.audience) lines.push(`读者：${String(args.audience).trim()}`);
  if (args.brief) lines.push(`调研简报 / 用户关心的角度：${String(args.brief).trim()}`);
  const hyps = asList(args.hypotheses).map((h) => String(h || '').trim()).filter(Boolean);
  if (hyps.length) lines.push(`待检验假设：\n${hyps.map((h, i) => `H${i + 1}. ${h}`).join('\n')}`);
  if (args.analyst_notes) {
    lines.push(`主代理的背景观察（未经核验，只能帮助理解问题，不能当事实写进正文）：${String(args.analyst_notes).trim()}`);
  }
  return lines.join('\n');
}

const SYNTH_SYSTEM = [
  '你是资深情报/行业分析师，正在为一份研报搭论点骨架。你不写正文，只决定“这份报告要说什么”。',
  '方法：',
  '1. 先回答核心问题，写成 BLUF——读者只看这一句也能拿到结论。',
  '2. 核心判断是分析结论（趋势、原因、影响、比较、预测），不是把证据换个说法。检验：如果一句话可以直接在某篇原文里找到，它是事实不是判断。',
  '3. 每条判断挂 basis（至少一条已核验证据），有反面证据就挂 counter 并在 reasoning 里权衡。预测类判断给 likelihood（估计性用语）。',
  '4. 章节按论点组织，不按来源、子任务或时间顺序堆砌；每章 thesis 是一个判断，points 是支撑它的分论点。',
  '5. 把证据之间的矛盾、单一信源、当事方自说自话（claimed）放进 uncertainties；把决定结论走向的可观察信号放进 outlook。',
  '6. 有待检验假设时，判断里明确它被支持、削弱还是无法判断。',
  '7. 子代理 findings 是一线判断，可以采纳也可以推翻，但推翻要有证据。',
  '完成后调用 submit_outline。',
].join('\n');

export function writingSystemPrompt(length = 'standard') {
  const target = (LENGTH_TARGETS[length] || LENGTH_TARGETS.standard).label;
  return [
    '你是资深情报/行业分析师，按给定论点骨架写一份研报（Markdown）。读者是要据此做决定的人，不是要核对资料的人。',
    '',
    '## 结构（按顺序，标题用中文）',
    '# 标题',
    '> 一段 BLUF：两三句话回答核心问题，含最关键的数字或事实。',
    '## 核心判断',
    '编号列表，每条：**判断句**（可能性：X｜置信度：高/中/低）+ 一两句理由，带 [E#]。',
    '## 各分论点章节（2–6 个，标题本身最好就是论点）',
    '## 分歧与不确定性',
    '## 展望与观察指标',
    '## 信息缺口（没有可省略）',
    '',
    '## 写法',
    '- 每段第一句是判断（主题句），后面用事实论证它；一段整合多条证据，不要一条证据一段。',
    '- 正文以段落为主。列表只用于核心判断、观察指标、信息缺口；分论点章节里不要写成要点清单。',
    '- 事实句必须在句末带证据编号，如 [E3] 或 [E3][E7]，且只能用“可作为事实使用”组里的证据。',
    '- 判断句要让读者看得出是判断：“我们判断”“这意味着”“较可能”等，并说明依据。判断不需要逐字出处，但不能和证据矛盾。',
    '- 当事方声称（声称）、媒体转述（转述）、机构评估（评估）必须保留“X 称 / 据 X 报道 / X 评估”，不得写成既成事实；只有单一信源的要点明。',
    '- 未核验证据只能出现在“分歧与不确定性”，并写明“未经核实”。',
    '- 数字、日期、名称只用证据里出现的，不得补充证据之外的事实。可以基于证据做推理和比较。',
    '- 不要按来源或子任务分章，不要写“根据资料显示”“综上所述”这类空话，不要写参考来源列表（系统会自动附上）。',
    `- 篇幅：${target}。只输出报告 Markdown，不要前言或解释。`,
  ].join('\n');
}

const REFS_RE = /\[\s*(E\d+(?:\s*[,，、;；]\s*E\d+)*)\s*\]/gi;
const ALLOW_UNVERIFIED_HEADING = /不确定|分歧|争议|缺口|未核实|存疑|风险/;
const LIST_OK_HEADING = /核心判断|关键判断|主要判断|观察|指标|缺口|展望|附录|来源/;
const JUDGMENT_MARKER = /我们(判断|认为|评估|预计|倾向)|意味着|表明|说明|反映|可见|因此|由此|很可能|较可能|不太可能|或将|预计|判断|值得注意|关键在于|核心在于|取决于|换言之|这显示/;

export function extractRefs(text) {
  const ids = [];
  for (const m of String(text || '').matchAll(REFS_RE)) {
    for (const id of m[1].split(/[,，、;；]/)) ids.push(id.trim().toUpperCase());
  }
  return ids;
}

/** 确定性检查。major=true 时值得花一次修订。 */
export function lintReport(markdown, pool, { length = 'standard' } = {}) {
  const byId = new Map(pool.items.map((i) => [i.id, i]));
  const lines = String(markdown || '').split('\n');
  let heading = '';
  let listLines = 0;
  let paraLines = 0;
  const unknown = new Set();
  const unverifiedAsFact = new Set();
  const uncited = [];
  let hasKeyJudgments = false;
  let hasUncertainty = false;
  const cited = new Set();
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    const h = line.match(/^#{1,6}\s+(.*)$/);
    if (h) {
      heading = h[1];
      if (/核心判断|关键判断|主要判断/.test(heading)) hasKeyJudgments = true;
      if (/不确定|分歧|争议/.test(heading)) hasUncertainty = true;
      continue;
    }
    const refs = extractRefs(line);
    for (const id of refs) {
      const item = byId.get(id);
      if (!item) unknown.add(id);
      else {
        cited.add(id);
        if (!item.usable && !ALLOW_UNVERIFIED_HEADING.test(heading)) unverifiedAsFact.add(id);
      }
    }
    if (/^(>|\|)/.test(line)) continue;
    const isList = /^([-*+]|\d+[.)、])\s+/.test(line);
    if (LIST_OK_HEADING.test(heading) || !heading) continue;
    if (isList) listLines += 1;
    else {
      paraLines += 1;
      if (line.length >= 80 && !refs.length && !JUDGMENT_MARKER.test(line)) uncited.push(clip(line, 40));
    }
  }
  const chars = String(markdown || '').replace(/\s+/g, '').length;
  const minChars = (LENGTH_TARGETS[length] || LENGTH_TARGETS.standard).minChars;
  const issues = [];
  const major = [];
  const push = (isMajor, message) => { issues.push(message); if (isMajor) major.push(message); };
  if (unknown.size) push(true, `引用了不存在的证据编号：${[...unknown].join(', ')}。只能用证据池里的 E#。`);
  if (unverifiedAsFact.size) push(true, `${[...unverifiedAsFact].join(', ')} 未通过核验，却出现在“分歧与不确定性”以外；移到不确定性章节并写明“未经核实”，或删掉。`);
  if (!hasKeyJudgments) push(true, '缺少“核心判断”章节。');
  if (!hasUncertainty) push(false, '缺少“分歧与不确定性”章节。');
  if (listLines >= 6 && listLines > paraLines) push(true, `分论点章节写成了清单（列表 ${listLines} 行 / 段落 ${paraLines} 段）。改成段落：主题句是判断，后面用证据论证。`);
  if (uncited.length >= 3) push(true, `有 ${uncited.length} 段长文既没有证据编号也看不出是判断（如「${uncited[0]}」）。事实补 [E#]，判断写明“我们判断/这意味着”。`);
  else if (uncited.length) push(false, `有 ${uncited.length} 段未标证据的长段落（如「${uncited[0]}」）。`);
  if (!cited.size) push(true, '全文没有任何证据编号。');
  if (chars < minChars && pool.usableCount >= 8) push(true, `篇幅偏短（${chars} 字），证据池有 ${pool.usableCount} 条已核验证据，论证没有展开。`);
  return { issues, major, stats: { chars, cited: cited.size, listLines, paraLines } };
}

const TRAILING_REFS_HEADING = /^#{1,6}\s*(参考(来源|文献|资料)|引用来源|来源列表|references?|sources?)\s*$/i;

function stripTrailingReferences(markdown) {
  const lines = String(markdown || '').split('\n');
  const idx = lines.findIndex((l) => TRAILING_REFS_HEADING.test(l.trim()));
  return (idx >= 0 ? lines.slice(0, idx) : lines).join('\n').trimEnd();
}

function sourceLine(src, docs) {
  const meta = (src.doc_id && docs.get(src.doc_id)) || {};
  const title = meta.title || src.note || src.url || meta.url || src.doc_id;
  const url = src.url || meta.url || '';
  const anchor = src.doc_id ? `${src.doc_id}${src.anchor ? `#${src.anchor}` : ''}` : '';
  const head = url && /^https?:/i.test(url) ? `[${title}](${url})` : title;
  return [head, anchor && anchor !== title ? `\`${anchor}\`` : ''].filter(Boolean).join(' · ');
}

/**
 * [E#] → 按首次出现顺序编号 [n]，去掉未知引用，附“参考来源与证据”附录。
 * docs: Map<doc_id, { title, url }>
 */
export function renderReport(markdown, pool, { docs = new Map(), taskCount = 0 } = {}) {
  const byId = new Map(pool.items.map((i) => [i.id, i]));
  const order = new Map();
  const body = stripTrailingReferences(markdown).replace(REFS_RE, (_, inner) => {
    const nums = [];
    for (const raw of inner.split(/[,，、;；]/)) {
      const id = raw.trim().toUpperCase();
      if (!byId.has(id)) continue;
      if (!order.has(id)) order.set(id, order.size + 1);
      nums.push(order.get(id));
    }
    return nums.map((n) => `[${n}]`).join('');
  });

  const cited = [...order.keys()].map((id) => byId.get(id));
  const independent = new Set();
  for (const item of cited) for (const s of item.sources) independent.add(s.url || s.doc_id);
  const entries = cited.map((item) => {
    const n = order.get(item.id);
    const meta = [MODALITY_LABEL[item.modality] || item.modality, item.attribution, item.eventTime].filter(Boolean).join('｜');
    const status = [VERDICT_LABEL[item.verdict] || item.verdict, item.independentSources ? `独立信源 ${item.independentSources}` : ''].filter(Boolean).join('｜');
    const quote = item.sources.find((s) => s.quote);
    const srcs = item.sources.slice(0, 3).map((s) => sourceLine(s, docs)).filter(Boolean).join('；');
    return [
      `**[${n}]** ${item.claim}（${meta}；${status}）`,
      srcs ? `来源：${srcs}` : '',
      quote ? `原文：「${clip(quote.quote, 300)}」` : '',
    ].filter(Boolean).join('  \n');
  });
  const method = `本报告基于 ${pool.usableCount} 条运行时核验通过的证据（${taskCount} 个子任务，正文引用 ${cited.length} 条、涉及 ${independent.size} 个来源）撰写。`
    + '“核验通过”表示逐字引文已在来源中定位并经蕴含审查，只说明“来源确实这么说”；判断句是分析结论，置信度见“核心判断”。';
  const appendix = cited.length
    ? `\n\n---\n\n## 参考来源与证据\n\n> ${method}\n\n${entries.join('\n\n')}\n`
    : `\n\n---\n\n> ${method}\n`;
  return { markdown: `${body}${appendix}`, cited: cited.length, sources: independent.size };
}

function assistantToolMessage(result) {
  return {
    role: 'assistant',
    content: result.content || null,
    tool_calls: (result.toolCalls || []).map((tc) => ({
      id: tc.id,
      type: 'function',
      function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
    })),
  };
}

async function synthesizeOutline({ args, pool, poolText, apiConfig, signal, ctx, chat, now }) {
  const messages = [
    { role: 'system', content: SYNTH_SYSTEM },
    { role: 'user', content: `${briefBlock(args, now)}\n\n${poolText}` },
  ];
  let lastError = '';
  for (let round = 0; round < SYNTH_MAX_ROUNDS; round++) {
    if (signal && signal.aborted) throw new Error('已中断');
    const result = await chat(messages, [OUTLINE_TOOL], apiConfig, () => {}, signal);
    emitUsage(ctx, result.usage);
    const call = (result.toolCalls || []).find((tc) => tc.name === 'submit_outline');
    if (!call) {
      messages.push({ role: 'assistant', content: result.content || '' });
      messages.push({ role: 'user', content: '[RUNTIME] 必须调用 submit_outline 提交骨架，不要输出正文。' });
      lastError = '未提交骨架';
      continue;
    }
    const checked = validateOutline(call.arguments, pool);
    if (!checked.error) return checked.outline;
    lastError = checked.error;
    messages.push(assistantToolMessage(result));
    messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify({ ok: false, error: checked.error }) });
  }
  throw new Error(`论点骨架未通过校验：${lastError}`);
}

/**
 * 主入口。deps 可注入 chat / getDoc 便于测试。
 * 返回 { ok, title, markdown, outline, stats, residual } 或 { ok:false, error }。
 */
export async function composeReport(args = {}, {
  apiConfig, signal, ctx = {}, sessions = [], notes = [], getDoc = async () => null,
  chat = streamChatWithTools, now = new Date(),
} = {}) {
  const question = String(args.question || '').trim();
  if (!question) return { ok: false, error: 'compose_report 需要 question：这份报告要回答的核心问题。' };
  if (!apiConfig || !apiConfig.apiKey) return { ok: false, error: '没有可用 API，无法写报告。' };
  const length = LENGTH_TARGETS[args.length] ? args.length : 'standard';
  const pool = buildEvidencePool({ sessions, notes, taskIds: args.task_ids });
  if (pool.usableCount < MIN_USABLE_EVIDENCE) {
    return {
      ok: false,
      error: `证据池只有 ${pool.usableCount} 条已核验证据（${pool.taskCount} 个子任务）。先派 explore 补证据；或问题本身很小，直接在对话里回答。`,
    };
  }
  const poolText = formatPoolForPrompt(pool);

  const outline = await synthesizeOutline({ args, pool, poolText, apiConfig, signal, ctx, chat, now });

  const writeMessages = [
    { role: 'system', content: writingSystemPrompt(length) },
    {
      role: 'user',
      content: [
        briefBlock(args, now),
        '',
        '## 论点骨架（按它写；可以调整措辞和顺序，不要丢掉判断）',
        JSON.stringify(outline, null, 2),
        '',
        poolText,
      ].join('\n'),
    },
  ];
  const draft = await chat(writeMessages, [], apiConfig, () => {}, signal);
  emitUsage(ctx, draft.usage);
  let markdown = String(draft.content || '').trim();
  if (!markdown) return { ok: false, error: '写作模型没有返回正文。' };

  let lint = lintReport(markdown, pool, { length });
  let revised = false;
  if (lint.major.length && !(signal && signal.aborted)) {
    writeMessages.push({ role: 'assistant', content: markdown });
    writeMessages.push({
      role: 'user',
      content: `[RUNTIME-LINT] 初稿有以下问题，请输出完整修订稿（不是修改说明）：\n${lint.major.map((m, i) => `${i + 1}. ${m}`).join('\n')}`,
    });
    const second = await chat(writeMessages, [], apiConfig, () => {}, signal);
    emitUsage(ctx, second.usage);
    const next = String(second.content || '').trim();
    if (next) {
      const nextLint = lintReport(next, pool, { length });
      if (nextLint.major.length <= lint.major.length) {
        markdown = next;
        lint = nextLint;
        revised = true;
      }
    }
  }

  const docs = new Map();
  const citedIds = new Set(extractRefs(markdown));
  for (const item of pool.items) {
    if (!citedIds.has(item.id)) continue;
    for (const s of item.sources) {
      if (!s.doc_id || docs.has(s.doc_id)) continue;
      const doc = await getDoc(s.doc_id).catch(() => null);
      docs.set(s.doc_id, { title: doc?.title || '', url: doc?.url || '' });
    }
  }
  const rendered = renderReport(markdown, pool, { docs, taskCount: pool.taskCount });
  return {
    ok: true,
    title: String(args.title || '').trim() || outline.title,
    markdown: rendered.markdown,
    outline,
    stats: {
      evidence_pool: pool.items.length,
      evidence_verified: pool.usableCount,
      evidence_cited: rendered.cited,
      sources: rendered.sources,
      tasks: pool.taskCount,
      chars: lint.stats.chars,
      revised,
    },
    residual: lint.issues,
    evidence: pool.items,
  };
}
