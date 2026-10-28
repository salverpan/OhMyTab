/** 分析判断契约：事实可核，判断要敢；证据是支撑，不是判决书。 */
export const ANALYSIS_VERSION = 'citecat-analysis-v1';
import { FRAMEWORK_CATALOG } from './analysis-frameworks.js';
const FRAMEWORK_IDS = new Set(FRAMEWORK_CATALOG.map((f) => f.id));
export const STANCE_DIRECTIONS = ['support', 'oppose', 'conditional-support', 'conditional-oppose'];
export const CONFIDENCE_LEVELS = ['low', 'medium', 'high'];

function str(v) { return String(v == null ? '' : v).trim(); }
function arr(v) { return Array.isArray(v) ? v : []; }
function conf(v) { const n = Number(v); return Number.isFinite(n) && n >= 0 && n <= 1 ? n : null; }

export function normalizeAnalysis(raw = {}) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const st = r.stance && typeof r.stance === 'object' ? r.stance : {};
  const fw = r.framework && typeof r.framework === 'object' ? r.framework : {};
  const rawFrameworkId = str(fw.id || fw.framework_id || r.framework_id).toLowerCase();
  let frameworkName = str(fw.name || r.framework_name);
  if (!frameworkName && rawFrameworkId === 'no_framework') frameworkName = '不使用固定框架';
  if (!frameworkName && rawFrameworkId === 'custom') frameworkName = '自定义领域框架';
  const cc = r.strongest_countercase && typeof r.strongest_countercase === 'object' ? r.strongest_countercase : {};
  const rc = r.recommendation && typeof r.recommendation === 'object' ? r.recommendation : {};
  return {
    version: ANALYSIS_VERSION,
    bottom_line: str(r.bottom_line || r.thesis),
    stance: {
      direction: str(st.direction || r.stance_direction).toLowerCase(),
      confidence: conf(st.confidence ?? r.stance_confidence),
      reason: str(st.reason || r.stance_reason),
    },
    framework: {
      id: rawFrameworkId,
      name: frameworkName,
      why: str(fw.why || fw.why_this_framework || r.framework_why),
      limitation: str(fw.limitation || fw.what_it_may_miss || r.framework_limitation),
    },
    key_judgments: arr(r.key_judgments).map((item, i) => {
      const j = item && typeof item === 'object' ? item : { statement: item };
      return {
        id: str(j.id || `j${i + 1}`),
        statement: str(j.statement || j.judgment || j.text),
        basis: str(j.basis || j.basis_facts || j.evidence),
        confidence: CONFIDENCE_LEVELS.includes(str(j.confidence)) ? str(j.confidence) : 'medium',
        falsifier: str(j.falsifier || j.what_would_change_mind),
      };
    }).filter((j) => j.statement || j.basis || j.falsifier),
    strongest_countercase: {
      argument: str(cc.argument || cc.countercase || cc.strongest),
      response: str(cc.response || cc.rebuttal || cc.reply),
    },
    recommendation: {
      action: str(rc.action || rc.recommendation),
      conditions: str(rc.conditions || rc.when),
      upside: str(rc.upside || rc.expected_upside),
      downside: str(rc.downside || rc.risk),
      stop_condition: str(rc.stop_condition || rc.stop_loss || rc.exit),
      leading_indicators: arr(rc.leading_indicators || rc.indicators).map(str).filter(Boolean),
    },
    unresolved: arr(r.unresolved).map(str).filter(Boolean),
  };
}

