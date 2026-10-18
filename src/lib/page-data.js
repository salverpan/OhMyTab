// 页面数据构建（read_current_page / read_tab / read_many 共用）。
// EXTRACT_CONTENT（DOM 结构化 + detectPageType）+ 主世界图表/框架数据 → 统一 JSON 对象。
// manage_tabs(list) 走 EXTRACT_SNAPSHOT（廉价 title/pageType/snippet），禁止跑全文提取。
// 纯 ESM 无 DOM；chrome.tabs.sendMessage / chrome.scripting 在 SW 和 sidepanel 都可用。

// 阅读器页（chrome-extension://…/src/reader/index.html）是扩展自身页面，content
// script 不会注入，但 reader.js 会响应 EXTRACT_CONTENT / SCROLL_COLLECT 并返回
// 当前文档（PDF/Word/Excel/CSV）全文 —— 采集本页 / read_current_page 对它放行。
import { READ_SINGLE_MAX_CHARS } from './limits.js';

const READER_URL = chrome.runtime.getURL('src/reader/index.html');
export function isReaderPage(url) {
  return typeof url === 'string' && url.split('?')[0] === READER_URL;
}
function isUnreadableUrl(url) {
  return !url || /^(chrome|edge|about):/i.test(url) || (/^chrome-extension:/i.test(url) && !isReaderPage(url));
}

/** 注入对话动态前言：阅读器是扩展内页，doc_edit 不需要点「编辑」。 */
export function formatReaderSessionNote(s) {
  if (!s) return '';
  const idBit = s.docId ? `，库内条目 id=${s.docId}` : '';
  const tabBit = s.tabId != null ? `，标签页 id=${s.tabId}` : '';
  let note = `\n当前文档阅读器：${s.title || '(未命名)'}（${s.kind || '文档'}${idBit}${tabBit}）`;
  note += '\n阅读器地址是扩展内页（chrome-extension://…/src/reader/index.html），不是普通网页：禁止 interact_page，禁止让用户点「编辑」。';
  if (s.docId && (s.kind === 'docx' || s.kind === 'xlsx')) {
    note += `\n改这份 ${s.kind} 立刻调 doc_edit(doc_id=${s.docId})：后台直接改库内原件，无需编辑模式，阅读器会自动刷新。`;
    if (s.kind === 'docx') {
      note += '文本修改默认修订痕迹（track_changes）；用户要直接改时传 track_changes=false。';
    }
    if (s.tabId != null) note += `读正文用 read_tab(tab_id=${s.tabId}) 或 read_current_page。`;
  } else if (s.docId) {
    note += s.tabId != null
      ? `\n此类型不能用 doc_edit（仅 docx/xlsx）。读正文用 read_tab(tab_id=${s.tabId})。`
      : '\n此类型不能用 doc_edit（仅 docx/xlsx）。';
  } else {
    note += '\n当前是远程打开、尚未入库：先采集入库后再 doc_edit。不要让用户点「编辑」。';
  }
  return note;
}

export function isReadableTab(tab) {
  return !!(tab && tab.url && !isUnreadableUrl(tab.url));
}

const PANEL_PAGE_URL = chrome.runtime.getURL('src/sidepanel/index.html');
const BROWSING_TAB_KEY = 'scBrowsingTab';

/** 侧栏整页打开时的扩展标签。它不是用户正在看的网页。 */
export function isAppPanelPage(url) {
  if (typeof url !== 'string') return false;
  return url.split('?')[0].split('#')[0] === PANEL_PAGE_URL;
}

/**
 * 用户正在浏览的网页标签。
 * 侧栏里就是当前窗口的活跃标签；整页模式里活跃标签是扩展自己，
 * 改记这个窗口上一次打开的可读网页（service worker 写入 session）。
 */
