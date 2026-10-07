/* ================================================================
 * 标注存储层（荧光笔 / 下划线 / 元素标注）
 * 存储：chrome.storage.local，按归一化 URL 分 key，写操作串行化
 * 锚点：W3C TextQuoteSelector（text + prefix + suffix）+ 归一化偏移
 *   —— 单一锚点脆弱，多层信息用于重放时交叉校验（与 Web-Annotator 同思路）
 * ================================================================ */

const INDEX_KEY = 'annotations_index';

const _writeQueues = new Map(); // key -> 链尾 Promise（与 storage.js 同款防覆盖队列）

function _enqueue(key, fn) {
  const prev = _writeQueues.get(key) || Promise.resolve();
  const next = prev.then(() => fn(), () => fn());
  _writeQueues.set(key, next.then(() => undefined, () => undefined));
  return next;
}

/** 归一化 URL：去掉 hash（#锚点变化不算新页面），作为存储 key 与匹配键 */
export function normalizeUrl(url) {
  try {
    return String(url).split('#')[0];
  } catch (_) {
    return String(url);
  }
}

function annKey(url) {
  return `annotations_${normalizeUrl(url)}`;
}

export async function getAnnotationsForUrl(url) {
  const key = annKey(url);
  const { [key]: list } = await chrome.storage.local.get(key);
  return list ?? [];
}

export async function saveAnnotation(url, ann) {
  const key = annKey(url);
  return _enqueue(key, async () => {
    const { [key]: list } = await chrome.storage.local.get(key);
    const next = list ?? [];
    const idx = next.findIndex((a) => a.id === ann.id);
    if (idx === -1) next.unshift(ann);
    else next[idx] = { ...next[idx], ...ann };
    await chrome.storage.local.set({ [key]: next });
    await _touchIndex(url);
  });
}

/** 收藏入库后回填 entryId（网页高亮 ⇄ 库内条目 双向关联） */
export async function setAnnotationEntryId(url, annotationId, entryId) {
  const key = annKey(url);
  return _enqueue(key, async () => {
    const { [key]: list } = await chrome.storage.local.get(key);
    const ann = (list ?? []).find((a) => a.id === annotationId);
    if (ann) {
      ann.entryId = entryId || null;
      await chrome.storage.local.set({ [key]: list });
    }
  });
}

export async function deleteAnnotation(url, id) {
  const key = annKey(url);
  return _enqueue(key, async () => {
    const { [key]: list } = await chrome.storage.local.get(key);
    const next = (list ?? []).filter((a) => a.id !== id);
    await chrome.storage.local.set({ [key]: next });
    if (next.length === 0) await chrome.storage.local.remove(key);
    await _touchIndex(url);
  });
}

/** 管理视图用：全部标注（按 URL 分组） */
export async function getAllAnnotations() {
  const { [INDEX_KEY]: index } = await chrome.storage.local.get(INDEX_KEY);
  const urls = Array.isArray(index) ? index : [];
  const groups = [];
  for (const u of urls) {
    const list = await getAnnotationsForUrl(u);
    if (list.length > 0) groups.push({ url: u, items: list });
  }
  return groups;
}

async function _touchIndex(url) {
  const n = normalizeUrl(url);
  return _enqueue(INDEX_KEY, async () => {
    const { [INDEX_KEY]: index } = await chrome.storage.local.get(INDEX_KEY);
    const urls = Array.isArray(index) ? index : [];
    const { [annKey(n)]: list } = await chrome.storage.local.get(annKey(n));
    const count = (list ?? []).length;
    const rest = urls.filter((u) => u !== n);
    if (count > 0) rest.unshift(n);
    await chrome.storage.local.set({ [INDEX_KEY]: rest });
  });
}
