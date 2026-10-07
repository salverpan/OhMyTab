/**
 * 图表图片登记表 —— plot_chart(deliver="docx") 光栅化产物的元数据。
 *
 * PNG 字节本身进 doc-store（键 `chart:<chartId>`，与文档原件同一 IDB）；
 * 这里只存小的元数据：题注、来源行、逻辑尺寸、时间。
 * 生成/重建 docx 时按 markdown 里的 `![说明](chart:<id>)` 引用取回两者。
 *
 * 存储：`chrome.storage.local` 的 `chartRefs`（一个全局字典，不按项目分——
 * chart id 本身唯一，同一张图可能被不同项目的文档引用）。
 * 上限 200 条：超限按时间淘汰最旧的，并顺手删掉它的 PNG 字节（否则 IDB 只增不减）。
 */

import { deleteDocFile } from './doc-store.js';

const KEY = 'chartRefs';
const MAX_REFS = 200;

/** doc-store 里的键（与 markdown 引用里的 `chart:<id>` 同形，取字节时直接拼）。 */
export function chartBlobKey(chartId) {
  return 'chart:' + String(chartId || '');
}

export async function loadChartRefs() {
  try {
    const { [KEY]: refs } = await chrome.storage.local.get(KEY);
    return refs && typeof refs === 'object' ? refs : {};
  } catch (_) {
    return {};
  }
}

export async function getChartRef(chartId) {
  const refs = await loadChartRefs();
  return refs[String(chartId || '')] || null;
}

/** 登记一张图表图片（同 id 覆盖）。超限时淘汰最旧的并删除其 PNG。 */
export async function saveChartRef(chartId, meta = {}) {
  const id = String(chartId || '');
  if (!id) return null;
  const refs = await loadChartRefs();
  refs[id] = {
    caption: String(meta.caption || '').slice(0, 120),
    source: String(meta.source || '').slice(0, 160),
    width: Number(meta.width) || 480,
    height: Number(meta.height) || 270,
    at: Date.now(),
  };
  const ids = Object.keys(refs);
  if (ids.length > MAX_REFS) {
    ids.sort((a, b) => (refs[a].at || 0) - (refs[b].at || 0));
    for (const old of ids.slice(0, ids.length - MAX_REFS)) {
      delete refs[old];
      await deleteDocFile(chartBlobKey(old)).catch(() => {});
    }
  }
  await chrome.storage.local.set({ [KEY]: refs });
  return refs[id];
}

/** 删除登记（连同 PNG 字节）。 */
export async function dropChartRef(chartId) {
  const id = String(chartId || '');
  const refs = await loadChartRefs();
  if (!refs[id]) return false;
  delete refs[id];
  await chrome.storage.local.set({ [KEY]: refs });
  await deleteDocFile(chartBlobKey(id)).catch(() => {});
  return true;
}

export { MAX_REFS };
