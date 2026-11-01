/**
 * 「删库」级联删除与撤销 —— 删掉一个项目时，把它名下的内容一次清干净。
 *
 * 一个库的内容散在四处，任何一处漏删都等于留孤儿（既占空间、又没有任何入口找回）：
 *   chrome.storage.local  entries_<pid> / notebook_<pid> / taglib_<pid> / chatSession_<pid>
 *                         heartbeatTasks 里该项目的条目（全局数组，按 task.projectId 抽走）
 *   chrome.storage.sync   projConfig_<pid>
 *   IndexedDB citecat-docs      文档原件（key = 条目 id / entry.docId）
 *   IndexedDB citecat-artifacts 工作区材料（按 projectId 归属）
 *   chrome.storage.local  库内文档上的标注（doc://lib/<docId>）
 *
 * 保留：AI 记忆（agentMemories）、订阅源与新闻（feed-db）、网页标注。
 * 撤销：删除前读内存快照；原件字节受 MAX_UNDO_BYTES 限制，超限只恢复记录不恢复字节。
 */

import { getDocFile, saveDocFile, deleteDocFile } from './doc-store.js';
import { dumpArtifacts, deleteArtifactsByProject, putArtifact } from './artifact-store.js';
import { clearActivity } from './activity-log.js';
import { clearTrace } from './trace-log.js';
import { getAnnotationsForUrl, saveAnnotation, deleteAnnotation } from './annotations.js';
import { listHeartbeatTasks, purgeHeartbeatTasks, restoreHeartbeatTasks } from './heartbeat.js';

/** 撤销快照里最多保留多少原件字节（超过只恢复条目记录）。 */
const MAX_UNDO_BYTES = 64 * 1024 * 1024;

function localKeys(pid) {
  return ['entries_', 'notebook_', 'taglib_', 'chatSession_'].map((p) => p + (pid || 'default'));
}

function syncKeys(pid) {
  return [`projConfig_${pid || 'default'}`];
}

function docIdOf(entry) {
  return String((entry && (entry.docId || entry.id)) || '');
}

/** 库内文档的标注挂在 doc://lib/<docId> 上（与 reader.js 的 docUrl 同口径）。 */
function docUrlOf(docId) {
  return `doc://lib/${docId}`;
}

/** 读取一个项目的全部内容（不删）。 */
export async function snapshotProject(pid) {
  const id = pid || 'default';
  const local = await chrome.storage.local.get(localKeys(id)).catch(() => ({}));
  const sync = await chrome.storage.sync.get(syncKeys(id)).catch(() => ({}));
  const entries = Array.isArray(local[`entries_${id}`]) ? local[`entries_${id}`] : [];

  const docFiles = [];
  let bytes = 0;
  let omittedBytes = 0;
  for (const e of entries) {
    const docId = docIdOf(e);
    if (!docId) continue;
    const ab = await getDocFile(docId).catch(() => null);
    if (!ab) continue;
    if (bytes + ab.byteLength > MAX_UNDO_BYTES) { omittedBytes += ab.byteLength; continue; }
    bytes += ab.byteLength;
    docFiles.push({ docId, bytes: ab });
  }

  const annotations = [];
  for (const e of entries) {
    const docId = docIdOf(e);
    if (!docId) continue;
    const url = docUrlOf(docId);
    const list = await getAnnotationsForUrl(url).catch(() => []);
    if (list.length) annotations.push({ url, list });
  }

  const artifacts = await dumpArtifacts({ projectId: id }).catch(() => []);
  const heartbeatTasks = await listHeartbeatTasks(id).catch(() => []);

  return { pid: id, local, sync, entries, docFiles, omittedBytes, annotations, artifacts, heartbeatTasks };
}

/** 删除一个项目的全部内容，返回撤销快照。 */
export async function purgeProject(pid) {
  const id = pid || 'default';
  const snap = await snapshotProject(id);

  await chrome.storage.local.remove(localKeys(id)).catch(() => {});
  await chrome.storage.sync.remove(syncKeys(id)).catch(() => {});

  // 原件：快照里没留下字节的（超限/读失败）也要删——删库就该清干净
  const kept = new Set(snap.docFiles.map((f) => f.docId));
  for (const e of snap.entries) {
    const docId = docIdOf(e);
    if (!docId || kept.has(docId)) continue;
    await deleteDocFile(docId).catch(() => {});
  }
  for (const f of snap.docFiles) await deleteDocFile(f.docId).catch(() => {});

  for (const g of snap.annotations) {
    for (const a of g.list) await deleteAnnotation(g.url, a.id).catch(() => {});
  }

  const artifacts = await deleteArtifactsByProject(id).catch(() => 0);
  await clearActivity(id);
  await clearTrace(id);
  await purgeHeartbeatTasks(id).catch(() => []);
  return { ...snap, artifactCount: artifacts };
}

/** 撤销：把快照原样写回。 */
export async function restoreProject(snap) {
  if (!snap) return { ok: false };
  if (Object.keys(snap.local || {}).length) await chrome.storage.local.set(snap.local).catch(() => {});
  if (Object.keys(snap.sync || {}).length) await chrome.storage.sync.set(snap.sync).catch(() => {});
  for (const f of snap.docFiles || []) await saveDocFile(f.docId, f.bytes).catch(() => {});
  for (const g of snap.annotations || []) {
    for (const a of g.list) await saveAnnotation(g.url, a).catch(() => {});
  }
  await restoreHeartbeatTasks(snap.heartbeatTasks).catch(() => {});
  for (const d of snap.artifacts || []) {
    await putArtifact({
      kind: d.kind || 'page',
      url: d.url || '',
      title: d.title || '',
      text: d.fullText || '',
      meta: {
        site: d.site || '',
        charsTotal: d.charsTotal,
        partial: d.partial,
        pages: d.pages,
        pageOffsets: d.pageOffsets,
        origin: d.origin || '',
        projectId: d.projectId || snap.pid,
        provenanceType: d.provenanceType || '',
        trustClass: d.trustClass || '',
        sourceEntryId: d.sourceEntryId || '',
        capturedAt: d.capturedAt || d.createdAt,
      },
    }).catch(() => {});
  }
  return { ok: true, entries: (snap.entries || []).length };
}

/** 清空多个项目的内容（设置页「删除所有项目」会先调用这个，再从项目列表里拿掉非默认库）。返回可撤销的快照数组。 */
export async function purgeProjects(pids) {
  const snaps = [];
  for (const pid of pids || []) {
    snaps.push(await purgeProject(pid));
  }
  return snaps;
}

export async function restoreProjects(snaps) {
  for (const s of snaps || []) await restoreProject(s);
}
