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

export const SUBMIT_REPORT_TOOL = {
  type: 'function',
  function: {
    name: 'submit_report',
    description:
      '提交给父代理的最终结构化报告。只有本工具成功才算任务完成。事实必须拆成 claims 并附逐字引文与 doc_id#anchor；操作型任务可让 claims 为空、把结果写入 actions。',
    parameters: {
      type: 'object',
      properties: {
        summary: { type: 'string', description: '任务结果短摘要，不超过 800 字。' },
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

export function validateTaskReport(raw) {
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
  return {
    report: {
      summary: summary.slice(0, 800),
      claims,
      actions,
      unresolved,
    },
  };
}

export function reportForMain(report) {
  if (!report) return null;
  return {
    summary: report.summary,
    claims: (report.claims || []).map((c) => ({
      id: c.id,
      claim: c.claim,
      ...(c.attribution ? { attribution: c.attribution } : {}),
      modality: c.modality || 'reported',
      ...(c.event_time ? { event_time: c.event_time } : {}),
      confidence: c.confidence,
      sources: c.evidence.map((e) => `${e.doc_id}#${e.anchor}`),
    })),
    actions: report.actions || [],
    unresolved: report.unresolved || [],
  };
}
