const MAX_TAGS = 50;

function libKey(projectId) {
  return `taglib_${projectId || 'default'}`;
}

function normalizeTagName(tag) {
  return String(tag || '')
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ');
}

function tagMatchKey(tag) {
  return normalizeTagName(tag).toLowerCase();
}

function findTagKey(lib, tag) {
  const wanted = tagMatchKey(tag);
  return Object.keys(lib).find((name) => tagMatchKey(name) === wanted) || null;
}

function uniqueTags(tags) {
  const seen = new Set();
  const result = [];
  for (const tag of tags || []) {
    const name = normalizeTagName(tag);
    const key = tagMatchKey(name);
    if (!name || seen.has(key)) continue;
    seen.add(key);
    result.push(name);
  }
  return result;
}

export async function getTagLibrary(projectId) {
  const key = libKey(projectId);
  const { [key]: lib } = await chrome.storage.local.get(key);
  return lib || {};
}

async function saveTagLibrary(projectId, lib) {
  const key = libKey(projectId);
  await chrome.storage.local.set({ [key]: lib });
}

export async function recordTags(tags, projectId) {
  if (!tags || tags.length === 0) return;

  const lib = await getTagLibrary(projectId);
  for (const t of tags) {
    const name = normalizeTagName(t);
    if (!name) continue;
    const existing = findTagKey(lib, name) || name;
    lib[existing] = (lib[existing] || 0) + 1;
  }

  await saveTagLibrary(projectId, trimLibrary(lib));
}

export async function getTopTags(projectId, limit = 50) {
  const lib = await getTagLibrary(projectId);
  const sorted = Object.entries(lib)
    .sort((a, b) => b[1] - a[1])
    .slice(0, Math.min(limit, MAX_TAGS));
  return sorted.map(([name]) => name);
}

/**
 * Merge fromTag into toTag in the library only.
 * Returns the updated library. Caller is responsible for updating entries.
 */
export async function mergeTags(projectId, fromTag, toTag) {
  const lib = await getTagLibrary(projectId);
  const fromKey = findTagKey(lib, fromTag);
  const toName = normalizeTagName(toTag);
  if (!toName) return lib;

  const toKey = findTagKey(lib, toName) || toName;
  if (!fromKey) {
    lib[toKey] = lib[toKey] || 0;
    await saveTagLibrary(projectId, lib);
    return lib;
  }
  if (fromKey === toKey) return lib;

  lib[toKey] = (lib[toKey] || 0) + lib[fromKey];
  delete lib[fromKey];
  await saveTagLibrary(projectId, lib);
  return lib;
}

/**
 * Replace fromTag with toTag across all entries. Returns modified entries array.
 */
export function replaceTagInEntries(entries, fromTag, toTag) {
  let changed = false;
  const fromKey = tagMatchKey(fromTag);
  const toName = normalizeTagName(toTag);
  if (!fromKey || !toName) return false;

  for (const e of entries) {
    if (!Array.isArray(e.tags)) continue;
    const next = uniqueTags(e.tags.map((t) => (tagMatchKey(t) === fromKey ? toName : t)));
    if (next.length !== e.tags.length || next.some((t, i) => t !== e.tags[i])) changed = true;
    e.tags = next;
  }
  return changed;
}

export function applyTagMergesToTags(tags, merges) {
  let next = uniqueTags(tags);
  for (const pair of merges || []) {
    if (!Array.isArray(pair) || pair.length !== 2) continue;
    const [fromTag, toTag] = pair;
    const fromKey = tagMatchKey(fromTag);
    const toName = normalizeTagName(toTag);
    if (!fromKey || !toName) continue;
    next = uniqueTags(next.map((tag) => (tagMatchKey(tag) === fromKey ? toName : tag)));
  }
  return next;
}

function trimLibrary(lib) {
  const entries = Object.entries(lib);
  if (entries.length <= MAX_TAGS) return lib;

  const sorted = entries.sort((a, b) => b[1] - a[1]);
  const kept = sorted.slice(0, MAX_TAGS);
  const result = {};
  for (const [name, count] of kept) {
    result[name] = count;
  }
  return result;
}
