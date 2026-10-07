import { CHECK_MAX_CLAIMS } from '../limits.js';
import { getEntries } from '../storage.js';
import { verifyClaimCitations } from './citation.js';
import { judgeEntailment } from './entailment.js';
import { independentSources } from './independence.js';

export const CHECKER_VERSION = 'citecat-check-v2';

function newCheckRunId() {
  return `chk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function countByVerdict(claims) {
  const counts = {};
  for (const item of claims) counts[item.verdict] = (counts[item.verdict] || 0) + 1;
  return counts;
}

export function deriveClaimVerdict(citationResult, entailment) {
  if (citationResult.citation !== 'citation-pass') return citationResult.citation;
  if (!entailment || entailment.verdict === 'unclear') return 'source-unverified';
  if (entailment.verdict === 'overclaim') return 'overclaim';
  if (entailment.verdict === 'contradicts') return 'source-conflict';
  return independentSources(citationResult.passed).count >= 2 ? 'cross-source-pass' : 'entailment-pass';
}

/** 来源条目的发布方名称（AI 摘要阶段写入 entry.source / provenance.publisher）。 */
async function loadPublisherResolver(projectId) {
  let entries = [];
  try { entries = await getEntries(projectId || 'default'); } catch (_) { return null; }
  const byId = new Map();
  for (const e of entries || []) {
    const name = (e && e.provenance && e.provenance.publisher) || (e && e.source) || '';
    if (e && e.id && name) byId.set(e.id, name);
  }
  if (!byId.size) return null;
  return (doc) => byId.get(doc.sourceEntryId) || '';
}

/**
 * @param {object} report validateTaskReport 之后的报告
 * @param {object} opts
 * @param {object} opts.apiConfig      撰写报告的模型（审查模型未配置时兜底）
 * @param {object} [opts.judgeApiConfig] 独立审查模型；与撰写者同一模型时判定错误是相关的
 */
export async function runCheckPipeline(report, {
  projectId = '',
  apiConfig = null,
  judgeApiConfig = null,
  signal,
  ctx,
} = {}) {
  const claims = (report?.claims || []).slice(0, CHECK_MAX_CLAIMS);
  const publisherOf = await loadPublisherResolver(projectId);
  const citationResults = [];
  for (const claim of claims) {
    citationResults.push(await verifyClaimCitations(claim, { projectId, publisherOf }));
  }

  const judgeCfg = judgeApiConfig && judgeApiConfig.apiKey ? judgeApiConfig : apiConfig;
  const sameModelJudge = !judgeApiConfig || !judgeApiConfig.apiKey
    || (String(judgeApiConfig.model || '') === String(apiConfig?.model || '')
      && String(judgeApiConfig.baseUrl || '') === String(apiConfig?.baseUrl || ''));

  const judgeItems = citationResults
    .filter((item) => item.citation === 'citation-pass')
    .map((item) => ({
      id: item.claim.id,
      claim: item.claim.claim,
      attribution: item.claim.attribution || '',
      modality: item.claim.modality || 'reported',
      quotes: item.passed.map((e) => e.evidence.quote),
    }));
  const judged = await judgeEntailment(judgeItems, judgeCfg, signal, ctx);

  const checkedClaims = citationResults.map((item) => {
    const entailment = judged.verdicts.get(item.claim.id) || null;
    const verdict = deriveClaimVerdict(item, entailment);
    const citationInfrastructure = item.evidence.some((e) => e.infrastructure);
    return {
      id: item.claim.id,
      claim: item.claim.claim,
      attribution: item.claim.attribution || '',
      modality: item.claim.modality || 'reported',
      eventTime: item.claim.event_time || '',
      confidence: item.claim.confidence,
      verdict,
      citation: item.citation,
      entailment: entailment?.verdict || 'skipped',
      independentSources: independentSources(item.passed).count,
      reason: entailment?.reason || item.evidence.find((e) => e.status !== 'citation-pass')?.reason || '',
      infrastructureError: citationInfrastructure || !!entailment?.infrastructure,
      evidence: item.evidence,
    };
  });

  const artifactHashes = {};
  for (const claim of checkedClaims) {
    for (const item of claim.evidence) {
      if (item.contentHash && item.evidence?.doc_id) artifactHashes[item.evidence.doc_id] = item.contentHash;
    }
  }
  const contentFailures = checkedClaims.filter((c) =>
    ['citation-fail', 'overclaim', 'source-conflict'].includes(c.verdict)
    || (c.verdict === 'source-unverified' && !c.infrastructureError));
  const infrastructureFailures = checkedClaims.filter((c) => c.infrastructureError);

  return {
    checkRunId: newCheckRunId(),
    checkerVersion: CHECKER_VERSION,
    checkedAt: Date.now(),
    judgeModel: judgeCfg?.model || '',
    sameModelJudge,
    taskClaimCount: claims.length,
    claims: checkedClaims,
    counts: countByVerdict(checkedClaims),
    artifactHashes,
    usage: judged.usage,
    contentFailure: contentFailures.length > 0,
    infrastructureFailure: infrastructureFailures.length > 0,
  };
}

export function verificationForMain(verification) {
  if (!verification) return null;
  return {
    check_run_id: verification.checkRunId,
    checker: verification.checkerVersion,
    checked_at: verification.checkedAt,
    ...(verification.sameModelJudge
      ? { judge_note: '审查与撰写是同一模型，蕴含判定可能偏宽；高影响结论请人工点开锚点复核。' }
      : {}),
    counts: verification.counts,
    content_failure: verification.contentFailure,
    infrastructure_failure: verification.infrastructureFailure,
    claims: verification.claims.map((c) => ({
      id: c.id,
      claim: c.claim,
      ...(c.attribution ? { attribution: c.attribution } : {}),
      modality: c.modality || 'reported',
      verdict: c.verdict,
      independent_sources: Number(c.independentSources) || 0,
      reason: c.reason,
      sources: c.evidence
        .filter((e) => e.status === 'citation-pass')
        .map((e) => `${e.evidence.doc_id}#${e.evidence.anchor}`),
      failure_evidence: c.evidence
        .filter((e) => e.status !== 'citation-pass')
        .map((e) => ({
          source: `${e.evidence?.doc_id || ''}#${e.evidence?.anchor || ''}`,
          reason: e.reason,
          excerpt: e.excerpt || '',
        })),
    })),
  };
}
