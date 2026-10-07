/**
 * 单条 Entry 的统一级联删除/撤销。
 * 覆盖 Entry、匹配的证据快照、原始文件，以及引用这些快照的笔记核验状态。
 */

import { deleteEntry, saveEntry } from './storage.js';
import { getDocFile, saveDocFile, deleteDocFile } from './doc-store.js';
import {
  dumpArtifacts, deleteArtifactsMatching, putArtifact,
} from './artifact-store.js';
import { listNotes, updateNote } from './notebook.js';

function entryDocId(entry) {
  return String(entry?.docId || entry?.id || '');
}

export function artifactMatchesEntry(doc, entry) {
  const docId = entryDocId(entry);
  const entryId = String(entry?.id || '');
  const url = String(entry?.url || '');
  return !!doc && (
    (!!docId && String(doc.docId || '') === docId)
    || (!!entryId && String(doc.sourceEntryId || '') === entryId)
    || (!!url && String(doc.url || '') === url)
  );
}

export function noteReferencesEntry(note, entry, artifactIds = []) {
  const ids = new Set([
    String(entry?.id || ''),
    entryDocId(entry),
    ...artifactIds.map(String),
  ].filter(Boolean));
  const url = String(entry?.url || '');
  return (note?.sources || []).some((source) =>
    (source?.doc_id && ids.has(String(source.doc_id)))
    || (!!url && String(source?.url || '') === url));
}

export async function deleteEntryCascade(entry, projectId = 'default') {
  if (!entry?.id) return { error: '缺少 Entry id。' };
  const pid = String(projectId || 'default');
  const docId = entryDocId(entry);
  const artifacts = (await dumpArtifacts({ projectId: pid }).catch(() => []))
    .filter((doc) => artifactMatchesEntry(doc, entry));
  const artifactIds = artifacts.map((doc) => doc.docId);
  const fileBytes = docId ? await getDocFile(docId).catch(() => null) : null;
  const notes = await listNotes(pid);
  const affectedNotes = notes.filter((note) => noteReferencesEntry(note, entry, artifactIds));

  await deleteEntry(entry.id, pid);
  await deleteArtifactsMatching({
    projectId: pid,
    url: entry.url || '',
    docId,
    sourceEntryId: entry.id,
  }).catch(() => {});
  if (docId) await deleteDocFile(docId).catch(() => {});
  for (const note of affectedNotes) {
    if (note.status === 'verified') await updateNote(pid, note.id, { status: 'open' }).catch(() => {});
  }

  return {
    ok: true,
    projectId: pid,
    entry: { ...entry },
    docId,
    fileBytes,
    artifacts,
    notes: affectedNotes.map((note) => ({ ...note })),
  };
}

export async function restoreEntryCascade(snapshot) {
  if (!snapshot?.entry?.id) return { error: '删除快照无效。' };
  const pid = String(snapshot.projectId || 'default');
  await saveEntry(snapshot.entry, pid);
  if (snapshot.docId && snapshot.fileBytes) {
    await saveDocFile(snapshot.docId, snapshot.fileBytes).catch(() => {});
  }
  for (const doc of snapshot.artifacts || []) {
    await putArtifact({
      kind: doc.kind || 'page',
      url: doc.url || '',
      title: doc.title || '',
      text: doc.fullText || '',
      meta: {
        site: doc.site || '',
        charsTotal: doc.charsTotal,
        partial: doc.partial,
        pages: doc.pages,
        pageOffsets: doc.pageOffsets,
        origin: doc.origin || '',
        via: doc.via || '',
        projectId: doc.projectId || pid,
        provenanceType: doc.provenanceType || '',
        trustClass: doc.trustClass || '',
        sourceEntryId: doc.sourceEntryId || snapshot.entry.id,
        capturedAt: doc.capturedAt || doc.createdAt,
      },
    }).catch(() => {});
  }
  for (const note of snapshot.notes || []) {
    await updateNote(pid, note.id, {
      claim: note.claim,
      confidence: note.confidence,
      status: note.status,
      tags: note.tags,
      sources: note.sources,
    }).catch(() => {});
  }
  return { ok: true };
}