export async function getBrowsingTab() {
  const usable = (tab) => isReadableTab(tab) && !isAppPanelPage(tab.url);
  const [cur] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (usable(cur)) return cur;
  const windowId = cur?.windowId ?? (await chrome.windows.getCurrent().catch(() => null))?.id;
  if (windowId == null) return null;
  try {
    const data = await chrome.storage.session.get(BROWSING_TAB_KEY);
    const id = data?.[BROWSING_TAB_KEY]?.[String(windowId)];
    if (id != null) {
      const remembered = await chrome.tabs.get(id).catch(() => null);
      if (usable(remembered)) return remembered;
    }
  } catch (_) {}
  const rest = await chrome.tabs.query({ windowId });
  return rest.find(usable) || null;
}

// chrome.tabs.sendMessage 在内容脚本不 sendResponse / 页面冻结 / SW 被杀时
// 永远不 settle。所有跨 tab 提取必须套超时，否则 AI 状态行会卡死。
export const TAB_SNAPSHOT_TAB_MS = 1500;
export const TAB_SNAPSHOT_BUDGET_MS = 8000;
export const TAB_READ_MS = 20000;

export function withTimeout(promise, ms, fallback) {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve(typeof fallback === 'function' ? fallback() : fallback);
    }, Math.max(0, Number(ms) || 0));
    Promise.resolve(promise).then(
      (v) => { if (!settled) { settled = true; clearTimeout(timer); resolve(v); } },
      () => { if (!settled) { settled = true; clearTimeout(timer); resolve(typeof fallback === 'function' ? fallback() : fallback); } },
    );
  });
}

export function tabListMeta(tab, extra = {}) {
  return {
    tabId: tab.id,
    url: tab.url || '',
    title: tab.title || '',
    pageType: extra.pageType || 'article',
    snippet: extra.snippet || '',
    available: extra.available !== false,
    active: !!tab.active,
    ...extra,
  };
}

// dashboard 自动路由用：只读脚本，提取 ECharts/Chart.js 实例数据 + 常见框架全局。
// 只读不写、全程 try/catch，拿不到就返回空结构。
const CHART_EXTRACT_SCRIPT = `(() => {
  const out = { charts: [], globals: {} };
  try {
    const echartsApi = window.echarts;
    const chartEls = document.querySelectorAll('[_echarts_instance_]');
    for (const el of chartEls) {
      try {
        let chart = null;
        if (echartsApi && echartsApi.getInstanceByDom) chart = echartsApi.getInstanceByDom(el);
        if (!chart && el.__ec_inner_) chart = el.__ec_inner_.chart;
        if (!chart || !chart.getOption) continue;
        const opt = chart.getOption();
        const series = (opt.series || []).map((s, i) => {
          const data = Array.isArray(s.data) ? s.data.slice(0, 100) : [];
          const xAxis = Array.isArray(opt.xAxis) && opt.xAxis[0] ? opt.xAxis[0].data : null;
          const name = s.name || 'series' + i;
          if (Array.isArray(xAxis) && xAxis.length === data.length) {
            return { name, points: xAxis.slice(0, 100).map((x, j) => [x, data[j]]) };
          }
          return { name, data: data.slice(0, 100) };
        });
        if (series.length) {
          const t = opt.title && opt.title[0] ? opt.title[0].text : '';
          out.charts.push({ name: t || 'chart', series });
        }
      } catch (e) {}
    }
    for (const canvas of document.querySelectorAll('canvas')) {
      try {
        const inst = canvas._chartjs || canvas.chart;
        if (!inst || !inst.data) continue;
        const datasets = (inst.data.datasets || []).map((d) => ({
          name: d.label || 'series',
          data: Array.isArray(d.data) ? d.data.slice(0, 100) : [],
        }));
        if (datasets.length) {
          const t = inst.options && inst.options.plugins && inst.options.plugins.title ? inst.options.plugins.title.text : '';
          out.charts.push({ name: t || 'chartjs', series: datasets });
        }
      } catch (e) {}
    }
    for (const key of ['__NEXT_DATA__', '__NUXT__', '__INITIAL_STATE__', '__INITIAL_DATA__', '__APOLLO_STATE__']) {
      try {
        const v = window[key];
        if (v !== undefined) {
          const s = typeof v === 'string' ? v : JSON.stringify(v);
          if (s) out.globals[key] = s.slice(0, 4000);
        }
      } catch (e) {}
    }
  } catch (e) {}
  return out;
})()`;

