/**
 * 来源 / 产出与证据可信边界的纯逻辑。
 *
 * `source` 历史上同时承担「出版方」与「AI 生成」类型标记。新代码只以
 * entryType/provenance 判断类型；旧字段仅在迁移与兼容读取时推断一次。
 */

export const ENTRY_TYPE_SOURCE = 'source';
export const ENTRY_TYPE_OUTPUT = 'output';

const LEGACY_TYPE_SOURCES = new Set(['AI 生成', 'upload', 'collect']);

export function inferEntryType(entry = {}) {
  if (entry.entryType === ENTRY_TYPE_OUTPUT || entry.entryType === ENTRY_TYPE_SOURCE) {
    return entry.entryType;
  }
  return entry.source === 'AI 生成' ? ENTRY_TYPE_OUTPUT : ENTRY_TYPE_SOURCE;
}

/** 工作区“清空某主干”时受影响的 Entry；图片按 entryType=source 随来源一起清。 */
export function selectEntriesForTrunkClear(entries = [], trunk = 'all') {
  const clearSources = trunk === 'sources' || trunk === 'all';
  const clearOutputs = trunk === 'outputs' || trunk === 'all';
  if (!clearSources && !clearOutputs) return [];
  return (Array.isArray(entries) ? entries : []).filter((entry) => {
    const type = inferEntryType(entry);
    return (clearSources && type === ENTRY_TYPE_SOURCE)
      || (clearOutputs && type === ENTRY_TYPE_OUTPUT);
  });
}

export function inferEntryProvenanceType(entry = {}) {
  if (entry.provenance && entry.provenance.type) return String(entry.provenance.type);
  if (inferEntryType(entry) === ENTRY_TYPE_OUTPUT) return 'generated';
  if (entry.kind === 'snippet') return 'snippet';
  if (entry.kind === 'image') return 'upload';
  if (entry.kind === 'document' || entry.source === 'upload') return 'upload';
  if (entry.feedItemId || String(entry.url || '').startsWith('feed-item://')) return 'rss';
  if (/^https?:\/\//i.test(String(entry.url || ''))) return 'web';
  return 'unknown';
}

export function normalizeEntryRecord(entry = {}) {
  const entryType = inferEntryType(entry);
  const type = inferEntryProvenanceType(entry);
  const old = entry.provenance && typeof entry.provenance === 'object' ? entry.provenance : {};
  const publisher = old.publisher
    || (!LEGACY_TYPE_SOURCES.has(String(entry.source || '')) ? String(entry.source || '') : '');
  const trustClass = entryType === ENTRY_TYPE_OUTPUT
    ? 'derived'
    : (type === 'unknown' ? 'unverified' : 'source');
  return {
    ...entry,
    entryType,
    provenance: {
      type,
      publisher,
      tier: old.tier || entry.sourceTier || '',
      canonicalUrl: old.canonicalUrl || (/^https?:\/\//i.test(String(entry.url || '')) ? entry.url : ''),
      capturedAt: Number(old.capturedAt || entry.createdAt) || Date.now(),
      feedItemId: old.feedItemId || entry.feedItemId || '',
      trustClass: old.trustClass || trustClass,
      ...old,
    },
  };
}

export function inferArtifactProvenance(doc = {}) {
  const type = String(doc.provenanceType || (
    doc.kind === 'text' ? 'derived'
      : doc.kind === 'entry' ? 'entry'
        : /^https?:\/\//i.test(String(doc.url || '')) ? 'web'
          : 'unknown'
  ));
  const trustClass = String(doc.trustClass || (
    type === 'derived' || type === 'generated' || doc.kind === 'text'
      ? 'derived'
      : (type === 'unknown' ? 'unverified' : 'source')
  ));
  return { type, trustClass };
}

export function isCitationEligibleArtifact(doc) {
  if (!doc) return false;
  const { trustClass } = inferArtifactProvenance(doc);
  return trustClass === 'source'
    && doc.kind !== 'text'
    && doc.provenanceType !== 'generated'
    && (!!String(doc.fullText || doc.text || '').trim() || Number(doc.chars) > 0);
}

/** 子代理 write_research_artifact / analyst_memo 落的长笔记，应出现在工作区「笔记」。 */
export function isResearchNoteArtifact(doc = {}) {
  const via = String(doc.via || '');
  if (via === 'research-artifact' || via === 'analyst-memo') return true;
  const url = String(doc.url || '');
  return url.startsWith('artifact://research/') || url.startsWith('artifact://analyst-memo/');
}

export function researchNoteBadge(doc = {}) {
  return String(doc.via || '') === 'analyst-memo' ? '分析备忘' : '研究笔记';
}