export function validateAnalysisContract(raw, opts = {}) {
  const requireRecommendation = opts.requireRecommendation !== false;
  const report = normalizeAnalysis(raw);
  const issues = [];
  const add = (type, message, severity) => issues.push({ type, message, severity: severity || 'error' });
  if (!report.bottom_line) add('thesis-missing', '缺少明确的核心判断 bottom_line。必须先给出我认为式结论。');
  else if (report.bottom_line.length < 12) add('thesis-thin', '核心判断过短，必须写清判断对象、方向和核心理由。', 'warning');
  if (STANCE_DIRECTIONS.indexOf(report.stance.direction) < 0) add('stance-missing', '必须选边，不允许中立或视情况而定。');
  if (report.stance.confidence == null) add('confidence-missing', 'stance.confidence 必须是 0 到 1 的数字。');
  if (!report.stance.reason) add('stance-reason-missing', '必须说明为什么持这个倾向。');

  if (!report.framework.name) add('framework-missing', '必须选择适合该领域的分析框架。');
  if (report.framework.id && !FRAMEWORK_IDS.has(report.framework.id)) add('framework-unknown', '未知框架 id：' + report.framework.id + '。请使用目录 id 或 no_framework / custom。');
  if (!report.framework.id) add('framework-id-missing', '建议填写 framework.id；no_framework 和 custom 也必须显式填写。', 'warning');
  if (report.framework.id === 'custom' && /^(custom|自定义领域框架|自定义框架)$/i.test(report.framework.name)) add('custom-name-missing', 'custom 框架必须在 name 写清具体方法（如 IRAC、SCOR、FMEA），不能只写 custom。');
  if (!report.framework.why) add('framework-why-missing', '必须说明为什么这个框架适合当前问题。');
  if (!report.framework.limitation) add('framework-limitation-missing', '必须说明这个框架可能漏掉什么。');
  if (!report.key_judgments.length) add('judgments-missing', '至少要有一条关键判断 key_judgments。');
  for (const j of report.key_judgments) {
    if (!j.statement) add('judgment-statement-missing', '判断 ' + j.id + ' 缺少 statement。');
    if (!j.falsifier) add('falsifier-missing', '判断 ' + j.id + ' 缺少什么情况下会被推翻。');
  }
  if (!report.strongest_countercase.argument) add('countercase-missing', '必须写出最强反方，而不是只写无关风险。');
  if (!report.strongest_countercase.response) add('countercase-response-missing', '必须正面回应最强反方。');
  if (requireRecommendation) {
    if (!report.recommendation.action) add('recommendation-missing', '必须给出明确行动建议。');
    if (!report.recommendation.conditions) add('recommendation-conditions-missing', '建议必须写明前提条件。');
    if (!report.recommendation.downside) add('recommendation-downside-missing', '建议必须写明下行风险或代价。');
    if (!report.recommendation.stop_condition) add('recommendation-stop-missing', '建议必须写明停止条件或复盘触发条件。');
  }
  return { ok: issues.filter((i) => i.severity !== 'warning').length === 0, report, issues, version: ANALYSIS_VERSION };
}


export function formatAnalysisBrief(raw) {
  const a = raw && raw.version === ANALYSIS_VERSION ? raw : normalizeAnalysis(raw);
  const kjs = a.key_judgments.map((j) => {
    const lines = ['- ' + j.id + ': ' + j.statement];
    if (j.basis) lines.push('  依据: ' + j.basis);
    lines.push('  置信度: ' + j.confidence);
    if (j.falsifier) lines.push('  证伪条件: ' + j.falsifier);
    return lines.join('\n');
  }).join('\n');
  const indicators = a.recommendation.leading_indicators.length
    ? '\n- 领先指标: ' + a.recommendation.leading_indicators.join('；')
    : '';
  return [
    '## 必守观点契约（不得改写成平衡表述）',
    '- 核心判断: ' + a.bottom_line,
    '- 明确倾向: ' + a.stance.direction + '；置信度 ' + a.stance.confidence + '；理由: ' + a.stance.reason,
    '- 分析框架: ' + a.framework.name + (a.framework.id ? ' (' + a.framework.id + ')' : ''),
    '  为什么适合: ' + a.framework.why,
    '  框架局限: ' + a.framework.limitation,
    '### 关键判断',
    kjs || '（缺失）',
    '### 最强反方与回应',
    '- 反方: ' + a.strongest_countercase.argument,
    '- 回应: ' + a.strongest_countercase.response,
    '### 行动建议',
    '- 动作: ' + a.recommendation.action,
    '- 前提条件: ' + a.recommendation.conditions,
    '- 上行空间: ' + (a.recommendation.upside || '未说明'),
    '- 下行风险/代价: ' + a.recommendation.downside,
    '- 停止/复盘条件: ' + a.recommendation.stop_condition + indicators,
    a.unresolved.length ? '- 未解决项: ' + a.unresolved.join('；') : '',
    '',
    '写作规则:',
    '- 先写结论，再写论证；不得把判断改写成材料摘要。',
    '- 事实必须有据；推断和判断可以超出原文，但必须明确标出依据、反方和证伪条件。',
    '- 不允许用视情况而定或需要进一步研究替代当前判断。',
    '- 风险必须写，但风险不是不表态的理由。',
  ].filter(Boolean).join('\n');
}

