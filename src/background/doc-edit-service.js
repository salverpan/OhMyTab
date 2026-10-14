/**
 * docx 编辑服务（SW 侧，2026-08-21 架构调整）。
 *
 * 设计（对齐 cc/Codex 的"文件即真相"模式）：
 *   - OOXML 手术引擎（doc-edit-word.js）在 SW 里无头运行（xmldom 提供 DOMParser），
 *     AI 的 doc_edit 直接改库内原件（citecat-docs IDB 按 docId 取/写），
 *     不再依赖"阅读器 tab 开着 + 编辑模式开着"——「不在编辑模式」这一类错误整体消失。
 *   - 阅读器退化为渲染器 + 修订面板：SW 每次编辑后广播 DOC_UPDATED{docId}，
 *     正在看该文档的阅读器页重渲染（renderChanges 显示修订痕迹）。
 *   - 每次成功编辑即持久化写回 IDB：SW 被杀 / 切换文档后从 IDB 重建引擎不丢改动。
 *   - docx 文本修改默认直接写入。track_changes=true 才走原生修订痕迹
 *     （w:ins/w:del + 批注），留给用户明确要求留痕、给别人审的时候。
 *   - 首次编辑某文档时附带 doc_digest（字符数/段落数/开头片段），模型据此
 *     知道自己在改什么（read-before-write 的轻量等价；find 定位失败即硬错，
 *     不会盲改）。
 *
 * 引擎是单实例模块（doc-edit-word.js / doc-edit-xlsx.js 模块级状态），这里按
 * activeDocId / activeXlsxId 键控：切换文档时用 IDB 最新字节重新 init。
 * xlsx 与 docx 一样无头改库内原件，不再依赖阅读器 Univer（阅读器仍可手动点「编辑」）。
 */
import * as word from '../lib/doc-edit-word.js';
import * as xlsx from '../lib/doc-edit-xlsx.js';
import * as textEd from '../lib/doc-edit-text.js';
import { markdownToDocxBuffer } from '../lib/create-docx.js';
import { extractLegacyDocText } from '../lib/legacy-doc.js';
import { getDocFile, saveDocFile } from '../lib/doc-store.js';
import { getEntries, updateEntry } from '../lib/storage.js';

let activeDocId = null;      // 当前 docx 引擎对应的 docId
let activeXlsxId = null;     // 当前 xlsx 引擎对应的 docId
let activeTextId = null;     // 当前 txt 引擎对应的 docId
const digestSent = new Set(); // 本 SW 生命周期内已发过首次摘要的 docId

/** SW 注入：当前项目 id 提供者（service-worker 的 getCurrentProject） */
let projectProvider = async () => 'default';
export function setProjectProvider(fn) {
  if (typeof fn === 'function') projectProvider = fn;
}

/** SW 注入：docx 内容变化后回调（广播 DOC_UPDATED 给阅读器 tab） */
let onDocUpdated = null;
export function setDocUpdatedListener(fn) {
  onDocUpdated = typeof fn === 'function' ? fn : null;
}

async function ensureEngine(docId) {
  if (activeDocId === docId) return;
  const ab = await getDocFile(docId);
  if (!ab) {
    throw new Error(`库内没有该文档的原件（doc_id=${String(docId).slice(0, 8)}…）。仅支持上传过 / AI 生成过的 docx；远程打开的文档请先采集入库`);
  }
  await word.initWordEditor(null, ab); // 无头模式
  activeDocId = docId;
  // 历史遗留的非法嵌套修订痕迹（Word 拒开）在 init 时被修复：立即落盘，
  // 否则 IDB 里的原件仍是 Word 打不开的版本
  if (word.wasRevisionSanitized()) {
    try {
      const fixed = await word.exportWordDocx();
      await saveDocFile(docId, fixed);
      if (onDocUpdated) { try { onDocUpdated(docId); } catch (_) {} }
    } catch (_) {}
  }
}

/** 首次编辑附带文档摘要：模型知道自己在改什么（轻量 read-before-write） */
function makeDigest() {
  const text = word.wordText();
  return {
    chars: text.length,
    paragraphs: text ? text.split('\n').length : 0,
    pending_revisions: word.pendingReviewCount(),
    head: text.slice(0, 400).replace(/\s+/g, ' ').trim(),
  };
}

/** 每次成功编辑后：导出字节写回 IDB + 通知阅读器刷新 */
async function persistAndNotify(docId, r) {
  try {
    const ab = await word.exportWordDocx();
    await saveDocFile(docId, ab);
    if (onDocUpdated) { try { onDocUpdated(docId); } catch (_) {} }
  } catch (err) {
    r.persist_error = `文档已修改，但写回存储失败: ${err.message || String(err)}`;
  }
}

/** 保存/导出：持久化 + 返回最新字节、全文文本与待审修订数
 * （供响应自证"导出文件里带了几条修订"，下载后打开可核对，建议 A） */
