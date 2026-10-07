import { getArtifact, readSection } from '../artifact-store.js';
import { isCitationEligibleArtifact } from '../source-model.js';
import { evidenceExcerpt, findQuoteInText } from './quote-match.js';
import { sourceIdentityOf } from './independence.js';

export function selectorFromAnchor(anchor) {
  const value = String(anchor || '').replace(/^.*#/, '').trim();
  if (/^c\d+$/i.test(value)) return { chunk: Number(value.slice(1)) };
  if (/^p\d+$/i.test(value)) return { page: Number(value.slice(1)) };
  if (/^o\d+$/i.test(value)) return { offset: Number(value.slice(1)), maxChars: 12000 };
  return null;
}

function sourceIdentity(doc, publisherOf) {
  let publisher = '';
  try { publisher = (typeof publisherOf === 'function' && publisherOf(doc)) || ''; } catch (_) { /* ignore */ }
  return sourceIdentityOf({ publisher, url: doc.url, fallback: doc.sourceEntryId || doc.docId });
}

async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(String(text || ''));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyEvidence(evidence, { projectId = '', publisherOf = null } = {}) {
  const docId = String(evidence.doc_id || '');
  const selector = selectorFromAnchor(evidence.anchor);
  if (!docId || !selector) {
    return { status: 'source-unverified', reason: 'missing-or-invalid-anchor', evidence };
  }
  let doc;
  try {
    doc = await getArtifact(docId);
  } catch (error) {
    return {
      status: 'source-unverified',
      reason: 'artifact-read-failed',
      evidence,
      infrastructure: true,
      error: error?.message || String(error),
    };
  }
  if (!doc || (projectId && String(doc.projectId || 'default') !== String(projectId || 'default'))) {
    return { status: 'source-unverified', reason: 'unknown-doc', evidence };
  }
  if (!isCitationEligibleArtifact(doc)) {
    return {
      status: 'source-unverified',
      reason: `ineligible-${doc.trustClass || doc.kind || 'source'}`,
      evidence,
      contentHash: doc.contentHash || '',
    };
  }
  if (doc.contentHash) {
    try {
      const actualHash = await sha256Hex(doc.fullText || '');
      if (actualHash !== doc.contentHash) {
        return {
          status: 'source-unverified',
          reason: 'content-hash-mismatch',
          evidence,
          contentHash: doc.contentHash,
        };
      }
    } catch (error) {
      return {
        status: 'source-unverified',
        reason: 'content-hash-check-failed',
        evidence,
        contentHash: doc.contentHash,
        infrastructure: true,
        error: error?.message || String(error),
      };
    }
  }
  let section;
  try {
    section = await readSection(docId, selector);
  } catch (error) {
    return {
      status: 'source-unverified',
      reason: 'section-read-failed',
      evidence,
      contentHash: doc.contentHash || '',
      infrastructure: true,
      error: error?.message || String(error),
    };
  }
  if (section.error) {
    return {
      status: 'source-unverified',
      reason: 'unreadable-anchor',
      evidence,
      error: section.error,
      infrastructure: true,
    };
  }
  const match = findQuoteInText(section.text, evidence.quote, evidence);
  if (!match.matched) {
    return {
      status: 'citation-fail',
      reason: 'quote-mismatch',
      evidence,
      checkedAnchor: section.anchor,
      contentHash: doc.contentHash || '',
      excerpt: evidenceExcerpt(section.text),
    };
  }
  return {
    status: 'citation-pass',
    reason: match.matchType,
    evidence,
    checkedAnchor: section.anchor,
    contentHash: doc.contentHash || '',
    sourceIdentity: sourceIdentity(doc, publisherOf),
    sourceUrl: doc.url || '',
    match,
  };
}

export async function verifyClaimCitations(claim, ctx = {}) {
  const evidence = [];
  for (const item of claim.evidence || []) evidence.push(await verifyEvidence(item, ctx));
  const passed = evidence.filter((e) => e.status === 'citation-pass');
  let citation = 'citation-pass';
  if (!passed.length) {
    citation = evidence.some((e) => e.status === 'citation-fail') ? 'citation-fail' : 'source-unverified';
  }
  return { claim, citation, evidence, passed };
}
