/**
 * 按用户指定体裁写文档。
 * 输入是子代理交回的原文段落。先写判断，再只删编造的数字，最后给研报挂出处。
 * 结论不因为原文里没有这句话就删掉。出处只加标记，不改已经写好的句子。
 */

import { streamChatWithTools } from './ai-client.js';
import { emitUsage } from './usage.js';

export const GENRE_GUIDE = {
  策划方案: '章节按方案写：背景、目标、对象、做法、节奏、资源与审批、风险。每个动作写明责任主体和时间。',
  纪要: '按议题写：结论、决定、负责人、时间。',
  研报: '开头写你自己的结论：一句材料里没有直接写出的话。用已有数字说明它怎么来的，并写明什么新情况会让它不成立。只把某份材料的原话再说一遍，不算结论。后面再摆事实。',
  对比: '按同一组维度对齐各方，缺材料的格子写明假设或空缺原因。',
  档案: '按对象写清是什么、谁在做、关键事实和尚未见到的部分。',
};

const DOC_MARK = '<<<DOC>>>';
const GAP_MARK = '<<<GAPS>>>';
const CITE_MARK = '<<<CITE>>>';

export function genreGuide(genre) {
  const name = String(genre || '').trim();
  return GENRE_GUIDE[name] || `按体裁「${name || '文档'}」安排章节。结构以写作说明为准。`;
}

export function collectJudgments(sessions = [], taskIds = null) {
  const wanted = Array.isArray(taskIds) && taskIds.length ? new Set(taskIds.map(String)) : null;
  const items = [];
  for (const session of sessions) {
    if (!session || !session.report) continue;
    if (wanted && !wanted.has(String(session.id))) continue;
    const summary = String(session.report.summary || '').trim();
    const unresolved = (session.report.unresolved || []).map((v) => String(v || '').trim()).filter(Boolean);
    if (!summary && !unresolved.length) continue;
    items.push({ summary, unresolved });
  }
  return items;
}

export function collectPassages(sessions = [], taskIds = null) {
  const wanted = Array.isArray(taskIds) && taskIds.length ? new Set(taskIds.map(String)) : null;
  const passages = [];
  const seen = new Set();
  for (const session of sessions) {
    if (!session || !session.report) continue;
    if (wanted && !wanted.has(String(session.id))) continue;
    for (const raw of session.report.passages || []) {
      const quote = String(raw.quote || '').trim();
      const docId = String(raw.doc_id || '').trim();
      const anchor = String(raw.anchor || '').trim();
      const use = String(raw.use || '').trim();
      if (!quote || !docId || !anchor) continue;
      const key = `${docId}#${anchor}|${quote}`;
      if (seen.has(key)) continue;
      seen.add(key);
      passages.push({ use: use || '未标明', doc_id: docId, anchor, quote });
    }
  }
  return passages;
}

export function splitDraft(text) {
  const raw = String(text || '').trim();
  const docAt = raw.indexOf(DOC_MARK);
  const body = docAt >= 0 ? raw.slice(docAt + DOC_MARK.length) : raw;
  const gapAt = body.indexOf(GAP_MARK);
  const markdown = (gapAt >= 0 ? body.slice(0, gapAt) : body).trim();
  const gaps = gapAt < 0 ? [] : body.slice(gapAt + GAP_MARK.length)
    .split('\n')
    .map((line) => line.replace(/^[-*\d.、\s]+/, '').trim())
    .filter(Boolean);
  return { markdown, gaps };
}

function formatPassages(passages) {
  return passages.map((p, i) => `[P${i + 1}] 用于：${p.use}\n出处：${p.doc_id}#${p.anchor}\n「${p.quote}」`).join('\n\n');
}

function formatJudgments(items) {
  return items.map((item, i) => {
    const clash = item.unresolved.length ? item.unresolved.join('；') : '无';
    return `[J${i + 1}] ${item.summary || '（没有写成判断）'}\n对不上或没查到：${clash}`;
  }).join('\n\n');
}

function titleOf(markdown, genre, explicit) {
  const given = String(explicit || '').trim();
  if (given) return given;
  const heading = String(markdown || '').match(/^#\s+(.+)$/m);
  return (heading && heading[1].trim()) || String(genre || '').trim() || '文档';
}

function asList(value) {
  if (Array.isArray(value)) return value.map((v) => String(v || '').trim()).filter(Boolean);
  const one = String(value || '').trim();
  return one ? [one] : [];
}

function passageRef(passage) {
  return `${passage.doc_id}#${passage.anchor}`;
}

/**
 * 在定稿上挂出处。只在原文里已有的短句后面插入标记，并在文末列出处。
 * 对不上的标记丢掉，不改句子。
 */
export function applyCitations(markdown, passages = [], citeText = '') {
  const byRef = new Map(passages.map((p) => [passageRef(p), p]));
  let text = String(markdown || '');
  const at = String(citeText || '').indexOf(CITE_MARK);
  const body = at >= 0 ? citeText.slice(at + CITE_MARK.length) : '';
  const used = [];
  for (const line of body.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('<<<')) continue;
    const tab = trimmed.indexOf('\t');
    if (tab < 0) continue;
    const phrase = trimmed.slice(0, tab).trim();
    const ref = trimmed.slice(tab + 1).trim();
    if (!phrase || !byRef.has(ref) || text.includes(`${phrase}〔${ref}〕`)) continue;
    const idx = text.indexOf(phrase);
    if (idx < 0) continue;
    text = `${text.slice(0, idx + phrase.length)}〔${ref}〕${text.slice(idx + phrase.length)}`;
    used.push(ref);
  }
  const unique = [...new Set(used)];
  if (!unique.length) return text;
  const lines = unique.map((ref) => {
    const quote = String(byRef.get(ref).quote || '').replace(/\s+/g, ' ').trim();
    const short = quote.length > 80 ? `${quote.slice(0, 80)}…` : quote;
    return `- ${ref}：${short}`;
  });
  return `${text.trim()}\n\n## 出处\n${lines.join('\n')}`;
}

