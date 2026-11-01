/**
 * Side-panel / reader UI locale. Chinese is the source language in HTML;
 * English is applied when the resolved UI locale is `en`.
 *
 * Pref `uiLocale`: `auto` | `zh` | `en`. Auto follows Chrome UI language.
 */

import { UI_LOCALE_KEY, chromeUiLanguage, inferUiLocale } from './locale.js';

const ZH = {
  'nav.collect': '采集',
  'nav.feed': '订阅',
  'nav.projects': '项目',
  'nav.settings': '设置',
  'chat.title': 'AI 对话',
  'chat.placeholder': '戳戳 OhMyTab，说说想干嘛…',
  'chat.tokens': '本对话累计 tokens',
  'chat.toggleWorkspace': '展开/收起工作区',
  'chat.openPage': '在整页打开',
  'chat.export': '导出对话',
  'chat.clear': '清空对话',
  'chat.upload': '上传',
  'chat.heartbeat': '心跳定时任务',
  'chat.switchModel': '切换模型',
  'chat.inputAria': '指令输入框',
  'chat.you': '你',
  'hb.title': '心跳任务',
  'hb.new': '新建',
  'ws.title': '工作区',
  'ws.backChat': '返回对话',
  'ws.search': '搜索来源、笔记、产出',
  'ws.searchAria': '搜索工作区',
  'ws.upload': '上传',
  'ws.exportAll': '导出全部',
  'ws.exportSelected': '导出选中',
  'ws.clear': '按类别清空工作区',
  'ws.clearAria': '清空工作区',
  'ws.trunksAria': '工作区三主干',
  'ws.previewBack': '返回项目概览 (Esc)',
  'ws.overview': '项目概览',
  'ws.sources': '来源',
  'ws.notes': '笔记',
  'ws.outputs': '产出',
  'ws.note.open': '待核实',
  'ws.note.verified': '已核实',
  'ws.note.refuted': '被推翻',
  'ws.note.dropped': '已弃用',
  'feed.sources': '订阅源',
  'feed.refreshAll': '刷新全部',
  'feed.export': '导出',
  'feed.clearNews': '清空新闻',
  'feed.add': '添加订阅源',
  'feed.fromPage': '从当前网页创建',
  'feed.fromPageTitle': '从当前网页可视化创建订阅源',
  'feed.indexing': '正在构建搜索索引…',
  'feed.loading': '加载中...',
  'feed.filterAll': '全部',
  'feed.filterStarred': '星标',
  'feed.search': '搜索条目...',
  'feed.searchAria': '搜索订阅条目',
  'feed.empty': '尚未添加订阅源',
  'feed.selected': '已选 0 项',
  'feed.selectedCount': '已选 {n} 项',
  'feed.collect': '加入来源',
  'feed.collected': '已加入来源',
  'feed.viewSource': '查看来源',
  'feed.cancel': '取消',
  'feed.unknownSource': '未知来源',
  'feed.translated': '译',
  'feed.collapse': '收起',
  'feed.original': '原文 ↗',
  'feed.fetchFull': '抓取全文',
  'feed.noContent': '(无内容)',
  'feed.noTitle': '(无标题)',
  'feed.addTitle': '添加订阅源',
  'feed.close': '关闭',
  'feed.urlLabel': '订阅地址',
  'feed.orOpml': '或导入 OPML 文件',
  'feed.pickOpml': '选择 OPML 文件',
  'feed.scope': '作用域',
  'feed.scopeGlobal': '全局（所有项目可见）',
  'feed.scopeProject': '当前项目专属',
  'feed.addBtn': '添加',
  'feed.editTitle': '编辑订阅源',
  'feed.name': '名称',
  'feed.displayName': '显示名称',
  'feed.interval': '刷新频率',
  'feed.intervalGlobal': '使用全局设置',
  'feed.every15': '每 15 分钟',
  'feed.every30': '每 30 分钟',
  'feed.everyHour': '每小时',
  'feed.every3h': '每 3 小时',
  'feed.every6h': '每 6 小时',
  'feed.every12h': '每 12 小时',
  'feed.pageRefresh': '网页刷新方式',
  'feed.refreshAuto': '自动（HTTP 优先，失败回退渲染）',
  'feed.refreshHttp': '快速 HTTP（不创建标签页）',
  'feed.refreshTab': '兼容渲染（隐藏标签页）',
  'feed.maxItems': '每次拉取最多条数',
  'feed.fromDate': '起始日期',
  'feed.toDate': '结束日期',
  'feed.autoTranslate': '自动翻译到目标语言',
  'feed.save': '保存',
  'feed.delete': '删除此源',
  'webfeed.title': '从当前网页创建订阅源',
  'webfeed.reading': '正在读取当前页面…',
  'webfeed.scanning': '正在页面中识别重复内容…',
  'webfeed.step1': '1. 条目模板',
  'webfeed.repick': '重新框选',
  'webfeed.step2': '2. 字段确认',
  'webfeed.step2hint': '点“改选”后在网页中点击元素',
  'webfeed.step3': '3. 预览',
  'webfeed.refreshPreview': '刷新预览',
  'webfeed.previewEmpty': '完成字段确认后自动预览',
  'webfeed.step4': '4. 订阅设置',
  'webfeed.sourceName': '源名称',
  'webfeed.max': '最多条数',
  'webfeed.refreshHow': '刷新方式',
  'webfeed.hint': '自动模式适合大多数网站；动态渲染或登录后页面会自动改用隐藏标签页。',
  'webfeed.save': '保存为订阅源',
  'lib.newPlaceholder': '新建项目名称...',
  'lib.newAria': '新建项目名称',
  'lib.new': '新建',
  'settings.tab.talk': '对话',
  'settings.tab.feed': '订阅',
  'settings.tab.look': '界面',
  'settings.tab.keep': '维护',
  'settings.channels': '接入渠道',
  'settings.addChannel': '新增渠道',
  'settings.preset': '快速填充',
  'settings.catalogSearch': '或搜索全部厂商（名称 / 域名）…',
  'settings.name': '名称',
  'settings.protocol': '协议',
  'settings.baseUrl': 'Base URL',
  'settings.apiKey': 'API Key',
  'settings.model': '模型',
  'settings.addModel': '添加模型',
  'settings.saveChannel': '保存渠道',
  'settings.saveAsNew': '另存为新渠道',
  'settings.test': '测试连接',
  'settings.cancel': '取消',
  'settings.search': '搜索',
  'settings.addSearch': '新增搜索',
  'settings.save': '保存',
  'settings.testSearch': '测试搜索',
  'settings.api': '外部 API',
  'settings.addApi': '新增连接',
  'settings.auth': '鉴权',
  'settings.subagents': '子代理',
  'settings.sgMaxParallel': '单一批次最多子代理个数',
  'settings.sgMaxTabs': '子代理最多打开网页个数',
  'settings.sgBudget': '单个子代理 token 预算（0 = 不限）',
  'settings.sgMainMaxRounds': '主代理最多轮次（0 = 不限）',
  'settings.sgSubMaxRounds': '子代理最多轮次（0 = 不限）',
  'settings.sgRoundsNote': '接近上限前会提醒模型收尾。',
  'settings.sgCheck': '核验审查模型',
  'settings.sgLimits': '保存限额',
  'settings.sgWhen': '何时委派',
  'settings.sgPrompt': '系统说明',
  'settings.sgTools': '工具',
  'settings.sgChannel': '渠道',
  'settings.sgFollow': '跟随当前',
  'settings.sgSave': '保存自定义子代理',
  'settings.feedRefresh': '订阅刷新',
  'settings.rsshub': 'RSSHub 实例',
  'settings.saveInstance': '保存实例',
  'settings.intervalMin': '自动刷新间隔（分钟）',
  'settings.saveInterval': '保存间隔',
  'settings.translate': '翻译',
  'settings.autoTranslateDefault': '新订阅源默认启用自动翻译',
  'settings.provider': '首选翻译服务',
  'settings.provider.google': 'Google（免费，可能限流）',
  'settings.provider.tencent': '腾讯 TMT（500 万字符/月免费）',
  'settings.provider.local': 'Chrome 本地翻译（离线）',
  'settings.targetLang': '目标语言',
  'settings.targetAuto': '跟随浏览器语言',
  'settings.saveTranslate': '保存翻译设置',
  'settings.retryTranslate': '重试失败条目',
  'settings.translatePrep': '准备翻译…',
  'settings.blacklist': '采集黑名单',
  'settings.add': '添加',
  'settings.currentSite': '当前网站',
  'settings.saveBlacklist': '保存黑名单',
  'settings.look': '外观',
  'settings.color': '颜色',
  'settings.color.light': '白天',
  'settings.color.dark': '黑夜',
  'settings.color.auto': '自动',
  'settings.scale': '界面缩放',
  'settings.scale.auto': '自动',
  'settings.uiLang': '界面语言',
  'settings.uiLang.auto': '自动（跟随浏览器）',
  'settings.uiLang.zh': '简体中文',
  'settings.uiLang.en': 'English',
  'settings.memory': 'AI 记忆',
  'settings.clearMemory': '清空全部记忆',
  'settings.index': '全文索引',
  'settings.rebuildIndex': '重建全文索引',
  'settings.purge': '删除所有项目',
  'settings.purgeNote': '删除全部项目（默认库会清空后保留），含来源、产出、文档原件、证据、笔记、标签、会话和心跳任务。保留 AI 记忆与订阅内容。删除后 4 秒内可撤销。',
  'settings.purgeBtn': '删除所有项目',
  'settings.about': '关于',
  'reader.name': 'OhMyTab 文档阅读器',
  'reader.edit': '编辑',
  'reader.save': '保存',
  'reader.done': '完成',
  'reader.rev': '待审修订',
  'float.cleared': '对话上下文已清空。可以继续追问这段内容。',
};