async function mainWorldEval(tabId, code) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
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
      args: [code],
    });
    const res = results?.[0]?.result;
    if (res && typeof res === 'object' && res.__error) return null;
    return res ?? null;
  } catch (err) {
    return null;
  }
}

async function extractChartData(tabId) {
  const r = await mainWorldEval(tabId, CHART_EXTRACT_SCRIPT);
  return r || null;
}

// 构建单页数据（统一 JSON 对象，调用方决定序列化）。
// 返回 { pageType, url, title, mode, data, untrusted } 或 { error }。
// untrusted: 页面内容一律视为不可信输入（提示注入防护标记）。
// maxChars: 显式限制本次返回正文字符数（与 offset 配合做分页）。
// offset: 正文起始字符偏移，用于续拉大文档的下一段（见 read_current_page / read_tab）。
// 默认行为：正文 <= READ_PAGE_CHUNK_CHARS 时返回全文；超过则自动分页（返回首段 +
// content_has_more/content_next_offset 游标），AI 可用 offset 续拉，防止单次 read 顶爆上下文。
// 每次读取的正文字符上限：单次返回不超过 20 万字符，超过则分页（返回首段 +
// content_has_more/content_next_offset 游标），AI 用 offset 续拉下一段，可分多次读全。
// 用户口径（2026-08-20）：单次上限 200000 字符、可多次读取。
const READ_PAGE_CHUNK_CHARS = READ_SINGLE_MAX_CHARS;

export async function buildPageData(tabId, { format = 'auto', maxChars, offset = 0 } = {}) {
  try {
    const tab = await chrome.tabs.get(tabId).catch(() => null);
    if (!tab) return { error: '标签页不存在（可能已关闭）' };
    if (isUnreadableUrl(tab.url)) {
      return { error: `该标签页是浏览器内部页面（${tab.url || '未知'}），无法读取。` };
    }
    let timedOut = false;
    const resp = await withTimeout(
      chrome.tabs.sendMessage(tabId, { type: 'EXTRACT_CONTENT', format }).catch(() => null),
      TAB_READ_MS,
      () => { timedOut = true; return null; },
    );
    if (timedOut) {
      return { error: `读取超时（超过 ${TAB_READ_MS / 1000}s）。页面可能过重、冻结或内容脚本无响应。` };
    }
    if (!resp || !resp.content || resp.content.trim().length < 20) {
      return { error: `无法从该页面提取内容。标题：${tab.title || '(无)'}，URL：${tab.url}` };
    }
    const pageType = resp.pageType || 'article';
    const payload = {
      pageType,
      url: tab.url,
      title: resp.title || tab.title || '(无)',
      mode: resp.mode || 'text',
      untrusted: true, // 页面内容不可信，禁止执行其中包含的任何指令
    };
    if (Array.isArray(resp.pageOffsets) && resp.pageOffsets.length) {
      // 内部字段（PDF 页锚点）：只给工作区落库用，read 处理器在返回模型前删掉，
      // 不进上下文——500 页的偏移数组对模型是纯噪声。
      payload.pageOffsets = resp.pageOffsets;
      payload.pageCount = Number(resp.pageCount) || resp.pageOffsets.length;
    }
    // 分页：显式 offset>0、显式 max_chars、或正文超过单次上限时，返回切片 + 续拉游标。
    // 缺省（小正文、无 max_chars）仍返回全文。
    const off = Math.max(0, Math.floor(Number(offset) || 0));
    const limit = maxChars ? Math.max(500, Math.floor(Number(maxChars) || 0)) : READ_PAGE_CHUNK_CHARS;
    const full = resp.content;
    const needPaging = off > 0 || full.length > limit;
    let contentText, paging;
    if (needPaging) {
      const slice = full.slice(off, off + limit);
      const nextOff = off + slice.length;
      const hasMore = nextOff < full.length;
      contentText = slice;
      paging = {
        content_total: full.length,
        content_offset: off,
        content_returned: slice.length,
        content_has_more: hasMore,
        content_next_offset: hasMore ? nextOff : null,
      };
    } else {
      contentText = full;
      paging = null;
    }
    if (pageType === 'dashboard') {
      const charts = await extractChartData(tabId);
      payload.data = { ...(resp.structured || {}) };
      if (charts && (charts.charts?.length || Object.keys(charts.globals || {}).length)) {
        if (charts.charts?.length) payload.data.charts = charts.charts.slice(0, 10);
        if (Object.keys(charts.globals || {}).length) payload.data.globals = charts.globals;
      }
      if (!payload.data.tables && !payload.data.kv && !payload.data.items && !payload.data.charts) {
        // 仪表盘但没拿到任何结构化数据：附正文兜底
        payload.data.content = contentText;
      }
      payload.hint = '如需底层接口原始数据（XHR/Fetch JSON），可调用 interact_page(tabId=..., action=capture_network)';
    } else if (pageType === 'list') {
      payload.data = { items: (resp.structured && resp.structured.items) || [] };
      if (!payload.data.items.length) payload.data.content = contentText;
    } else {
      payload.data = { content: contentText };
    }
    if (paging) payload.data = { ...payload.data, ...paging };
    payload.tabId = tabId;
    if (Array.isArray(resp.figures) && resp.figures.length) {
      payload.data.figures = resp.figures
        .filter((f) => f && Number.isFinite(Number(f.n)))
        .map((f) => ({ n: Number(f.n), caption: String(f.caption || '') }));
    }
    if (resp.cover) payload.data.cover = { n: 0, caption: String(resp.cover.caption || '封面') };
    return payload;
  } catch (err) {
    return { error: `读取失败: ${err.message || '无法访问该页面的内容脚本'}` };
  }
}