export async function exportWordDoc(docId) {
  return withDocLock(docId, async () => {
    await ensureEngine(docId);
    const ab = await word.exportWordDocx();
    await saveDocFile(docId, ab);
    return { ab, text: word.wordText(), pending: word.pendingReviewCount() };
  });
}

/** 更新库条目 fullText（导出/保存时调用；供搜索 / AI 上下文） */
export async function updateEntryFullText(docId) {
  const text = word.wordText();
  if (!text) return;
  const pid = await projectProvider();
  const entries = await getEntries(pid);
  const entry = entries.find((e) => e.id === docId);
  if (entry) {
    await updateEntry(docId, { fullText: text }, pid);
  }
}

/**
 * AI doc_edit 的 docx 执行入口。
 * track_changes 默认 false：replace_text/insert_text 直接写入。
 * 显式 true 才走原生修订痕迹（w:ins/w:del + 批注 note）。
 * 格式类操作（set_format/set_bold/set_heading/add_list/add_table/set_cell）恒为直接修改。
 */
export async function editWordDoc(docId, tool, args = {}) {
  return withDocLock(docId, async () => {
    try {
      await ensureEngine(docId);
    } catch (err) {
      return { ok: false, error: err.message || String(err) };
    }
    let r;
    const track = args.track_changes === true || args.track_changes === 'true';
    if (tool === 'replace_text' && track) {
      const find = String(args.find || '');
      r = await word.execReviewTool('suggest_replace', {
        find,
        replacement: args.replace,
        note: args.note || `AI 修订：${find.slice(0, 40)}${find.length > 40 ? '…' : ''}`,
      });
    } else if (tool === 'insert_text' && track) {
      r = await word.execReviewTool('suggest_insert', {
        text: args.text,
        note: args.note || 'AI 插入',
      });
    } else {
      r = await word.execWordTool(tool, args);
    }
    if (r && r.ok && !r.noop && !r.already_pending) {
      // execWordTool/execReviewTool 改动即 ok；undo 空栈等也算 ok 但无字节变化，
      // persistAndNotify 幂等（重新导出写回同样内容），无副作用。
      // 相同文本、已有相同待审修订不写盘。
      await persistAndNotify(docId, r);
    }
    if (r && r.ok && !digestSent.has(docId)) {
      digestSent.add(docId);
      try { r.doc_digest = makeDigest(); } catch (_) {}
    }
    // 目标文档 id 随结果回传：宿主据此把 edits 挂进「修改卡」并解析文档标题
    if (r && typeof r === 'object') r.doc_id = docId;
    return r;
  });
}

/**
 * AI doc_review 的 docx 执行入口：修订管理（list_revisions / accept / reject）。
 * （suggest_* 仍由引擎支持，但工具层已从 doc_review 移除——提出修订统一走
 * doc_edit 的 track_changes。）
 */
export async function reviewWordDoc(docId, tool, args = {}) {
  return withDocLock(docId, async () => {
    try {
      await ensureEngine(docId);
    } catch (err) {
      return { ok: false, error: err.message || String(err) };
    }
    const r = await word.execReviewTool(tool, args);
    if (r && r.ok && (tool === 'accept' || tool === 'reject')) {
      await persistAndNotify(docId, r);
    }
    if (r && typeof r === 'object') r.doc_id = docId;
    return r;
  });
}

export function activeWordDocId() {
  return activeDocId;
}

async function ensureXlsxEngine(docId) {
  if (activeXlsxId === docId) return;
  const ab = await getDocFile(docId);
  if (!ab) {
    throw new Error(`库内没有该表格的原件（doc_id=${String(docId).slice(0, 8)}…）。仅支持上传过 / AI 生成过的 xlsx；旧版 .xls 请另存为 xlsx`);
  }
  await xlsx.initXlsxEditor(ab);
  activeXlsxId = docId;
}

async function persistXlsx(docId, r) {
  try {
    const ab = await xlsx.exportXlsx();
    await saveDocFile(docId, ab);
    if (onDocUpdated) { try { onDocUpdated(docId); } catch (_) {} }
  } catch (err) {
    r.persist_error = `表格已修改，但写回存储失败: ${err.message || String(err)}`;
  }
}

export async function exportXlsxDoc(docId) {
  return withDocLock(docId, async () => {
    await ensureXlsxEngine(docId);
    const ab = await xlsx.exportXlsx();
    await saveDocFile(docId, ab);
    return { ab, text: xlsx.xlsxText(), pending: 0 };
  });
}

export async function updateXlsxEntryFullText(docId) {
  const text = xlsx.xlsxText();
  if (!text) return;
  const pid = await projectProvider();
  const entries = await getEntries(pid);
  const entry = entries.find((e) => e.id === docId);
  if (entry) {
    await updateEntry(docId, { fullText: text }, pid);
  }
}