const EN = {
  'nav.collect': 'Collect',
  'nav.feed': 'Feeds',
  'nav.projects': 'Projects',
  'nav.settings': 'Settings',
  'chat.title': 'AI chat',
  'chat.placeholder': 'Ask OhMyTab…',
  'chat.tokens': 'Tokens used in this chat',
  'chat.toggleWorkspace': 'Show or hide workspace',
  'chat.openPage': 'Open as a full page',
  'chat.export': 'Export chat',
  'chat.clear': 'Clear chat',
  'chat.upload': 'Upload',
  'chat.heartbeat': 'Scheduled tasks',
  'chat.switchModel': 'Switch model',
  'chat.inputAria': 'Prompt',
  'chat.you': 'You',
  'hb.title': 'Scheduled tasks',
  'hb.new': 'New',
  'ws.title': 'Workspace',
  'ws.backChat': 'Back to chat',
  'ws.search': 'Search sources, notes, outputs',
  'ws.searchAria': 'Search workspace',
  'ws.upload': 'Upload',
  'ws.exportAll': 'Export all',
  'ws.exportSelected': 'Export selected',
  'ws.clear': 'Clear workspace by category',
  'ws.clearAria': 'Clear workspace',
  'ws.trunksAria': 'Workspace trunks',
  'ws.previewBack': 'Back to overview (Esc)',
  'ws.overview': 'Project overview',
  'ws.sources': 'Sources',
  'ws.notes': 'Notes',
  'ws.outputs': 'Outputs',
  'ws.note.open': 'Open',
  'ws.note.verified': 'Verified',
  'ws.note.refuted': 'Refuted',
  'ws.note.dropped': 'Dropped',
  'feed.sources': 'Feeds',
  'feed.refreshAll': 'Refresh all',
  'feed.export': 'Export',
  'feed.clearNews': 'Clear items',
  'feed.add': 'Add feed',
  'feed.fromPage': 'Create from this page',
  'feed.fromPageTitle': 'Build a feed visually from the current page',
  'feed.indexing': 'Building search index…',
  'feed.loading': 'Loading…',
  'feed.filterAll': 'All',
  'feed.filterStarred': 'Starred',
  'feed.search': 'Search items…',
  'feed.searchAria': 'Search feed items',
  'feed.empty': 'No feeds yet',
  'feed.selected': '0 selected',
  'feed.selectedCount': '{n} selected',
  'feed.collect': 'Add to sources',
  'feed.collected': 'In sources',
  'feed.viewSource': 'Open source',
  'feed.cancel': 'Cancel',
  'feed.unknownSource': 'Unknown feed',
  'feed.translated': 'tr',
  'feed.collapse': 'Collapse',
  'feed.original': 'Original ↗',
  'feed.fetchFull': 'Fetch full text',
  'feed.noContent': '(No content)',
  'feed.noTitle': '(Untitled)',
  'feed.addTitle': 'Add feed',
  'feed.close': 'Close',
  'feed.urlLabel': 'Feed URL',
  'feed.orOpml': 'Or import an OPML file',
  'feed.pickOpml': 'Choose OPML',
  'feed.scope': 'Scope',
  'feed.scopeGlobal': 'Global (all projects)',
  'feed.scopeProject': 'This project only',
  'feed.addBtn': 'Add',
  'feed.editTitle': 'Edit feed',
  'feed.name': 'Name',
  'feed.displayName': 'Display name',
  'feed.interval': 'Refresh interval',
  'feed.intervalGlobal': 'Use global setting',
  'feed.every15': 'Every 15 minutes',
  'feed.every30': 'Every 30 minutes',
  'feed.everyHour': 'Hourly',
  'feed.every3h': 'Every 3 hours',
  'feed.every6h': 'Every 6 hours',
  'feed.every12h': 'Every 12 hours',
  'feed.pageRefresh': 'Page refresh mode',
  'feed.refreshAuto': 'Auto (HTTP first, fall back to a tab)',
  'feed.refreshHttp': 'Fast HTTP (no tab)',
  'feed.refreshTab': 'Rendered tab (hidden)',
  'feed.maxItems': 'Max items per fetch',
  'feed.fromDate': 'From',
  'feed.toDate': 'To',
  'feed.autoTranslate': 'Auto-translate to the target language',
  'feed.save': 'Save',
  'feed.delete': 'Delete feed',
  'webfeed.title': 'Create a feed from this page',
  'webfeed.reading': 'Reading the current page…',
  'webfeed.scanning': 'Looking for repeating items on the page…',
  'webfeed.step1': '1. Item template',
  'webfeed.repick': 'Reselect',
  'webfeed.step2': '2. Fields',
  'webfeed.step2hint': 'Click “Change” then click an element on the page',
  'webfeed.step3': '3. Preview',
  'webfeed.refreshPreview': 'Refresh preview',
  'webfeed.previewEmpty': 'Preview appears after fields are confirmed',
  'webfeed.step4': '4. Feed settings',
  'webfeed.sourceName': 'Feed name',
  'webfeed.max': 'Max items',
  'webfeed.refreshHow': 'Refresh mode',
  'webfeed.hint': 'Auto works for most sites. Dynamic or logged-in pages fall back to a hidden tab.',
  'webfeed.save': 'Save as feed',
  'lib.newPlaceholder': 'New project name…',
  'lib.newAria': 'New project name',
  'lib.new': 'Create',
  'settings.tab.talk': 'Chat',
  'settings.tab.feed': 'Feeds',
  'settings.tab.look': 'Look',
  'settings.tab.keep': 'Maintain',
  'settings.channels': 'AI channels',
  'settings.addChannel': 'Add channel',
  'settings.preset': 'Presets',
  'settings.catalogSearch': 'Search providers (name / domain)…',
  'settings.name': 'Name',
  'settings.protocol': 'Protocol',
  'settings.baseUrl': 'Base URL',
  'settings.apiKey': 'API Key',
  'settings.model': 'Model',
  'settings.addModel': 'Add model',
  'settings.saveChannel': 'Save channel',
  'settings.saveAsNew': 'Save as new',
  'settings.test': 'Test',
  'settings.cancel': 'Cancel',
  'settings.search': 'Search',
  'settings.addSearch': 'Add search',
  'settings.save': 'Save',
  'settings.testSearch': 'Test search',
  'settings.api': 'External APIs',
  'settings.addApi': 'Add connector',
  'settings.auth': 'Auth',
  'settings.subagents': 'Subagents',
  'settings.sgMaxParallel': 'Max subagents per batch',
  'settings.sgMaxTabs': 'Max tabs a subagent may open',
  'settings.sgBudget': 'Token budget per subagent (0 = unlimited)',
  'settings.sgMainMaxRounds': 'Main agent max rounds (0 = unlimited)',
  'settings.sgSubMaxRounds': 'Subagent max rounds (0 = unlimited)',
  'settings.sgRoundsNote': 'The model is asked to wrap up before the limit.',
  'settings.sgCheck': 'Review model',
  'settings.sgLimits': 'Save limits',
  'settings.sgWhen': 'When to delegate',
  'settings.sgPrompt': 'System instructions',
  'settings.sgTools': 'Tools',
  'settings.sgChannel': 'Channel',
  'settings.sgFollow': 'Follow current',
  'settings.sgSave': 'Save custom subagent',
  'settings.feedRefresh': 'Feed refresh',
  'settings.rsshub': 'RSSHub instance',
  'settings.saveInstance': 'Save instance',
  'settings.intervalMin': 'Refresh interval (minutes)',
  'settings.saveInterval': 'Save interval',
  'settings.translate': 'Translation',
  'settings.autoTranslateDefault': 'Enable auto-translate for new feeds',
  'settings.provider': 'Preferred translator',
  'settings.provider.google': 'Google (free, may rate-limit)',
  'settings.provider.tencent': 'Tencent TMT (5M chars/month free)',
  'settings.provider.local': 'Chrome on-device translator',
  'settings.targetLang': 'Target language',
  'settings.targetAuto': 'Follow browser language',
  'settings.saveTranslate': 'Save translation settings',
  'settings.retryTranslate': 'Retry failed items',
  'settings.translatePrep': 'Preparing translation…',
  'settings.blacklist': 'Collection blocklist',
  'settings.add': 'Add',
  'settings.currentSite': 'This site',
  'settings.saveBlacklist': 'Save blocklist',
  'settings.look': 'Appearance',
  'settings.color': 'Color',
  'settings.color.light': 'Light',
  'settings.color.dark': 'Dark',
  'settings.color.auto': 'Auto',
  'settings.scale': 'UI scale',
  'settings.scale.auto': 'Auto',
  'settings.uiLang': 'Interface language',
  'settings.uiLang.auto': 'Auto (follow browser)',
  'settings.uiLang.zh': '简体中文',
  'settings.uiLang.en': 'English',
  'settings.memory': 'AI memory',
  'settings.clearMemory': 'Clear all memories',
  'settings.index': 'Full-text index',
  'settings.rebuildIndex': 'Rebuild index',
  'settings.purge': 'Delete all projects',
  'settings.purgeNote': 'Deletes every project (the default library is emptied and kept), including sources, outputs, originals, evidence, notes, tags, chat, and scheduled tasks. Keeps AI memory and feeds. Undo is available for 4 seconds.',
  'settings.purgeBtn': 'Delete all projects',
  'settings.about': 'About',
  'reader.name': 'OhMyTab reader',
  'reader.edit': 'Edit',
  'reader.save': 'Save',
  'reader.done': 'Done',
  'reader.rev': 'Pending revisions',
  'float.cleared': 'Chat context cleared. You can keep asking about this page.',
};

