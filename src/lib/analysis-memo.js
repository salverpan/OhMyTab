/** Analyst Memo / Red Team 中间产物：把材料转成判断、方案和被攻击后的结论。 */
import { validateAnalysisContract, formatAnalysisBrief } from './analysis-contract.js';

export const ANALYST_MEMO_VERSION = 'citecat-analyst-memo-v1';

function str(v) { return String(v == null ? '' : v).trim(); }
function arr(v) { return Array.isArray(v) ? v : []; }

export function validateRedTeam(raw = {}) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const issues = [];
  const red = {
    strongest_attack: str(r.strongest_attack || r.attack || r.argument),
    vulnerable_assumptions: arr(r.vulnerable_assumptions || r.vulnerabilities).map(str).filter(Boolean),
    evidence_that_would_flip: arr(r.evidence_that_would_flip || r.flip_conditions).map(str).filter(Boolean),
    response: str(r.response || r.rebuttal),
    residual_uncertainty: str(r.residual_uncertainty || r.uncertainty),
  };
  if (!red.strongest_attack) issues.push({ type: 'redteam-missing', message: '缺少最强攻击 strongest_attack。' });
  if (!red.vulnerable_assumptions.length) issues.push({ type: 'redteam-assumptions-missing', message: '缺少脆弱假设列表。' });
  if (!red.evidence_that_would_flip.length) issues.push({ type: 'redteam-flip-missing', message: '缺少会翻转判断的证据。' });
  if (!red.response) issues.push({ type: 'redteam-response-missing', message: '缺少对最强攻击的回应。' });
  return { ok: issues.length === 0, redTeam: red, issues };
}

export function validateAnalystMemo(input = {}) {
  const contract = validateAnalysisContract(input.analysis);
  const red = validateRedTeam(input.red_team || input.redTeam || {
    strongest_attack: input.analysis && input.analysis.strongest_countercase && input.analysis.strongest_countercase.argument,
    response: input.analysis && input.analysis.strongest_countercase && input.analysis.strongest_countercase.response,
    evidence_that_would_flip: arr(input.analysis && input.analysis.key_judgments).map((j) => j.falsifier).filter(Boolean),
    vulnerable_assumptions: arr(input.analysis && input.analysis.key_judgments).map((j) => j.basis).filter(Boolean),
  });
  const issues = [...contract.issues, ...red.issues];
  const ok = contract.ok && red.ok;
  const memo = ok ? buildAnalystMemo(contract.report, red.redTeam) : '';
  return {
    ok,
    version: ANALYST_MEMO_VERSION,
    analysis: contract.report,
    redTeam: red.redTeam,
    memo,
    issues,
  };
}

export function buildAnalystMemo(analysis, redTeam) {
  const red = redTeam || {};
  return [
    '# Analyst Memo',
    '',
    '## 核心判断',
    analysis.bottom_line,
    '',
    '## 明确倾向',
    '- 方向: ' + analysis.stance.direction,
    '- 置信度: ' + analysis.stance.confidence,
    '- 理由: ' + analysis.stance.reason,
    '',
    '## 分析框架',
    '- 框架: ' + analysis.framework.name + (analysis.framework.id ? ' (' + analysis.framework.id + ')' : ''),
    '- 适配原因: ' + analysis.framework.why,
    '- 框架局限: ' + analysis.framework.limitation,
    '',
    '## 关键判断',
    ...analysis.key_judgments.map((j) => [
      '### ' + j.id,
      '- 判断: ' + j.statement,
      '- 依据: ' + (j.basis || '未说明'),
      '- 置信度: ' + j.confidence,
      '- 证伪条件: ' + (j.falsifier || '未说明'),
    ].join('\n')),
    '',
    '## Red Team',
    '- 最强攻击: ' + (red.strongest_attack || ''),
    '- 脆弱假设: ' + (red.vulnerable_assumptions || []).join('；'),
    '- 会翻转判断的证据: ' + (red.evidence_that_would_flip || []).join('；'),
    '- 回应: ' + (red.response || ''),
    '- 残余不确定性: ' + (red.residual_uncertainty || '无'),
    '',
    '## 行动建议',
    '- 动作: ' + analysis.recommendation.action,
    '- 条件: ' + analysis.recommendation.conditions,
    '- 上行空间: ' + (analysis.recommendation.upside || '未说明'),
    '- 下行风险/代价: ' + analysis.recommendation.downside,
    '- 停止条件: ' + analysis.recommendation.stop_condition,
    '- 领先指标: ' + (analysis.recommendation.leading_indicators || []).join('；'),
    '',
    '## 未解决项',
    ...(analysis.unresolved.length ? analysis.unresolved.map((x) => '- ' + x) : ['- 无']),
    '',
    '---',
    '### Writer 必守契约',
    formatAnalysisBrief(analysis),
  ].join('\n');
}