export async function editXlsxDoc(docId, tool, args = {}) {
  return withDocLock(docId, async () => {
    try {
      await ensureXlsxEngine(docId);
    } catch (err) {
      return { ok: false, error: err.message || String(err) };
    }
    const r = await xlsx.execXlsxTool(tool, args);
    if (r && r.ok) await persistXlsx(docId, r);
    if (r && r.ok && !digestSent.has(docId)) {
      digestSent.add(docId);
      try { r.doc_digest = xlsx.xlsxDigest(); } catch (_) {}
    }
    if (r && typeof r === 'object') r.doc_id = docId;
    return r;
  });
}

function decodeStoredText(ab) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(ab);
  } catch (_) {
    try { return new TextDecoder('gbk').decode(ab); } catch (e) {
      return new TextDecoder('utf-8').decode(ab);
    }
  }
}

async function ensureTextEngine(docId) {
  if (activeTextId === docId && textEd.hasTextSession(docId)) return;
  const pid = await projectProvider();
  const entries = await getEntries(pid);
  const entry = entries.find((e) => e.id === docId);
  const ab = await getDocFile(docId);
  const fromFile = ab ? decodeStoredText(ab).replace(/^\uFEFF/, '') : '';
  const text = fromFile || (entry && entry.fullText) || '';
  textEd.initTextEditor(docId, text);
  activeTextId = docId;
}

async function persistText(docId, r) {
  try {
    const ab = textEd.textBytes(docId);
    await saveDocFile(docId, ab);
    const pid = await projectProvider();
    await updateEntry(docId, { fullText: textEd.textOf(docId), fileSize: ab.byteLength }, pid);
    if (onDocUpdated) { try { onDocUpdated(docId); } catch (_) {} }
  } catch (err) {
    r.persist_error = `文本已修改，但写回存储失败: ${err.message || String(err)}`;
  }
}

export async function editTextDoc(docId, tool, args = {}) {
  return withDocLock(docId, async () => {
    try {
      await ensureTextEngine(docId);
    } catch (err) {
      return { ok: false, error: err.message || String(err) };
    }
    const r = textEd.execTextTool(docId, tool, args);
    if (r && r.ok) await persistText(docId, r);
    if (r && r.ok && !digestSent.has('txt:' + docId)) {
      digestSent.add('txt:' + docId);
      try { r.doc_digest = textEd.textDigest(docId); } catch (_) {}
    }
    if (r && typeof r === 'object') r.doc_id = docId;
    return r;
  });
}

/**
 * 旧版 .doc 不能做 OOXML 手术。编辑前把提取出的正文写成 docx，同一条目原地替换。
 */
export async function promoteDocToDocx(docId) {
  return withDocLock(docId, async () => {
    const pid = await projectProvider();
    const entries = await getEntries(pid);
    const entry = entries.find((e) => e.id === docId);
    if (!entry) return { ok: false, error: '找不到该文档' };
    if (entry.format === 'docx') return { ok: true, already: true };
    if (entry.format !== 'doc') return { ok: false, error: '不是 .doc 文档' };
    let text = String(entry.fullText || '').trim();
    if (!text) {
      const ab = await getDocFile(docId);
      if (ab) text = String(extractLegacyDocText(ab) || '').replace(/\n{3,}/g, '\n\n').trim();
    }
    if (!text) return { ok: false, error: '未能从该 .doc 提取文本，无法编辑' };
    const stem = String(entry.fileName || entry.aiTitle || '文档').replace(/\.doc$/i, '');
    const buf = await markdownToDocxBuffer(text, { title: stem });
    await saveDocFile(docId, buf);
    const fileName = stem + '.docx';
    await updateEntry(docId, {
      format: 'docx',
      fileName,
      fullText: text,
      fileSize: buf.byteLength,
    }, pid);
    if (activeDocId === docId) activeDocId = null;
    if (onDocUpdated) { try { onDocUpdated(docId); } catch (_) {} }
    return {
      ok: true,
      converted: true,
      fileName,
      summary: `已将「${entry.fileName || stem}」转为可编辑 docx（正文保留）`,
    };
  });
}

/** 原件被整表重写（update_entry / create 补盘）后丢弃内存引擎，下次从 IDB 重建 */
export function invalidateDoc(docId) {
  if (!docId) return;
  if (activeDocId === docId) activeDocId = null;
  if (activeXlsxId === docId) activeXlsxId = null;
  if (activeTextId === docId) activeTextId = null;
  textEd.dropTextSession(docId);
  digestSent.delete(docId);
  if (onDocUpdated) { try { onDocUpdated(docId); } catch (_) {} }
}

/* ---------- 每文档操作串行化（Bug 3 修复） ----------
 * 同一文档的 doc_edit / doc_review / export 并发执行会互相踩（引擎是单实例、
 * 快照栈共享），修订计数与内容会不一致。按 docId 挂 promise 链排队，
 * 同一文档的操作严格串行，不同文档互不阻塞。 */
const opQueues = new Map();

function withDocLock(docId, fn) {
  const prev = opQueues.get(docId) || Promise.resolve();
  const next = prev.then(fn, fn);
  opQueues.set(docId, next.then(() => undefined, () => undefined));
  return next;
}
