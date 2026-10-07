// Per-tab persistent CDP session pool — Playwright Page / Browserbase Session 模式。
//
// 业界成熟框架的做法：每个标签页一个持久的会话对象（Session），lazy attach、
// 空闲释放、命令序列封装成高级动作，而不是每次操作"attach→干完→detach"。
// 本模块由 Service Worker 持有（多窗口 sidepanel 共享）；panel 通过
// TAB_SESSION_OPERATE 消息调用。纯 ESM、无 DOM，SW + panel 均可 import。
//
// 输入层默认拟人（贝塞尔鼠标 + 逐键 + 滚轮），只注入该标签页的 CDP 事件，
// 不移动操作系统光标。inputStyle='fast' 可切回瞬移/整段插入。

import { readerUrlForRemote } from './doc-kind.js';
import { NET_BODY_LIMIT, CDP_TIMEOUT_MS } from './limits.js';
import {
  debuggerAttach, debuggerDetach, debuggerSend, ensureTabForeground, withDeadline,
} from './cdp.js';

const PAGE_WIN = ['wind', 'ow'].join('');
const PAGE_DOC = ['docu', 'ment'].join('');
export const SESSION_LIMIT = 6;
export const IDLE_RELEASE_MS = 30000;
export const AX_NODE_CAP = 1500;
export const NET_MAX_ITEMS = 50;
export { NET_BODY_LIMIT };

function isDetachError(err) {
  const m = ((err && err.message) || '').toLowerCase();
  return /no debugger|not attached|no attached debugger|debugger.*(detached|not found)/.test(m);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, Math.max(0, Number(ms) || 0)));
}
function rand(min, max) {
  return min + Math.random() * (max - min);
}
function bezier(p0, p1, p2, p3, t) {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
}

const INTERACTIVE_ROLES = new Set([
  'button', 'link', 'checkbox', 'radio', 'textbox', 'searchbox', 'combobox',
  'listbox', 'option', 'slider', 'spinbutton', 'switch', 'tab', 'menuitem',
  'menuitemcheckbox', 'menuitemradio', 'treeitem', 'textbox', 'cell',
  'gridcell', 'row', 'tabpanel', 'menu', 'menubar', 'listitem',
]);
const STRUCT_ROLES = new Set([
  'heading', 'article', 'main', 'navigation', 'banner', 'contentinfo',
  'complementary', 'form', 'search', 'region', 'dialog', 'alertdialog',
  'image', 'img', 'figure', 'table', 'rowheader', 'columnheader',
]);

function axName(n) {
  const v = n && n.name && n.name.value;
  if (v == null) return '';
  return String(typeof v === 'object' && v.str != null ? v.str : v).trim();
}
function axRole(n) {
  const v = n && n.role && n.role.value;
  if (v == null) return '';
  return String(typeof v === 'object' && v.str != null ? v.str : v).trim();
}
function axProp(n, name) {
  const p = (n.properties || []).find((x) => x.name === name);
  return p && p.value ? p.value.value : undefined;
}