const DICT = { zh: ZH, en: EN };

let pref = 'auto';
let resolved = inferUiLocale(chromeUiLanguage());

export function getUiLocalePref() {
  return pref;
}

export function getUiLocale() {
  return resolved;
}

function resolvePref(p) {
  const v = p === 'en' || p === 'zh' || p === 'auto' ? p : 'auto';
  return v === 'auto' ? inferUiLocale(chromeUiLanguage()) : v;
}

export async function initI18n() {
  pref = 'auto';
  try {
    const r = await chrome.storage.local.get(UI_LOCALE_KEY);
    if (r && (r[UI_LOCALE_KEY] === 'zh' || r[UI_LOCALE_KEY] === 'en' || r[UI_LOCALE_KEY] === 'auto')) {
      pref = r[UI_LOCALE_KEY];
    }
  } catch (_) { /* ignore */ }
  resolved = resolvePref(pref);
  return resolved;
}

export async function setUiLocalePref(next) {
  pref = next === 'en' || next === 'zh' ? next : 'auto';
  resolved = resolvePref(pref);
  try { await chrome.storage.local.set({ [UI_LOCALE_KEY]: pref }); } catch (_) { /* ignore */ }
  return resolved;
}

export function t(key) {
  const table = DICT[resolved] || ZH;
  return table[key] || ZH[key] || key;
}

