/** 强制结构化交回协议。所有 Sub 工种与章节 Worker 共用 claims 形状。 */

const MAX_CLAIMS = 80;
const MAX_EVIDENCE = 8;

const evidenceSchema = {
  type: 'object',
  properties: {
    doc_id: { type: 'string', description: '来源证据 doc_id。' },
    anchor: { type: 'string', description: 'cN / pN / oN 锚点。' },
    quote: { type: 'string', description: '来源中的逐字引文，不能写转述。' },
    prefix: { type: 'string', description: '引文前的短上下文，可选。' },
    suffix: { type: 'string', description: '引文后的短上下文，可选。' },
  },
  required: ['doc_id', 'anchor', 'quote'],
};

/**
 * 陈述性质：区分“事情发生了”与“某方说事情发生了”。Check 据此判断引文是否只支持了较弱的一层。
 * confirmed 只用于来源以自身名义直接发布或观察到的事实（官方公告原文、原始数据、现场记录）。
 */
export const CLAIM_MODALITIES = ['confirmed', 'claimed', 'reported', 'denied', 'assessed', 'speculative'];
export const MODALITY_LABEL = {
  confirmed: '确认', claimed: '声称', reported: '转述', denied: '否认', assessed: '评估', speculative: '推测',
};

const claimSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    claim: { type: 'string', description: '一句可核查的主张。某方说法要写成“X 称……”，不要把声称写成既成事实。' },
    attribution: {
      type: 'string',
      description: '这句话最初是谁说的：原始发布方或发言主体（如“乌克兰空军，经路透社转述”）。不是转载它的网站。',
    },
    modality: {
      type: 'string',
      enum: CLAIM_MODALITIES,
      description: 'confirmed=来源以自身名义直接发布/观察；claimed=当事方声称；reported=媒体转述或匿名信源；denied=某方否认；assessed=分析机构评估或预测；speculative=推测传闻。',
    },
    event_time: { type: 'string', description: '事件发生时间（YYYY-MM-DD 或区间），不是报道或采集时间；未知留空。' },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    evidence: { type: 'array', minItems: 1, maxItems: MAX_EVIDENCE, items: evidenceSchema },
  },
  required: ['id', 'claim', 'attribution', 'modality', 'evidence'],
};

const MAX_FINDINGS = 12;
/** claims 达到这个数量的调研型交回必须给 findings，否则就只是证据堆。 */
export const FINDINGS_REQUIRED_MIN_CLAIMS = 3;

const findingSchema = {
  type: 'object',
  properties: {
    question: { type: 'string', description: '任务书里要回答的问题（或你识别出的关键问题）。' },
    answer: {
      type: 'string',
      description: '你对这个问题的回答：一到三句判断，说明这些事实意味着什么，不是把 claim 再抄一遍。证据不足就明说“尚不能判断，因为……”。',
    },
    supporting: { type: 'array', items: { type: 'string' }, description: '支撑该回答的 claim id。' },
    contradicting: { type: 'array', items: { type: 'string' }, description: '与该回答相反或削弱它的 claim id；没有就空数组。' },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
  },
  required: ['question', 'answer', 'supporting', 'confidence'],
};

export const SUBMIT_REPORT_TOOL = {
  type: 'function',
  function: {
    name: 'submit_report',
    description:
      '提交给父代理的最终结构化报告。只有本工具成功才算任务完成。'
      + '阅读任务把原文放进 passages（use + doc_id + anchor + 逐字 quote），claims 传空数组，不要写 findings。'
      + '操作型任务把结果写入 actions，事实才拆成 claims。',
    parameters: {
      type: 'object',
      properties: {
        summary: { type: 'string', description: '任务结果短摘要，不超过 800 字。先写结论，再写依据。' },
        findings: { type: 'array', maxItems: MAX_FINDINGS, items: findingSchema },
        claims: { type: 'array', maxItems: MAX_CLAIMS, items: claimSchema },
        actions: {
          type: 'array',
          maxItems: 40,
          items: {
            type: 'object',
            properties: {
              description: { type: 'string' },
              result_ref: { type: 'string', description: '产物 id、标签页 id 或其他运行时引用。' },
            },
            required: ['description'],
          },
        },
        unresolved: { type: 'array', maxItems: 40, items: { type: 'string' } },
        passages: {
          type: 'array',
          maxItems: 40,
          description: '阅读任务的交回。每条是可写进文档的原文，不要写成判断。',
          items: {
            type: 'object',
            properties: {
              use: { type: 'string', description: '这段原文准备写进文档的哪一条要点。' },
              doc_id: { type: 'string' },
              anchor: { type: 'string', description: 'cN / pN / oN。' },
              quote: { type: 'string', description: '来源中的逐字引文。' },
            },
            required: ['use', 'doc_id', 'anchor', 'quote'],
          },
        },
      },
      required: ['summary', 'claims', 'actions', 'unresolved'],
    },
  },
};

