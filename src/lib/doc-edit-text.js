/**
 * 纯文本（.txt）定点编辑。无 DOM，SW 可跑。
 * 每次成功修改替换第一处 find，或在文末插入。撤销栈按文档分开。
 */

const sessions = new Map();

function session(docId) {
  return sessions.get(docId) || null;
}

export function hasTextSession(docId) {
  return sessions.has(docId);
}

export function initTextEditor(docId, text) {
  sessions.set(String(docId), { text: String(text ?? ''), undo: [], redo: [] });
}

export function dropTextSession(docId) {
  sessions.delete(String(docId));
}

export function textOf(docId) {
  return session(docId)?.text || '';
}

export function textBytes(docId) {
  return new TextEncoder().encode(textOf(docId)).buffer;
}

function snapshot(s) {
  s.undo.push(s.text);
  if (s.undo.length > 40) s.undo.shift();
  s.redo = [];
}

/** 修改痕迹（对话里的修改卡 + 回喂模型的自证材料），见 lib/doc-edits.js */
const editBuf = [];

function recordEdit(op, location, before, after, note) {
  editBuf.push({ op, location, before, after, note });
}

function attachEdits(r) {
  if (r && r.ok && editBuf.length) r.edits = editBuf.splice(0, editBuf.length);
  else editBuf.length = 0;
  return r;
}

export function execTextTool(docId, tool, args = {}) {
  editBuf.length = 0;
  return attachEdits(execTextToolInner(docId, tool, args));
}

function execTextToolInner(docId, tool, args = {}) {
  const s = session(docId);
  if (!s) return { ok: false, error: '文本编辑器未初始化' };
  if (tool === 'replace_text') {
    const find = String(args.find ?? '');
    if (!find) return { ok: false, error: 'replace_text 需要 find（要替换的原文）' };
    const at = s.text.indexOf(find);
    if (at < 0) return { ok: false, error: `未找到「${find.slice(0, 80)}」` };
    snapshot(s);
    const rep = String(args.replace ?? '');
    const line = s.text.slice(0, at).split('\n').length;
    s.text = s.text.slice(0, at) + rep + s.text.slice(at + find.length);
    recordEdit('replace', `第 ${line} 行`, find, rep);
    return { ok: true, summary: `已替换「${find.slice(0, 40)}」` };
  }
  if (tool === 'insert_text') {
    const t = String(args.text ?? '');
    if (!t) return { ok: false, error: 'insert_text 需要 text' };
    snapshot(s);
    const gap = s.text && !s.text.endsWith('\n') ? '\n' : '';
    s.text = s.text + gap + t;
    recordEdit('insert', '文末', '', t);
    return { ok: true, summary: '已在文末插入' };
  }
  if (tool === 'undo') {
    if (!s.undo.length) return { ok: false, error: '没有可撤销的修改' };
    s.redo.push(s.text);
    s.text = s.undo.pop();
    recordEdit('review', '', '', '', '已撤销上一步');
    return { ok: true, summary: '已撤销' };
  }
  if (tool === 'redo') {
    if (!s.redo.length) return { ok: false, error: '没有可重做的修改' };
    s.undo.push(s.text);
    s.text = s.redo.pop();
    recordEdit('review', '', '', '', '已重做上一步');
    return { ok: true, summary: '已重做' };
  }
  if (tool === 'export') return { ok: true, summary: '已保存' };
  return {
    ok: false,
    error: 'txt 只支持 replace_text / insert_text / undo / redo / export',
  };
}

export function textDigest(docId) {
  const text = textOf(docId);
  return {
    chars: text.length,
    lines: text ? text.split('\n').length : 0,
    head: text.slice(0, 400).replace(/\s+/g, ' ').trim(),
  };
}