function setText(el, key) {
  if (!el) return;
  const val = t(key);
  if (el.childElementCount === 0) {
    el.textContent = val;
    return;
  }
  const span = el.querySelector('span:not(:empty)');
  if (span && !span.querySelector('svg') && span.childElementCount === 0) {
    span.textContent = val;
    return;
  }
  const textNode = [...el.childNodes].find((n) => n.nodeType === 3 && n.textContent.trim());
  if (textNode) {
    textNode.textContent = (textNode.textContent.startsWith('\n') ? '\n' : '') + val;
  }
}

function setAttr(el, name, key) {
  if (el) el.setAttribute(name, t(key));
}

export function applyDomI18n(root = document) {
  const doc = root.documentElement ? root : document;
  const html = doc.documentElement;
  if (html) html.lang = resolved === 'zh' ? 'zh-CN' : 'en';
  const $ = (sel) => doc.querySelector(sel);
  const $$ = (sel) => [...doc.querySelectorAll(sel)];

  setText($('.chat-title'), 'chat.title');
  setAttr($('#chatTokenMeter'), 'title', 'chat.tokens');
  setAttr($('#toggleLibBtn'), 'title', 'chat.toggleWorkspace');
  setAttr($('#toggleLibBtn'), 'aria-label', 'chat.toggleWorkspace');
  setAttr($('#surfaceToggleBtn'), 'title', 'chat.openPage');
  setAttr($('#surfaceToggleBtn'), 'aria-label', 'chat.openPage');
  setAttr($('#chatExportBtn'), 'title', 'chat.export');
  setAttr($('#chatExportBtn'), 'aria-label', 'chat.export');
  setAttr($('#cmdClearBtn'), 'title', 'chat.clear');
  setText($('.hb-title'), 'hb.title');
  setText($('#hbAddBtn'), 'hb.new');
  setAttr($('#cmdInput'), 'placeholder', 'chat.placeholder');
  setAttr($('#cmdInput'), 'aria-label', 'chat.inputAria');
  setAttr($('#cmdAttachBtn'), 'title', 'chat.upload');
  setAttr($('#cmdAttachBtn'), 'aria-label', 'chat.upload');
  setAttr($('#cmdHeartbeatBtn'), 'title', 'chat.heartbeat');
  setAttr($('#cmdHeartbeatBtn'), 'aria-label', 'chat.heartbeat');
  setAttr($('#chatChannelSwitch'), 'title', 'chat.switchModel');

  setText($('.ws-title'), 'ws.title');
  setAttr($('#wsBackChatBtn'), 'title', 'ws.backChat');
  setAttr($('#wsBackChatBtn'), 'aria-label', 'ws.backChat');
  setAttr($('#wsSearchInput'), 'placeholder', 'ws.search');
  setAttr($('#wsSearchInput'), 'aria-label', 'ws.searchAria');
  setAttr($('#wsImportBtn'), 'title', 'ws.upload');
  setAttr($('#wsImportBtn'), 'aria-label', 'ws.upload');
  setAttr($('#exportAllBtn'), 'title', 'ws.exportAll');
  setAttr($('#exportAllBtn'), 'aria-label', 'ws.exportAll');
  setAttr($('#exportSelectedBtn'), 'title', 'ws.exportSelected');
  setAttr($('#exportSelectedBtn'), 'aria-label', 'ws.exportSelected');
  setAttr($('#clearAllBtn'), 'title', 'ws.clear');
  setAttr($('#clearAllBtn'), 'aria-label', 'ws.clearAria');
  setAttr($('#wsTree'), 'aria-label', 'ws.trunksAria');
  setAttr($('#wsPreviewBack'), 'title', 'ws.previewBack');
  setAttr($('#wsPreviewBack'), 'aria-label', 'ws.previewBack');
  const overviewBtnSpan = $('#wsPreviewBack span');
  if (overviewBtnSpan) overviewBtnSpan.textContent = t('ws.overview');
  const overviewTitle = $('#wsPreviewTitle');
  if (overviewTitle && /项目概览|Project overview/.test(overviewTitle.textContent || '')) {
    overviewTitle.textContent = t('ws.overview');
  }

  setText($('.feed-sidebar-title'), 'feed.sources');
  setAttr($('#feedRefreshAllBtn'), 'title', 'feed.refreshAll');
  setAttr($('#feedExportBtn'), 'title', 'feed.export');
  setAttr($('#feedDeleteAllItemsBtn'), 'title', 'feed.clearNews');
  setAttr($('#feedAddBtn'), 'title', 'feed.add');
  setAttr($('#feedCreateWebBtn'), 'title', 'feed.fromPageTitle');
  setText($('#feedCreateWebBtn span'), 'feed.fromPage');
  setText($('.feed-index-progress-label'), 'feed.indexing');
  const skeleton = $('.feed-source-skeleton');
  if (skeleton) skeleton.textContent = t('feed.loading');
  $$('.feed-filter-btn').forEach((btn) => {
    if (btn.dataset.filter === 'all') btn.textContent = t('feed.filterAll');
    if (btn.dataset.filter === 'starred') btn.textContent = t('feed.filterStarred');
  });
  setAttr($('#feedSearchInput'), 'placeholder', 'feed.search');
  setAttr($('#feedSearchInput'), 'aria-label', 'feed.searchAria');
  setText($('#feedEmptyState p'), 'feed.empty');
  setText($('#feedCollectBtn'), 'feed.collect');
  setText($('#feedClearSelectedBtn'), 'feed.cancel');

  setText($('#feedAddDialogTitle'), 'feed.addTitle');
  setAttr($('#feedDialogCloseBtn'), 'aria-label', 'feed.close');
  const urlLabel = doc.querySelector('label[for="feedUrlInput"]');
  if (urlLabel) urlLabel.textContent = t('feed.urlLabel');
  const opmlLabel = $('#feedOpmlPickBtn')?.closest('.feed-dialog-field')?.querySelector('label');
  if (opmlLabel) opmlLabel.textContent = t('feed.orOpml');
  setText($('#feedOpmlPickBtn'), 'feed.pickOpml');
  setText($('#feedDialogAddBtn'), 'feed.addBtn');
  setText($('#feedDialogCancelBtn'), 'feed.cancel');

  setText($('#feedEditDialogTitle'), 'feed.editTitle');
  setAttr($('#feedEditCloseBtn'), 'aria-label', 'feed.close');
  const nameLabel = doc.querySelector('label[for="feedEditTitle"]');
  if (nameLabel) nameLabel.textContent = t('feed.name');
  setAttr($('#feedEditTitle'), 'placeholder', 'feed.displayName');
  const intervalLabel = doc.querySelector('label[for="feedEditInterval"]');
  if (intervalLabel) intervalLabel.textContent = t('feed.interval');
  const maxLabel = doc.querySelector('label[for="feedEditMax"]');
  if (maxLabel) maxLabel.textContent = t('feed.maxItems');
  const fromLabel = doc.querySelector('label[for="feedEditFrom"]');
  if (fromLabel) fromLabel.textContent = t('feed.fromDate');
  const toLabel = doc.querySelector('label[for="feedEditTo"]');
  if (toLabel) toLabel.textContent = t('feed.toDate');
  const autoSpan = $('#feedEditAutoTranslate')?.parentElement?.querySelector('span');
  if (autoSpan) autoSpan.textContent = t('feed.autoTranslate');
  setText($('#feedEditSaveBtn'), 'feed.save');
  setText($('#feedEditDeleteBtn'), 'feed.delete');
  setText($('#feedEditCancelBtn'), 'feed.cancel');

  const intervalSelect = $('#feedEditInterval');
  if (intervalSelect) {
    const map = {
      0: 'feed.intervalGlobal', 15: 'feed.every15', 30: 'feed.every30',
      60: 'feed.everyHour', 180: 'feed.every3h', 360: 'feed.every6h', 720: 'feed.every12h',
    };
    [...intervalSelect.options].forEach((opt) => {
      const k = map[opt.value];
      if (k) opt.textContent = t(k);
    });
  }
  const modeSelect = $('#feedEditRefreshMode');
  if (modeSelect) {
    const map = { auto: 'feed.refreshAuto', http: 'feed.refreshHttp', tab: 'feed.refreshTab' };
    [...modeSelect.options].forEach((opt) => { if (map[opt.value]) opt.textContent = t(map[opt.value]); });
  }

  setText($('#webFeedDialogTitle'), 'webfeed.title');
  setAttr($('#webFeedDialogCloseBtn'), 'aria-label', 'feed.close');
  const pageTitle = $('#webFeedPageTitle');
  if (pageTitle && /正在读取|Reading the current/.test(pageTitle.textContent || '')) {
    pageTitle.textContent = t('webfeed.reading');
  }
  setText($('#webFeedPickStatusText'), 'webfeed.scanning');
  setText($('#webFeedRepickBtn'), 'webfeed.repick');
  setText($('#webFeedPreviewBtn'), 'webfeed.refreshPreview');
  const previewEmpty = $('.web-feed-preview-empty');
  if (previewEmpty) previewEmpty.textContent = t('webfeed.previewEmpty');
  const webTitleLabel = doc.querySelector('label[for="webFeedTitleInput"]');
  if (webTitleLabel) webTitleLabel.textContent = t('webfeed.sourceName');
  const webIntervalLabel = doc.querySelector('label[for="webFeedIntervalSelect"]');
  if (webIntervalLabel) webIntervalLabel.textContent = t('feed.interval');
  const webMaxLabel = doc.querySelector('label[for="webFeedMaxInput"]');
  if (webMaxLabel) webMaxLabel.textContent = t('webfeed.max');
  const webModeLabel = doc.querySelector('label[for="webFeedRefreshModeSelect"]');
  if (webModeLabel) webModeLabel.textContent = t('webfeed.refreshHow');
  const webHint = $('#webFeedRefreshModeSelect')?.parentElement?.querySelector('.feed-dialog-hint');
  if (webHint) webHint.textContent = t('webfeed.hint');
  setText($('#webFeedSaveBtn'), 'webfeed.save');
  setText($('#webFeedCancelBtn'), 'feed.cancel');
  $$('#webFeedRecipePanel .web-feed-section-title').forEach((el, i) => {
    const keys = ['webfeed.step1', 'webfeed.step2', 'webfeed.step3', 'webfeed.step4'];
    if (keys[i]) el.textContent = t(keys[i]);
  });
  const step2hint = $('.web-feed-section-hint');
  if (step2hint) step2hint.textContent = t('webfeed.step2hint');
  const webInterval = $('#webFeedIntervalSelect');
  if (webInterval) {
    const map = {
      15: 'feed.every15', 30: 'feed.every30', 60: 'feed.everyHour',
      180: 'feed.every3h', 360: 'feed.every6h', 720: 'feed.every12h',
    };
    [...webInterval.options].forEach((opt) => { if (map[opt.value]) opt.textContent = t(map[opt.value]); });
  }
  const webMode = $('#webFeedRefreshModeSelect');
  if (webMode) {
    const map = { auto: 'feed.refreshAuto', http: 'feed.refreshHttp', tab: 'feed.refreshTab' };
    [...webMode.options].forEach((opt) => { if (map[opt.value]) opt.textContent = t(map[opt.value]); });
  }

  setAttr($('#newLibraryInput'), 'placeholder', 'lib.newPlaceholder');
  setAttr($('#newLibraryInput'), 'aria-label', 'lib.newAria');
  setText($('#addLibraryBtn'), 'lib.new');

  const h3 = (sel, key) => {
    const el = typeof sel === 'string' ? $(sel) : sel;
    if (el) el.textContent = t(key);
  };
  $$('#panelSettings h3').forEach((el) => {
    const map = {
      '接入渠道': 'settings.channels', 'AI channels': 'settings.channels',
      '搜索': 'settings.search', 'Search': 'settings.search',
      '外部 API': 'settings.api', 'External APIs': 'settings.api',
      '子代理': 'settings.subagents', 'Subagents': 'settings.subagents',
      '订阅刷新': 'settings.feedRefresh', 'Feed refresh': 'settings.feedRefresh',
      '翻译': 'settings.translate', 'Translation': 'settings.translate',
      '采集黑名单': 'settings.blacklist', 'Collection blocklist': 'settings.blacklist',
      '外观': 'settings.look', 'Appearance': 'settings.look',
      'AI 记忆': 'settings.memory', 'AI memory': 'settings.memory',
      '全文索引': 'settings.index', 'Full-text index': 'settings.index',
      '清空库内容': 'settings.purge', 'Clear library': 'settings.purge',
      '删除所有项目': 'settings.purge', 'Delete all projects': 'settings.purge',
      '关于': 'settings.about', 'About': 'settings.about',
    };
    const k = map[el.textContent.trim()];
    if (k) h3(el, k);
  });

  setText($('#addChannelBtn'), 'settings.addChannel');
  setText($('#addSearchChannelBtn'), 'settings.addSearch');
  setText($('#addApiConnectorBtn'), 'settings.addApi');
  setText($('#saveChannelBtn'), 'settings.saveChannel');
  setText($('#saveAsNewChannelBtn'), 'settings.saveAsNew');
  setText($('#testChannelBtn'), 'settings.test');
  setText($('#cancelChannelBtn'), 'settings.cancel');
  setText($('#saveSearchChannelBtn'), 'settings.save');
  setText($('#testSearchChannelBtn'), 'settings.testSearch');
  setText($('#cancelSearchChannelBtn'), 'settings.cancel');
  setText($('#saveApiConnectorBtn'), 'settings.save');
  setText($('#cancelApiConnectorBtn'), 'settings.cancel');
  setText($('#sgLimitsSaveBtn'), 'settings.sgLimits');
  setText($('#sgSaveBtn'), 'settings.sgSave');
  setText($('#saveRsshubBtn'), 'settings.saveInstance');
  setText($('#saveRefreshIntervalBtn'), 'settings.saveInterval');
  setText($('#saveFeedPrefsBtn'), 'settings.saveTranslate');
  setText($('#retryFailedTranslationsBtn'), 'settings.retryTranslate');
  setText($('#addDomainBtn'), 'settings.add');
  setText($('#addCurrentBtn'), 'settings.currentSite');
  setText($('#saveBlacklistBtn'), 'settings.saveBlacklist');
  setText($('#clearMemoryBtn'), 'settings.clearMemory');
  setText($('#feedRebuildIndexBtn'), 'settings.rebuildIndex');
  setText($('#purgeAllLibraryBtn'), 'settings.purgeBtn');
  const purgeNote = $('#purgeAllNote') || $('.settings-note');
  if (purgeNote) purgeNote.textContent = t('settings.purgeNote');
  setText($('#translateProgressLabel'), 'settings.translatePrep');
  const autoDefault = $('#feedAutoTranslate')?.parentElement?.querySelector('span');
  if (autoDefault) autoDefault.textContent = t('settings.autoTranslateDefault');

  const labelFor = (id, key) => {
    const el = doc.querySelector(`label[for="${id}"]`);
    if (el) el.textContent = t(key);
  };
  labelFor('translateProvider', 'settings.provider');
  labelFor('feedTargetLang', 'settings.targetLang');
  labelFor('rsshubInstance', 'settings.rsshub');
  labelFor('feedRefreshInterval', 'settings.intervalMin');
  labelFor('colorSchemeSelect', 'settings.color');
  labelFor('uiScaleSelect', 'settings.scale');
  labelFor('uiLocaleSelect', 'settings.uiLang');
  labelFor('sgMaxParallel', 'settings.sgMaxParallel');
  labelFor('sgMaxTabs', 'settings.sgMaxTabs');
  labelFor('sgBudgetTokens', 'settings.sgBudget');
  labelFor('sgMainMaxRounds', 'settings.sgMainMaxRounds');
  labelFor('sgSubMaxRounds', 'settings.sgSubMaxRounds');
  const roundsNote = doc.querySelector('.sg-limit-note');
  if (roundsNote) roundsNote.textContent = t('settings.sgRoundsNote');
  labelFor('sgCheckChannel', 'settings.sgCheck');
  labelFor('sgName', 'settings.name');
  labelFor('sgDesc', 'settings.sgWhen');
  labelFor('sgPrompt', 'settings.sgPrompt');
  labelFor('sgTools', 'settings.sgTools');
  labelFor('sgChannel', 'settings.sgChannel');
  labelFor('chName', 'settings.name');
  labelFor('chProtocol', 'settings.protocol');
  labelFor('chBaseUrl', 'settings.baseUrl');
  labelFor('chApiKey', 'settings.apiKey');

  const colorSel = $('#colorSchemeSelect');
  if (colorSel) {
    const map = { light: 'settings.color.light', dark: 'settings.color.dark', auto: 'settings.color.auto' };
    [...colorSel.options].forEach((opt) => { if (map[opt.value]) opt.textContent = t(map[opt.value]); });
  }
  const scaleSel = $('#uiScaleSelect');
  if (scaleSel) {
    const autoOpt = [...scaleSel.options].find((o) => o.value === 'auto');
    if (autoOpt) autoOpt.textContent = t('settings.scale.auto');
  }
  const locSel = $('#uiLocaleSelect');
  if (locSel) {
    const map = { auto: 'settings.uiLang.auto', zh: 'settings.uiLang.zh', en: 'settings.uiLang.en' };
    [...locSel.options].forEach((opt) => { if (map[opt.value]) opt.textContent = t(map[opt.value]); });
  }
  const provSel = $('#translateProvider');
  if (provSel) {
    const map = {
      google: 'settings.provider.google',
      tencent: 'settings.provider.tencent',
      local: 'settings.provider.local',
    };
    [...provSel.options].forEach((opt) => { if (map[opt.value]) opt.textContent = t(map[opt.value]); });
  }
  const langSel = $('#feedTargetLang');
  if (langSel) {
    const autoOpt = [...langSel.options].find((o) => o.value === 'auto');
    if (autoOpt) autoOpt.textContent = t('settings.targetAuto');
  }

  const tab0 = $('#tab-btn-0');
  setAttr(tab0, 'title', 'nav.collect');
  setAttr(tab0, 'aria-label', 'nav.collect');
  const tab1 = $('#tab-btn-1');
  setAttr(tab1, 'title', 'nav.feed');
  setAttr(tab1, 'aria-label', 'nav.feed');
  const tab2 = $('#tab-btn-2');
  setAttr(tab2, 'title', 'nav.projects');
  setAttr(tab2, 'aria-label', 'nav.projects');
  const tab3 = $('#tab-btn-3');
  setAttr(tab3, 'title', 'nav.settings');
  setAttr(tab3, 'aria-label', 'nav.settings');

  const rdName = $('.rd-name');
  if (rdName) rdName.textContent = t('reader.name');
  if (doc.title && /OhMyTab/.test(doc.title)) {
    doc.title = resolved === 'zh' ? 'OhMyTab' : 'OhMyTab';
  }
  const readerTitle = doc.querySelector('title');
  if (readerTitle && /文档阅读器|reader/i.test(readerTitle.textContent || '')) {
    readerTitle.textContent = t('reader.name');
  }
  const editBtn = $('#editBtn');
  if (editBtn) { editBtn.textContent = t('reader.edit'); setAttr(editBtn, 'title', 'reader.edit'); }
  const saveBtn = $('#saveBtn');
  if (saveBtn) { saveBtn.textContent = t('reader.save'); setAttr(saveBtn, 'title', 'reader.save'); }
  const doneBtn = $('#doneBtn');
  if (doneBtn) { doneBtn.textContent = t('reader.done'); setAttr(doneBtn, 'title', 'reader.done'); }
  setAttr($('#revBadge'), 'title', 'reader.rev');
}

export { UI_LOCALE_KEY };
