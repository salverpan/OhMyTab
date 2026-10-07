/**
 * 工作区 v2 迁移：来源/笔记/产出 + provenance。
 * 幂等；先完成兼容字段和 artifact 回填，最后才删除已废弃资产数据。
 */

import { normalizeEntryRecord } from './source-model.js';
import { migrateArtifactProvenance } from './artifact-store.js';
import { canVerifySources, normalizeSource } from './notebook.js';

export const WORKSPACE_SCHEMA_VERSION = 2;
const VERSION_KEY = 'workspaceSchemaVersion';

let running = null;

function isEntryKey(key) {
  return String(key).startsWith('entries_');
}

export function migrateEntryArrays(snapshot = {}) {
  const updates = {};
  for (const [key, value] of Object.entries(snapshot)) {
    if (!isEntryKey(key) || !Array.isArray(value)) continue;
    updates[key] = value.map(normalizeEntryRecord);
  }
  return updates;
}

export async function ensureWorkspaceMigration() {
  if (running) return running;
  running = (async () => {
    if (typeof chrome === 'undefined' || !chrome.storage?.local) return { skipped: true };
    const snapshot = await chrome.storage.local.get(null);
    const version = Number(snapshot[VERSION_KEY]) || 0;
    if (version >= WORKSPACE_SCHEMA_VERSION) return { version, migrated: false };

    const updates = migrateEntryArrays(snapshot);
    if (Object.keys(updates).length) await chrome.storage.local.set(updates);
    const artifactResult = await migrateArtifactProvenance();
    const notebookUpdates = {};
    for (const [key, value] of Object.entries(snapshot)) {
      if (!key.startsWith('notebook_') || !Array.isArray(value)) continue;
      const pid = key.slice('notebook_'.length) || 'default';
      notebookUpdates[key] = [];
      for (const note of value) {
        const sources = (note.sources || []).map(normalizeSource).filter(Boolean);
        const canVerify = note.status === 'verified'
          ? await canVerifySources(pid, sources)
          : false;
        notebookUpdates[key].push({
          ...note,
          sources,
          status: note.status === 'verified' && !canVerify ? 'open' : note.status,
        });
      }
    }
    if (Object.keys(notebookUpdates).length) await chrome.storage.local.set(notebookUpdates);

    // 用户已确认旧资产不迁移、不归档；相关折叠状态也一并丢弃。
    const obsoleteKeys = Object.keys(snapshot).filter((key) =>
      key.startsWith('assets_') || key.startsWith('wsTrunks_'));
    if (obsoleteKeys.length) await chrome.storage.local.remove(obsoleteKeys);

    await chrome.storage.local.set({ [VERSION_KEY]: WORKSPACE_SCHEMA_VERSION });
    return {
      version: WORKSPACE_SCHEMA_VERSION,
      migrated: true,
      entryStores: Object.keys(updates).length,
      notebookStores: Object.keys(notebookUpdates).length,
      artifacts: artifactResult.updated || 0,
      removedKeys: obsoleteKeys.length,
    };
  })().catch((error) => {
    running = null;
    throw error;
  });
  return running;
}