export function normalizeEvidence(raw = {}) {
  return {
    doc_id: String(raw.doc_id || raw.docId || '').trim(),
    anchor: String(raw.anchor || '').replace(/^.*#/, '').trim(),
    quote: String(raw.quote || '').trim(),
    prefix: String(raw.prefix || '').trim().slice(-200),
    suffix: String(raw.suffix || '').trim().slice(0, 200),
  };
}

/** 缺省按“转述”处理：宁可把事实看弱，也不默认成已确认。 */
export function normalizeModality(value) {
  const v = String(value || '').trim().toLowerCase();
  return CLAIM_MODALITIES.includes(v) ? v : 'reported';
}

function normalizeFindings(rawFindings, claimIds) {
  if (rawFindings == null) return { findings: [] };
  if (!Array.isArray(rawFindings)) return { error: 'findings 必须是数组。' };
  const findings = [];
  for (let i = 0; i < Math.min(rawFindings.length, MAX_FINDINGS); i++) {
    const src = rawFindings[i] || {};
    const question = String(src.question || '').trim();
    const answer = String(src.answer || '').trim();
    if (!question || !answer) return { error: `finding ${i + 1} 需要 question 和 answer。` };
    const refs = (list) => (Array.isArray(list) ? list : []).map((v) => String(v || '').trim()).filter(Boolean);
    const supporting = refs(src.supporting);
    const contradicting = refs(src.contradicting);
    const unknown = [...supporting, ...contradicting].filter((id) => !claimIds.has(id));
    if (unknown.length) return { error: `finding ${i + 1} 引用了不存在的 claim id：${unknown.join(', ')}。` };
    if (!supporting.length && !contradicting.length) {
      return { error: `finding ${i + 1} 至少要引用一条 claim（supporting 或 contradicting）。` };
    }
    findings.push({
      question: question.slice(0, 300),
      answer: answer.slice(0, 1200),
      supporting,
      contradicting,
      confidence: ['high', 'medium', 'low'].includes(src.confidence) ? src.confidence : 'medium',
    });
  }
  return { findings };
}

/**
 * @param {object} raw
 * @param {object} [opts]
 * @param {boolean} [opts.requireFindings] 调研型交回（claims 足够多）缺 findings 时拒收
 */
export function validateTaskReport(raw, { requireFindings = false } = {}) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { error: '报告必须是对象。' };
  const summary = String(raw.summary || '').trim();
  if (!summary) return { error: 'summary 不能为空。' };
  if (!Array.isArray(raw.claims) || !Array.isArray(raw.actions) || !Array.isArray(raw.unresolved)) {
    return { error: 'claims/actions/unresolved 必须都是数组。' };
  }
  if (raw.claims.length > MAX_CLAIMS) return { error: `claims 最多 ${MAX_CLAIMS} 条。` };
  const ids = new Set();
  const claims = [];
  for (let i = 0; i < raw.claims.length; i++) {
    const src = raw.claims[i] || {};
    const id = String(src.id || `c${i + 1}`).trim();
    const claim = String(src.claim || '').trim();
    if (!claim) return { error: `claim ${id} 的 claim 不能为空。` };
    if (ids.has(id)) return { error: `claim id 重复：${id}。` };
    ids.add(id);
    if (!Array.isArray(src.evidence) || !src.evidence.length) {
      return { error: `claim ${id} 至少需要一条 evidence。无来源内容应放 unresolved。` };
    }
    if (src.evidence.length > MAX_EVIDENCE) return { error: `claim ${id} 的 evidence 最多 ${MAX_EVIDENCE} 条。` };
    const evidence = src.evidence.map(normalizeEvidence);
    const bad = evidence.find((e) => !e.doc_id || !e.anchor || !e.quote);
    if (bad) return { error: `claim ${id} 的 evidence 必须包含 doc_id、anchor、quote。` };
    claims.push({
      id,
      claim,
      attribution: String(src.attribution || '').trim().slice(0, 120),
      modality: normalizeModality(src.modality),
      event_time: String(src.event_time || src.eventTime || '').trim().slice(0, 40),
      confidence: ['high', 'medium', 'low'].includes(src.confidence) ? src.confidence : 'medium',
      evidence,
    });
  }
  const actions = raw.actions.slice(0, 40).map((a) => ({
    description: String(a?.description || '').trim(),
    result_ref: String(a?.result_ref || '').trim(),
  })).filter((a) => a.description);
  const unresolved = raw.unresolved.slice(0, 40).map((v) => String(v || '').trim()).filter(Boolean);
  const passageList = Array.isArray(raw.passages) ? raw.passages : [];
  if (passageList.length > 40) return { error: 'passages 最多 40 条。' };
  const passages = [];
  for (let i = 0; i < passageList.length; i++) {
    const src = passageList[i] || {};
    const use = String(src.use || '').trim();
    const docId = String(src.doc_id || src.docId || '').trim();
    const anchor = String(src.anchor || '').replace(/^.*#/, '').trim();
    const quote = String(src.quote || '').trim();
    if (!use || !docId || !anchor || !quote) {
      return { error: `passage ${i + 1} 需要 use、doc_id、anchor、quote。` };
    }
    passages.push({ use: use.slice(0, 80), doc_id: docId, anchor, quote: quote.slice(0, 800) });
  }
  const normalized = normalizeFindings(raw.findings, ids);
  if (normalized.error) return { error: normalized.error };
  if (requireFindings && claims.length >= FINDINGS_REQUIRED_MIN_CLAIMS && !normalized.findings.length) {
    return {
      error: `有 ${claims.length} 条 claims 但没有 findings。按任务书里的问题逐个回答：answer 写这些事实意味着什么（判断），supporting/contradicting 填 claim id。`,
    };
  }
  return {
    report: {
      summary: summary.slice(0, 800),
      findings: normalized.findings,
      claims,
      passages,
      actions,
      unresolved,
    },
  };
}

function claimForMain(c) {
  return {
    id: c.id,
    claim: c.claim,
    ...(c.attribution ? { attribution: c.attribution } : {}),
    modality: c.modality || 'reported',
    ...(c.event_time ? { event_time: c.event_time } : {}),
    confidence: c.confidence,
    sources: (c.evidence || []).map((e) => `${e.doc_id}#${e.anchor}`),
  };
}

const NOTE_PASSAGES = 'covered 是已有原文的要点，unresolved 是还没找到原文的要点。缺口还会改变文档做法时，只为缺口再派阅读。覆盖够了调用 write_document。不要把段落抄进对话。';
const NOTE_FINDINGS = '按 findings 回答：answer 是判断，写成段落；supporting / contradicting 是这条判断用到的事实，写进同一段并括注 sources，不要另起清单。用户要一份文档时调用 write_document，不要自己重写正文。';
const NOTE_FEW = '这次没有 findings。用 summary 作答；claims 是少量事实，写进段落并括注 sources，不要逐条照抄。';
const NOTE_PILE = '事实较多但没有 findings，这里不展开 claims。要成文就派阅读补 passages，再调用 write_document。';

/**
 * 主代理看到的短摘要。有 findings 时事实挂在判断下面，不再平铺 claims；
 * 未被任何 finding 引用的事实只留条数。完整 claims 与引文留在子会话，供 Check 与 compose_report。
 */
export function reportForMain(report) {
  if (!report) return null;
  const claims = report.claims || [];
  const byId = new Map(claims.map((c) => [c.id, c]));
  const rawFindings = report.findings || [];
  const findings = rawFindings.map((f) => ({
    question: f.question,
    answer: f.answer,
    confidence: f.confidence,
    supporting: (f.supporting || []).map((id) => byId.get(id)).filter(Boolean).map(claimForMain),
    contradicting: (f.contradicting || []).map((id) => byId.get(id)).filter(Boolean).map(claimForMain),
  }));
  const used = new Set();
  for (const f of rawFindings) {
    for (const id of [...(f.supporting || []), ...(f.contradicting || [])]) used.add(id);
  }
  const unreferenced = claims.filter((c) => !used.has(c.id)).length;
  const base = {
    summary: report.summary,
    actions: report.actions || [],
    unresolved: report.unresolved || [],
  };
  const passages = report.passages || [];
  if (passages.length) {
    const covered = [];
    for (const p of passages) {
      if (p.use && !covered.includes(p.use)) covered.push(p.use);
    }
    return { ...base, note: NOTE_PASSAGES, covered, passage_count: passages.length };
  }
  if (findings.length) {
    return {
      ...base,
      note: NOTE_FINDINGS,
      findings,
      ...(unreferenced ? { unreferenced_claims: unreferenced } : {}),
    };
  }
  if (claims.length >= FINDINGS_REQUIRED_MIN_CLAIMS) {
    return { ...base, note: NOTE_PILE, claim_count: claims.length };
  }
  return {
    ...base,
    note: NOTE_FEW,
    ...(claims.length ? { claims: claims.map(claimForMain) } : {}),
  };
}