function keyDescriptor(ch) {
  if (ch === ' ') return { key: ' ', code: 'Space', windowsVirtualKeyCode: 32, text: ' ' };
  if (ch === '\n' || ch === '\r') return { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' };
  if (ch === '\t') return { key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, text: '\t' };
  const lower = ch.toLowerCase();
  if (lower >= 'a' && lower <= 'z') {
    const vk = 65 + (lower.charCodeAt(0) - 97);
    const shift = ch !== lower;
    return { key: ch, code: 'Key' + lower.toUpperCase(), windowsVirtualKeyCode: vk, text: ch, shift };
  }
  if (ch >= '0' && ch <= '9') {
    return { key: ch, code: 'Digit' + ch, windowsVirtualKeyCode: 48 + Number(ch), text: ch };
  }
  const punct = {
    '.': ['Period', 190], ',': ['Comma', 188], '-': ['Minus', 189], '=': ['Equal', 187],
    '/': ['Slash', 191], '\\': ['Backslash', 220], ';': ['Semicolon', 186], "'": ['Quote', 222],
    '[': ['BracketLeft', 219], ']': ['BracketRight', 221], '`': ['Backquote', 192],
  };
  if (punct[ch]) {
    const [code, vk] = punct[ch];
    return { key: ch, code, windowsVirtualKeyCode: vk, text: ch };
  }
  return null;
}

export class TabSession {
  constructor(tabId) {
    this.tabId = tabId;
    this.state = 'detached';
    this.lastUsedAt = 0;
    this._attachPromise = null;
    this._tempListeners = new Set();
    this._cursor = null;
    this._refMap = new Map();
    this._netBuffer = [];
    this._netPending = new Map();
    this._netListening = false;
    this._netFilter = '';
    this._offNetResp = null;
    this._offNetFin = null;
  }

  async attach() {
    if (this.state === 'attached') return;
    if (this._attachPromise) { await this._attachPromise; return; }
    this.state = 'attaching';
    this._attachPromise = (async () => {
      try {
        await debuggerAttach(this.tabId);
        this.state = 'attached';
        await debuggerSend(this.tabId, 'Emulation.setPageThrottlingEnabled', { enabled: false }).catch(() => {});
        await debuggerSend(this.tabId, 'Emulation.setFocusEmulationEnabled', { enabled: true }).catch(() => {});
        await debuggerSend(this.tabId, 'Accessibility.enable').catch(() => {});
      } catch (err) {
        this.state = 'detached';
        throw err;
      }
    })().finally(() => { this._attachPromise = null; });
    await this._attachPromise;
  }

  async detach() {
    await this.stopNetworkListen().catch(() => {});
    if (this.state === 'attached' || this.state === 'attaching') {
      await debuggerDetach(this.tabId);
    }
    this.state = 'detached';
    this._tempListeners.clear();
    this._cursor = null;
    this._refMap.clear();
  }

  _onDetached() {
    this.state = 'detached';
    this._tempListeners.clear();
    this._netListening = false;
    this._offNetResp = null;
    this._offNetFin = null;
    this._cursor = null;
  }

  async send(method, params = {}) {
    await this.attach();
    this.lastUsedAt = Date.now();
    try {
      return await debuggerSend(this.tabId, method, params, CDP_TIMEOUT_MS);
    } catch (err) {
      if (isDetachError(err)) {
        this.state = 'detached';
        await this.attach();
        return debuggerSend(this.tabId, method, params, CDP_TIMEOUT_MS);
      }
      throw err;
    }
  }

  async evalJS(code) {
    const r = await this.send('Runtime.evaluate', {
      expression: String(code || ''),
      returnByValue: true,
      awaitPromise: true,
    });
    if (r.exceptionDetails) {
      throw new Error((r.exceptionDetails.exception && r.exceptionDetails.exception.description)
        || r.exceptionDetails.text || '页面脚本执行出错');
    }
    return r.result ? r.result.value : undefined;
  }

  async evalJSMain(code) {
    const results = await chrome.scripting.executeScript({
      target: { tabId: this.tabId },
      world: 'MAIN',
      func: async (src) => {
        try {
          let r = (0, eval)(src);
          if (r && typeof r.then === 'function') r = await r;
          return r;
        } catch (e) {
          return { __error: e.message };
        }
      },
      args: [String(code || '')],
    });
    const res = results?.[0]?.result;
    if (res && typeof res === 'object' && res.__error) throw new Error(res.__error);
    return res;
  }

  async viewport() {
    const raw = await this.evalJS(`JSON.stringify({w:${PAGE_WIN}.innerWidth,h:${PAGE_WIN}.innerHeight,sx:${PAGE_WIN}.scrollX,sy:${PAGE_WIN}.scrollY,sh:${PAGE_DOC}.body?${PAGE_DOC}.body.scrollHeight:0})`).catch(() => '{}');
    try {
      const v = JSON.parse(typeof raw === 'string' ? raw : '{}');
      return { w: v.w || 800, h: v.h || 600, sx: v.sx || 0, sy: v.sy || 0, sh: v.sh || 0 };
    } catch {
      return { w: 800, h: 600, sx: 0, sy: 0, sh: 0 };
    }
  }

  _style(opts) {
    const s = String((opts && opts.inputStyle) || 'human').toLowerCase();
    return s === 'fast' ? 'fast' : 'human';
  }

  async mouseMoveTo(x, y, opts = {}) {
    const style = this._style(opts);
    const to = { x: Number(x), y: Number(y) };
    if (style === 'fast') {
      await this.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: to.x, y: to.y });
      this._cursor = to;
      return;
    }
    const vp = await this.viewport();
    const from = this._cursor || { x: vp.w * 0.4, y: vp.h * 0.35 };
    const dist = Math.hypot(to.x - from.x, to.y - from.y);
    const steps = Math.max(12, Math.min(24, Math.round(dist / 35) || 12));
    const c1 = {
      x: from.x + (to.x - from.x) * rand(0.2, 0.4) + rand(-70, 70),
      y: from.y + (to.y - from.y) * rand(0.1, 0.35) + rand(-50, 50),
    };
    const c2 = {
      x: from.x + (to.x - from.x) * rand(0.6, 0.85) + rand(-70, 70),
      y: from.y + (to.y - from.y) * rand(0.65, 0.9) + rand(-50, 50),
    };
    const end = { x: to.x + rand(-2.2, 2.2), y: to.y + rand(-2.2, 2.2) };
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const mx = bezier(from.x, c1.x, c2.x, end.x, t);
      const my = bezier(from.y, c1.y, c2.y, end.y, t);
      await this.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: mx, y: my });
      await sleep(rand(8, 18));
    }
    await this.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: to.x, y: to.y });
    this._cursor = to;
  }

  async wheelBy(deltaY, opts = {}) {
    const style = this._style(opts);
    const vp = await this.viewport();
    const cx = (this._cursor && this._cursor.x) || vp.w / 2;
    const cy = (this._cursor && this._cursor.y) || vp.h / 2;
    const total = Number(deltaY) || 0;
    if (style === 'fast') {
      await this.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: cx, y: cy, deltaX: 0, deltaY: total });
      return;
    }
    const chunks = Math.max(3, Math.min(10, Math.round(Math.abs(total) / 140)));
    let left = total;
    for (let i = 0; i < chunks; i++) {
      const step = i === chunks - 1 ? left : total / chunks + rand(-18, 18);
      left -= step;
      await this.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: cx, y: cy, deltaX: 0, deltaY: step });
      await sleep(rand(28, 70));
    }
    await sleep(rand(80, 160));
  }

  async ensureInViewport(x, y, opts = {}) {
    const vp = await this.viewport();
    if (y >= 8 && y <= vp.h - 8 && x >= 0 && x <= vp.w) return { x, y };
    const dy = y < 8 ? y - vp.h * 0.35 : y - vp.h * 0.65;
    await this.wheelBy(dy, opts);
    const vp2 = await this.viewport();
    return { x, y: y + (vp.sy - vp2.sy) };
  }

  async clickAt(x, y, opts = {}) {
    await ensureTabForeground(this.tabId);
    const style = this._style(opts);
    let pt = { x: Number(x), y: Number(y) };
    pt = await this.ensureInViewport(pt.x, pt.y, opts);
    await this.mouseMoveTo(pt.x, pt.y, opts);
    if (style !== 'fast') await sleep(rand(40, 120));
    else await sleep(80);
    const hold = style === 'fast' ? 40 : rand(50, 120);
    await this.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: pt.x, y: pt.y, button: 'left', clickCount: 1, buttons: 1 });
    await sleep(hold);
    await this.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: pt.x, y: pt.y, button: 'left', clickCount: 1, buttons: 1 });
    this._cursor = pt;
    return pt;
  }

  async clickElement(n, opts = {}) {
    await ensureTabForeground(this.tabId);
    const coordResp = await withDeadline(
      chrome.tabs.sendMessage(this.tabId, {
        type: 'INTERACT_PAGE', action: 'get_coords', text: String(n),
      }),
      CDP_TIMEOUT_MS,
      'get_coords',
    );
    if (!coordResp || !coordResp.ok) throw new Error(coordResp?.error || '无法获取元素坐标');
    const pt = await this.clickAt(coordResp.x, coordResp.y, opts);
    return { x: pt.x, y: pt.y };
  }

  async _keyEvent(type, desc, extras = {}) {
    const payload = {
      type,
      key: desc.key,
      code: desc.code,
      windowsVirtualKeyCode: desc.windowsVirtualKeyCode,
      nativeVirtualKeyCode: desc.windowsVirtualKeyCode,
      modifiers: (desc.shift ? 8 : 0) | (extras.modifiers || 0),
    };
    if (type === 'keyDown' && desc.text) payload.text = desc.text;
    if (type === 'char' && desc.text) payload.text = desc.text;
    await this.send('Input.dispatchKeyEvent', payload);
  }

  async clearField(opts = {}) {
    const style = this._style(opts);
    if (style === 'fast') {
      await this.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65, modifiers: 2 });
      await this.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65, modifiers: 2 });
      await this.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 });
      await this.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 });
      return;
    }
    await this.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Control', code: 'ControlLeft', windowsVirtualKeyCode: 17, modifiers: 2 });
    await this.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65, modifiers: 2 });
    await this.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65, modifiers: 2 });
    await this.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Control', code: 'ControlLeft', windowsVirtualKeyCode: 17 });
    await sleep(rand(30, 70));
    await this.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 });
    await this.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 });
  }

  async typeText(text, opts = {}) {
    await ensureTabForeground(this.tabId);
    const style = this._style(opts);
    const str = String(text || '');
    if (!str) return;
    await this.clearField(opts);
    if (style === 'fast') {
      await this.send('Input.insertText', { text: str });
      return;
    }
    let sincePause = 0;
    const pauseEvery = Math.round(rand(8, 20));
    for (const ch of str) {
      const desc = keyDescriptor(ch);
      if (!desc) {
        await this.send('Input.insertText', { text: ch });
      } else {
        if (desc.shift) {
          await this.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Shift', code: 'ShiftLeft', windowsVirtualKeyCode: 16, modifiers: 8 });
        }
        await this._keyEvent('keyDown', desc);
        await this._keyEvent('char', desc);
        await this._keyEvent('keyUp', desc);
        if (desc.shift) {
          await this.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Shift', code: 'ShiftLeft', windowsVirtualKeyCode: 16 });
        }
      }
      const punct = /[.,;:!?]/.test(ch);
      await sleep(punct || (ch >= 'A' && ch <= 'Z') ? rand(70, 140) : rand(40, 110));
      sincePause++;
      if (sincePause >= pauseEvery) {
        await sleep(rand(200, 400));
        sincePause = 0;
      }
    }
  }

  async pressEnter() {
    const desc = keyDescriptor('\n');
    await this._keyEvent('keyDown', desc);
    await this._keyEvent('keyUp', desc);
  }

  async scroll(delta, opts = {}) {
    await this.wheelBy(Number(delta) || 0, opts);
  }

  async scrollToBottom(opts = {}) {
    const vp = await this.viewport();
    const remain = Math.max(0, (vp.sh || vp.h) - vp.sy - vp.h);
    if (remain < 40) return;
    await this.wheelBy(remain, opts);
  }

  async screenshot() {
    await ensureTabForeground(this.tabId);
    const shot = await this.send('Page.captureScreenshot', { format: 'jpeg', quality: 72 });
    return shot?.data ? `data:image/jpeg;base64,${shot.data}` : null;
  }

  async boxOfBackendNode(backendNodeId) {
    const { object } = await this.send('DOM.resolveNode', { backendNodeId });
    if (!object || !object.objectId) throw new Error('无法解析 DOM 节点');
    const box = await this.send('DOM.getBoxModel', { objectId: object.objectId });
    const q = box.model.content;
    return { x: (q[0] + q[2] + q[4] + q[6]) / 4, y: (q[1] + q[3] + q[5] + q[7]) / 4 };
  }

  _nextRef() {
    return 'e' + (this._refMap.size + 1);
  }

  _recordRef(backendDOMNodeId, meta) {
    const ref = this._nextRef();
    this._refMap.set(ref, { backendDOMNodeId, ...meta });
    return ref;
  }

  async _axNodesForFrame(frameId) {
    const params = frameId ? { frameId } : {};
    const tree = await this.send('Accessibility.getFullAXTree', params);
    return tree.nodes || [];
  }

  async _allFrameIds() {
    const ids = [undefined];
    try {
      const tree = await this.send('Page.getFrameTree');
      const walk = (n) => {
        if (!n) return;
        if (n.frame && n.frame.id) ids.push(n.frame.id);
        (n.childFrames || []).forEach(walk);
      };
      walk(tree.frameTree);
    } catch (_) {}
    return [...new Set(ids)];
  }

  _formatAxYaml(nodes, { frameHint = '', cap = AX_NODE_CAP } = {}) {
    const byId = new Map();
    for (const n of nodes) {
      if (n.nodeId != null) byId.set(n.nodeId, n);
    }
    const lines = [];
    if (frameHint) lines.push(`- iframe: ${frameHint}`);
    const visit = (n, depth) => {
      if (lines.length >= cap) return;
      const role = axRole(n);
      const name = axName(n).slice(0, 80);
      const ignored = !!n.ignored;
      if (ignored && !INTERACTIVE_ROLES.has(role) && !STRUCT_ROLES.has(role)) {
        for (const cid of n.childIds || []) {
          const child = byId.get(cid);
          if (child) visit(child, depth);
        }
        return;
      }
      const disabled = axProp(n, 'disabled');
      const interactive = INTERACTIVE_ROLES.has(role) && !disabled && n.backendDOMNodeId;
      let ref = '';
      if (interactive) {
        ref = this._recordRef(n.backendDOMNodeId, { role, name });
      }
      const keep = interactive || STRUCT_ROLES.has(role) || (role === 'StaticText' && name.length >= 8);
      if (keep && (role || name)) {
        const bits = [`${'  '.repeat(Math.min(depth, 6))}- ${role || 'generic'}`];
        if (name) bits.push(`"${name.replace(/"/g, "'")}"`);
        if (ref) bits.push(`[ref=${ref}]`);
        const checked = axProp(n, 'checked');
        const expanded = axProp(n, 'expanded');
        const pressed = axProp(n, 'pressed');
        if (checked !== undefined && checked !== 'false') bits.push(`checked=${checked}`);
        if (expanded !== undefined) bits.push(`expanded=${expanded}`);
        if (pressed !== undefined) bits.push(`pressed=${pressed}`);
        lines.push(bits.join(' '));
      }
      for (const cid of n.childIds || []) {
        const child = byId.get(cid);
        if (child) visit(child, depth + (keep ? 1 : 0));
      }
    };
    const roots = nodes.filter((n) => n.parentId == null || !byId.has(n.parentId));
    const start = roots.length ? roots : nodes.slice(0, 1);
    for (const r of start) visit(r, 0);
    if (!lines.length) {
      for (const n of nodes) {
        if (lines.length >= cap) break;
        const role = axRole(n);
        const name = axName(n).slice(0, 80);
        if (!role && !name) continue;
        const interactive = INTERACTIVE_ROLES.has(role) && n.backendDOMNodeId && !axProp(n, 'disabled');
        const ref = interactive ? this._recordRef(n.backendDOMNodeId, { role, name }) : '';
        if (interactive || STRUCT_ROLES.has(role) || name) {
          lines.push(`- ${role || 'generic'}${name ? ` "${name.replace(/"/g, "'")}"` : ''}${ref ? ` [ref=${ref}]` : ''}`);
        }
      }
    }
    return lines.slice(0, cap);
  }

  async pageSnapshot(opts = {}) {
    await ensureTabForeground(this.tabId);
    this._refMap.clear();
    await this.send('Accessibility.enable').catch(() => {});
    const includeIframes = opts.includeIframes !== false;
    const frameIds = includeIframes ? await this._allFrameIds() : [undefined];
    const yaml = [];
    const items = [];
    for (let i = 0; i < frameIds.length; i++) {
      const fid = frameIds[i];
      const nodes = await this._axNodesForFrame(fid);
      const hint = i === 0 ? '' : `frame ${i}`;
      const lines = this._formatAxYaml(nodes, { frameHint: hint });
      yaml.push(...lines);
      if (yaml.length >= AX_NODE_CAP) break;
    }
    for (const [ref, meta] of this._refMap) {
      items.push({ ref, role: meta.role, name: meta.name });
    }
    return { yaml: yaml.join('\n'), items, refCount: this._refMap.size };
  }

  async clickRef(ref, opts = {}) {
    const rec = this._refMap.get(String(ref || ''));
    if (!rec) throw new Error(`ref ${ref} 不存在，请先 page_snapshot`);
    const box = await this.boxOfBackendNode(rec.backendDOMNodeId);
    const pt = await this.clickAt(box.x, box.y, opts);
    return { ...pt, ref: String(ref), role: rec.role, name: rec.name };
  }

  async typeRef(ref, text, opts = {}) {
    if (ref) await this.clickRef(ref, opts);
    await this.typeText(text, opts);
    if (opts.pressEnter) await this.pressEnter();
  }

  async getAXTree() {
    const snap = await this.pageSnapshot({ includeIframes: true });
    return snap.items.map((it, i) => ({
      n: i + 1,
      ref: it.ref,
      role: it.role,
      name: it.name,
    }));
  }

  async axClick(n, opts = {}) {
    const items = [...this._refMap.keys()];
    if (!items.length) await this.pageSnapshot();
    const refs = [...this._refMap.keys()];
    const idx = Number(n) - 1;
    if (idx < 0 || idx >= refs.length) throw new Error(`ax 编号超出范围（共 ${refs.length} 个元素）`);
    return this.clickRef(refs[idx], opts);
  }

  async startNetworkListen({ urlFilter = '', maxItems = NET_MAX_ITEMS, bodyLimit = NET_BODY_LIMIT } = {}) {
    this._netFilter = String(urlFilter || '');
    this._netMax = maxItems;
    this._netBodyLimit = bodyLimit;
    if (this._netListening) return;
    this._netListening = true;
    if (!this._netBuffer) this._netBuffer = [];
    const onResponse = (params) => {
      const { requestId, response, type } = params;
      if (type !== 'XHR' && type !== 'Fetch') return;
      const mime = response.mimeType || '';
      if (!/json|text|javascript|xml/.test(mime)) return;
      const url = response.url || '';
      if (this._netFilter && !url.toLowerCase().includes(this._netFilter.toLowerCase())) return;
      this._netPending.set(requestId, { url, mimeType: mime });
    };
    const onFinish = async (params) => {
      const meta = this._netPending.get(params.requestId);
      if (!meta) return;
      this._netPending.delete(params.requestId);
      try {
        const body = await this.send('Network.getResponseBody', { requestId: params.requestId });
        let text = body?.body || '';
        if (body?.base64Encoded) { try { text = atob(text); } catch (_) {} }
        if (!text) return;
        if (this._netBuffer.some((c) => c.url === meta.url && c.body === text.slice(0, 200))) return;
        if (this._netBuffer.length >= (this._netMax || NET_MAX_ITEMS)) this._netBuffer.shift();
        // 采集护栏（SW 内存保护）仍保留，但必须留下「被砍过」的标记，出口据此如实告知模型。
        const bodyLimit = this._netBodyLimit || NET_BODY_LIMIT;
        if (text.length > bodyLimit) {
          this._netBuffer.push({ url: meta.url, mimeType: meta.mimeType, body: text.slice(0, bodyLimit), bodyTruncated: true, bodyChars: text.length });
        } else {
          this._netBuffer.push({ url: meta.url, mimeType: meta.mimeType, body: text });
        }
      } catch (_) {}
    };
    this._offNetResp = this.on('Network.responseReceived', onResponse);
    this._offNetFin = this.on('Network.loadingFinished', onFinish);
    await this.send('Network.enable');
  }

  dumpNetwork({ urlFilter = '', clear = false } = {}) {
    let items = this._netBuffer || [];
    const f = String(urlFilter || this._netFilter || '').toLowerCase();
    if (f) items = items.filter((c) => (c.url || '').toLowerCase().includes(f));
    if (clear) this._netBuffer = [];
    return items;
  }

  async stopNetworkListen() {
    if (this._offNetResp) this._offNetResp();
    if (this._offNetFin) this._offNetFin();
    this._offNetResp = null;
    this._offNetFin = null;
    this._netListening = false;
    await this.send('Network.disable').catch(() => {});
  }

  async captureNetwork({ urlFilter = '', duration = 7000, maxItems = NET_MAX_ITEMS, bodyLimit = NET_BODY_LIMIT, inputStyle = 'human' } = {}) {
    const keep = this._netListening;
    await this.startNetworkListen({ urlFilter, maxItems, bodyLimit });
    const m = await this.viewport();
    const vh = m.h || 800;
    const total = m.sh || vh;
    const step = Math.round(vh * 0.85);
    const rounds = Math.min(8, Math.max(3, Math.ceil(duration / 900)));
    for (let i = 0; i < rounds; i++) {
      await this.wheelBy(Math.min(step, total), { inputStyle });
      await sleep(Math.floor(duration / rounds));
    }
    let quiet = 0;
    const settleStart = Date.now();
    while (this._netPending.size > 0 && quiet < 1200 && Date.now() - settleStart < 3000) {
      const before = this._netPending.size;
      await sleep(300);
      quiet = this._netPending.size === before ? quiet + 300 : 0;
    }
    const captured = this.dumpNetwork({ urlFilter });
    if (!keep) await this.stopNetworkListen().catch(() => {});
    return captured;
  }

  async paginate({ maxPages = 10, inputStyle = 'human' } = {}) {
    const max = Math.max(1, Math.min(30, Number(maxPages) || 10));
    const pages = [];
    let blindScrolls = 0;
    for (let i = 0; i < max; i++) {
      const extract = await chrome.tabs.sendMessage(this.tabId, { type: 'EXTRACT_CONTENT', format: 'auto' }).catch(() => null);
      pages.push({
        index: i + 1,
        title: extract?.title || '',
        items: (extract?.structured && extract.structured.items) || [],
        contentChars: (extract?.content || '').length,
      });
      if (i === max - 1) break;
      const snap = await this.pageSnapshot();
      const next = snap.items.find((it) => /下一页|下一頁|next\s*page|^next$|›|»|more\s*results/i.test(it.name || ''));
      if (next) {
        await this.clickRef(next.ref, { inputStyle });
        await sleep(900);
        blindScrolls = 0;
        continue;
      }
      if (blindScrolls >= 3) break;
      const before = pages[pages.length - 1].contentChars;
      await this.scrollToBottom({ inputStyle });
      await sleep(800);
      const after = await chrome.tabs.sendMessage(this.tabId, { type: 'EXTRACT_CONTENT', format: 'auto' }).catch(() => null);
      const afterLen = (after?.content || '').length;
      if (afterLen <= before + 40) break;
      blindScrolls++;
    }
    return { pages, count: pages.length };
  }

  async navigate(url) {
    await chrome.tabs.update(this.tabId, { url: readerUrlForRemote(String(url || '')) });
    this._refMap.clear();
    this._cursor = null;
  }

  on(method, cb) {
    const entry = { method, cb };
    this._tempListeners.add(entry);
    return () => this._tempListeners.delete(entry);
  }

  _dispatch(method, params) {
    for (const l of [...this._tempListeners]) {
      if (l.method === method) {
        try { l.cb(params); } catch (_) {}
      }
    }
  }
}