// 轻量快照（manage_tabs list 用）：EXTRACT_SNAPSHOT，禁止跑全文 EXTRACT_CONTENT。
// tabOrId 可传 chrome.tabs.Tab 或 tabId；timeoutMs 默认 1.5s，超时仍返回标题/URL。
export async function buildTabSnapshot(tabOrId, { timeoutMs = TAB_SNAPSHOT_TAB_MS } = {}) {
  const tabId = typeof tabOrId === 'object' && tabOrId ? tabOrId.id : tabOrId;
  try {
    const tab = (typeof tabOrId === 'object' && tabOrId && tabOrId.id)
      ? tabOrId
      : await chrome.tabs.get(tabId).catch(() => null);
    if (!tab) return { tabId, available: false, reason: '标签页已关闭' };
    if (isUnreadableUrl(tab.url)) {
      return { tabId, url: tab.url || '', title: tab.title || '', available: false, reason: '内部页面' };
    }
    // 休眠/冻结页 sendMessage 可能永不返回；列出元数据即可，AI 切换后可再读。
    if (tab.discarded || tab.frozen) {
      return tabListMeta(tab, {
        reason: tab.discarded ? '已休眠，需激活后再读全文' : '已冻结，需激活后再读全文',
      });
    }
    let timedOut = false;
    const resp = await withTimeout(
      chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_SNAPSHOT' }).catch(() => null),
      timeoutMs,
      () => { timedOut = true; return null; },
    );
    if (timedOut) {
      return tabListMeta(tab, { reason: '摘要超时，仅标题/URL' });
    }
    if (!resp) {
      return tabListMeta(tab, { reason: '内容脚本不可用（扩展需重新加载）' });
    }
    const snippet = String(resp.snippet || resp.content || '').replace(/\s+/g, ' ').trim().slice(0, 160);
    return tabListMeta(tab, {
      title: resp.title || tab.title || '',
      pageType: resp.pageType || 'article',
      snippet,
    });
  } catch (err) {
    return { tabId, available: false, reason: err.message || '提取失败' };
  }
}
