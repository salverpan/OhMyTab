/**
 * 按用户指定体裁写文档。
 * 输入是子代理交回的原文段落，不是核验过的判断。
 * 一次写成，再对照原文改一稿。会改变做法、但完全没有原文的要点不保存，退回补读。
 */

import { streamChatWithTools } from './ai-client.js';
import { emitUsage } from './usage.js';

export const GENRE_GUIDE = {
  策划方案: '章节按方案写：背景、目标、对象、做法、节奏、资源与审批、风险。每个动作写明责任主体和时间。',
  纪要: '按议题写：结论、决定、负责人、时间。',
  研报: '先写判断，再用原文论证。数字和机构名必须能回到原文。',
  对比: '按同一组维度对齐各方，缺材料的格子写明假设或空缺原因。',
  档案: '按对象写清是什么、谁在做、关键事实和尚未见到的部分。',
};

const DOC_MARK = '<<<DOC>>>';
const GAP_MARK = '<<<GAPS>>>';

export function genreGuide(genre) {
  const name = String(genre || '').trim();
  return GENRE_GUIDE[name] || `按体裁「${name || '文档'}」安排章节。结构以写作说明为准。`;
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
        '数字、机构名、期限和专名只能来自给定原文。原文没有的，写成文档中的假设，并在句中标明假设。',
        '写作说明里若有单独一行 ![说明](img:id)，那是材料里已有的流程图、示意图或数据图。必须原样放进相关章节，不要改 id、不要改写成文字、不要删。',
        '不要套用固定的研报章节，除非体裁就是研报。',
      ].join('\n'),
    },
    { role: 'user', content: `${briefBlock}\n\n## 原文\n${poolText}` },
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
        '改后的完整文档。删掉原文没有的数字、机构名和期限，或改成句中标明的假设。写作说明里的 ![说明](img:id) 行必须原样留在对应章节。',
        `${GAP_MARK}`,
        '每行一个仍会改变做法、但原文里完全没有的要点。正文里已经写成假设的不要列入。没有就留空。',
      ].join('\n'),
    },
    { role: 'user', content: `${briefBlock}\n\n## 原文\n${poolText}\n\n## 初稿\n${markdown}` },
  ], [], apiConfig, () => {}, signal);
  emitUsage(ctx, revised.usage);
  const split = splitDraft(revised.content || '');
  if (split.markdown) markdown = split.markdown;
  if (split.gaps.length) {
    return {
      ok: false,
      need_reading: split.gaps,
      note: '这些要点没有原文，文档未保存。只为它们再派 explore，交回 passages 后再次调用 write_document。',
    };
  }
  return {
    ok: true,
    title: titleOf(markdown, genre, args.title),
    markdown,
    passageCount: passages.length,
  };
}
