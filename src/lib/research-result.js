/** 轻量研究交回协议：summary + artifact_id + sources + gaps。 */
import {
  SUBMIT_REPORT_TOOL,
  validateTaskReport,
  reportForMain,
} from './task-report.js';

const CLAIMS_SCHEMA = SUBMIT_REPORT_TOOL.function.parameters.properties.claims;
const ACTIONS_SCHEMA = SUBMIT_REPORT_TOOL.function.parameters.properties.actions;

export const SUBMIT_RESEARCH_TOOL = {
  type: 'function',
  function: {
    name: 'submit_research',
    description:
      '提交研究支线的最终结果。只有本工具成功才算完成。'
      + 'summary 写你的判断、关键数字和对不上的地方；完整笔记先写入 write_research_artifact 得到 artifact_id。'
      + 'sources 填 doc_id#anchor 或 URL；gaps 填还没解决、可能改变判断的点。'
      + '有可核查事实时才附 claims（每条必须带证据）；纯判断不要硬造 claim。',
    parameters: {
      type: 'object',
      properties: {
        summary: { type: 'string', description: '这一路的明确判断、关键数字、矛盾点。不要写材料摘要。' },
        artifact_id: { type: 'string', description: 'write_research_artifact 返回的 doc_id，存放完整研究笔记。' },
        sources: {
          type: 'array',
          items: { type: 'string' },
          description: '来源句柄：doc_id#anchor 或 URL。',
        },
        gaps: {
          type: 'array',
          items: { type: 'string' },
          description: '未解决、但可能改变判断的问题。',
        },
        claims: CLAIMS_SCHEMA,
        actions: ACTIONS_SCHEMA,
        passages: SUBMIT_REPORT_TOOL.function.parameters.properties.passages,
      },
      required: ['summary', 'artifact_id', 'sources', 'gaps'],
    },
  },
};

export function validateResearchSubmission(raw = {}) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { error: '研究交回必须是对象。' };
  const summary = String(raw.summary || '').trim();
  if (!summary) return { error: 'summary 不能为空。先写这一路的判断。' };
  const artifactId = String(raw.artifact_id || '').trim();
  if (!artifactId) {
    return { error: '缺少 artifact_id。先用 write_research_artifact 保存完整研究笔记，再 submit_research。' };
  }
  if (!Array.isArray(raw.sources)) return { error: 'sources 必须是数组；没有来源就传空数组并把缺口写进 gaps。' };
  if (!Array.isArray(raw.gaps)) return { error: 'gaps 必须是数组；没有缺口传空数组。' };
  const sources = raw.sources.map((x) => String(x || '').trim()).filter(Boolean);
  const gaps = raw.gaps.map((x) => String(x || '').trim()).filter(Boolean);
  const claims = Array.isArray(raw.claims) ? raw.claims : [];
  const actions = Array.isArray(raw.actions) ? raw.actions : [];
  const checked = validateTaskReport({
    summary,
    claims,
    actions,
    unresolved: gaps,
    passages: Array.isArray(raw.passages) ? raw.passages : [],
  });
  if (checked.error) return { error: checked.error };
  return {
    research: {
      summary: summary.slice(0, 1200),
      artifact_id: artifactId,
      sources: [...new Set(sources)].slice(0, 80),
      gaps: gaps.slice(0, 40),
      claims: checked.report.claims,
      actions: checked.report.actions,
      passages: checked.report.passages || [],
    },
  };
}

export function researchForMain(research) {
  if (!research) return null;
  return {
    summary: research.summary,
    artifact_id: research.artifact_id,
    sources: research.sources || [],
    gaps: research.gaps || [],
    claims_count: (research.claims || []).length,
    actions: research.actions || [],
  };
}

export function formatResearchTaskResult({ id, type, state, research, text, verification }) {
  return JSON.stringify({
    task_id: String(id || ''),
    type: String(type || ''),
    state: String(state || 'error'),
    summary: String((research && research.summary) || text || ''),
    ...(research ? {
      artifact_id: research.artifact_id || '',
      sources: research.sources || [],
      gaps: research.gaps || [],
      claims_count: (research.claims || []).length,
      actions: research.actions || [],
    } : {}),
    ...(text && !research ? { message: String(text) } : {}),
    ...(verification ? { verification } : {}),
  });
}

export { reportForMain };