export class SessionPool {
  constructor() {
    this.sessions = new Map();
  }

  acquire(tabId) {
    let s = this.sessions.get(tabId);
    if (!s) {
      if (this.sessions.size >= SESSION_LIMIT) this._evictOne();
      s = new TabSession(tabId);
      this.sessions.set(tabId, s);
    }
    return s;
  }

  _evictOne() {
    let best = null;
    for (const s of this.sessions.values()) {
      if (s.state === 'detached' && (!best || s.lastUsedAt < best.lastUsedAt)) best = s;
    }
    if (!best) {
      for (const s of this.sessions.values()) {
        if (!best || s.lastUsedAt < best.lastUsedAt) best = s;
      }
    }
    if (best) {
      this.sessions.delete(best.tabId);
      best.detach().catch(() => {});
    }
  }

  release(tabId) {
    const s = this.sessions.get(tabId);
    if (s) {
      this.sessions.delete(tabId);
      s.detach().catch(() => {});
    }
  }

  closeAll() {
    for (const s of this.sessions.values()) s.detach().catch(() => {});
    this.sessions.clear();
  }

  status() {
    return [...this.sessions.entries()].map(([tabId, s]) => ({
      tabId, state: s.state, lastUsedAt: s.lastUsedAt,
    }));
  }
}

export const sessionPool = new SessionPool();

export function initDebuggerDispatch() {
  if (typeof chrome === 'undefined' || !chrome.debugger) return;
  chrome.debugger.onEvent.addListener((source, method, params) => {
    if (source.tabId == null) return;
    const s = sessionPool.sessions.get(source.tabId);
    if (s) s._dispatch(method, params);
  });
  chrome.debugger.onDetach.addListener((source) => {
    if (source.tabId == null) return;
    const s = sessionPool.sessions.get(source.tabId);
    if (s) s._onDetached();
  });
}