/**
 * @returns {Promise<{ok:true,title:string,markdown:string,passageCount:number}|{ok:false,error?:string,need_reading?:string[],note?:string}>}
 */
export async function writeDocument(args = {}, {
  apiConfig, signal, ctx = {}, sessions = [], chat = streamChatWithTools,
} = {}) {
  const brief = String(args.brief || args.question || '').trim();
  const genre = String(args.genre || '').trim() || '文档';
  if (!brief) return { ok: false, error: 'write_document 需要 brief：这份文档要写什么、怎样算好。' };
  if (!apiConfig || !apiConfig.apiKey) return { ok: false, error: '没有可用 API，无法写文档。' };
  const passages = collectPassages(sessions, args.task_ids);
  if (!passages.length) {
    return { ok: false, error: '还没有原文段落。先派 explore，任务书写明要覆盖的要点；交回 passages 后再调用 write_document。' };
  }
  const judgments = collectJudgments(sessions, args.task_ids);
  const judgmentText = formatJudgments(judgments);
  const poolText = formatPassages(passages);
  const cover = asList(args.must_cover);
  const briefBlock = [
    `体裁：${genre}`,
    args.audience ? `读者：${String(args.audience).trim()}` : '',
    `写作说明：${brief}`,
    cover.length ? `必须覆盖：${cover.join('、')}` : '',
  ].filter(Boolean).join('\n');

  const draft = await chat([
    {
      role: 'system',
      content: [
        `你按用户要的体裁「${genre}」写一份可交付文档。只输出文档正文。`,
        genreGuide(genre),
        '若给了调查员的判断，你的结论要在那个判断上再推进一步，不要把它再说一遍。',
        '先把判断写完，不要在正文里挂出处。出处会在定稿后另挂。',
        '数字必须来自给定原文，或由这些数字算出。写明在算什么。原文里没有、又算不出来的数字不要写。',
        '判断留在正文里。原文没有这句话，不是删掉它的理由。不要把写作规矩写进正文。',
        '写作说明里若有单独一行 ![说明](img:id)，那是材料里已有的流程图、示意图或数据图。必须原样放进相关章节，不要改 id、不要改写成文字、不要删。',
        '不要套用固定的研报章节，除非体裁就是研报。',
      ].join('\n'),
    },
    { role: 'user', content: `${briefBlock}${judgmentText ? `\n\n## 调查员的判断\n${judgmentText}` : ''}\n\n## 原文\n${poolText}` },
  ], [], apiConfig, () => {}, signal);
  emitUsage(ctx, draft.usage);
  let markdown = String(draft.content || '').trim();
  if (!markdown) return { ok: false, error: '写作没有返回正文。' };

  const revised = await chat([
    {
      role: 'system',
      content: [
        '对照原文改这一份文档。只输出下面两段，不要解释。',
        `${DOC_MARK}`,
        '改后的完整文档。只删编造的数字：原文里没有、并且无法用原文数字算出来的数字。判断、机构名、期限、专名都留着。不要因为某句原文里没有就删句或改写判断。写作说明里的 ![说明](img:id) 行必须原样留在对应章节。',
        `${GAP_MARK}`,
        '每行一个正文里当作事实使用、但原文没有也算不出来的数字。判断不要列入。没有就留空。',
      ].join('\n'),
    },
    { role: 'user', content: `${briefBlock}${judgmentText ? `\n\n## 调查员的判断\n${judgmentText}` : ''}\n\n## 原文\n${poolText}\n\n## 初稿\n${markdown}` },
  ], [], apiConfig, () => {}, signal);
  emitUsage(ctx, revised.usage);
  const split = splitDraft(revised.content || '');
  if (split.markdown) markdown = split.markdown;
  if (split.gaps.length) {
    return {
      ok: false,
      need_reading: split.gaps,
      note: '这些数字原文里没有，也算不出来，文档未保存。补到对应材料后再调用 write_document。',
    };
  }
  if (genre === '研报') {
    const cited = await chat([
      {
        role: 'system',
        content: [
          '稿子已经定稿。你不能改写、不能增删判断。',
          `只输出 ${CITE_MARK}，然后每行一条：正文里连续出现的一小段原句、制表符、doc_id#anchor。`,
          '这一小段必须在正文里原样存在，用来定位。对不上任何原文的结论不要硬挂。没有就只留标记。',
        ].join('\n'),
      },
      { role: 'user', content: `${briefBlock}\n\n## 原文\n${poolText}\n\n## 定稿\n${markdown}` },
    ], [], apiConfig, () => {}, signal);
    emitUsage(ctx, cited.usage);
    markdown = applyCitations(markdown, passages, cited.content || '');
  }
  return {
    ok: true,
    title: titleOf(markdown, genre, args.title),
    markdown,
    passageCount: passages.length,
  };
}
