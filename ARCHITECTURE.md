# SuperCat 架构说明（面向 AI 协作者）

> 本文是给后续 AI 助手阅读的「项目地图」。目标：让你不读完所有代码也能快速定位「在哪改、怎么改、改了会影响谁」。
>
> 项目代号：**SuperCat**（仓库 `trusted-source-collector`）
> 形态：**Chrome MV3 扩展**，Side Panel 形态的 AI 网页采集 + RSS 聚合 + DOCX 导出 + **文档阅读器/标注/编辑** 工具。
>
> **维护约定**：改了 `src/*` 就要同步更新本文对应章节（模块表 §4 / 消息路由 §5 / 数据流 §6 / UI §7 / 陷阱 §9 / 依赖 §10）。数字、字段名、版本号一律以代码为准，不要凭记忆抄。

---

## 0. 你最先要知道的 5 件事

1. **构建产物在 `dist/`**，Chrome 加载扩展时加载的就是这个目录。源码改完必须 `npm run build`。
2. **Service Worker 是消息总线**：`src/background/service-worker.js` 用 `chrome.runtime.onMessage` 的 `switch(message.type)` 路由一切。要加新功能，**先在这里加一个 `case`**，再让 panel/content/reader 发对应消息。
3. **五套持久化**，分工严格：
   - `chrome.storage.sync`  -- 用户配置（API Key、黑名单、项目级配置、当前项目 id）
    - `chrome.storage.local` -- 工作区 Entry（`entries_{projectId}`）、笔记（`notebook_{projectId}`）、**任务清单（`plan_{projectId}`）**、schema 版本 `workspaceSchemaVersion=2`、RSS 偏好、AI 渠道/记忆/自定义 Sub、标注、聊天会话与心跳任务。清空来源/笔记/产出不会顺带清空聊天。
   - `IndexedDB (citecat-feeds, v3)` -- RSS 订阅源 + items（v2：`publishedAt` 单字段索引；v3：`itemTokens` 2-gram 倒排 + `seqPub`）
   - `IndexedDB (citecat-docs, v1)` -- 上传/生成的文档**原始二进制原件**（PDF/Word/Excel/CSV 的 ArrayBuffer，按 docId 存，供阅读器预览、编辑回写、下载）
   - `IndexedDB (citecat-artifacts, v2)` -- 可按 `doc_id#anchor` 回读的来源快照与 chunks；记录 provenance、信任等级、来源 Entry、SHA-256 与采集时间
4. **构建有坑**：`build.js` 会**手动剥离 Vite 注入到 SW 里的 `__vitePreload` / `detectScriptRel`**（这俩用了 `window/document`，SW 里运行直接崩）。改 `build.js` 前先看 `fixServiceWorker()`。reader/编辑器依赖（pdfjs/docx-preview/Univer/jszip/xlsx）走**动态 `import()`**，按需拆到 `dist/chunks/`，不拖累常驻 bundle。
5. **Side Panel 入口路径不要乱动**：manifest 指向 `src/sidepanel/index.html`，构建后位于 `dist/src/sidepanel/index.html`，脚本相对它定位为 `../../sidepanel/panel.js`。阅读器入口 `src/reader/index.html` 构建后位于 `dist/src/reader/index.html`，由 `chrome.tabs.create({url: chrome.runtime.getURL('src/reader/index.html?...')})` 打开。是历史路径，全靠这个能跑。

---

## 1. 高层架构图

```
┌────────────────────────────────────────────────────────────────────────────┐
│                          Chrome MV3 Extension                              │
│                                                                            │
│  ┌──────────────┐    ┌────────────────────┐    ┌─────────────────────┐    │
│  │  网页 Tab     │    │   Side Panel UI    │    │  扩展图标 (action)   │    │
│  │ <all_urls>   │    │   (sidepanel/*)    │    │  点击 -> 打开侧栏      │    │
│  │ content/global│    │   panel.js 主面板   │    └──────────┬──────────┘    │
│  │ · 提取/检视    │    │   feed-view.js     │               │ onClicked    │
│  │ · 标注/高亮    │    │   采集/文库/设置     │               ▼              │
│  │ · 浮动聊天窗   │    └─────────┬──────────┘    ┌─────────────────────┐    │
│  │ · 圆形 checkbox │              │ DOM 事件        │ 文档阅读器 Tab        │    │
│  └──────┬───────┘               │                 │ src/reader/index.html │    │
│         │              ┌────────┴────────┐         │ reader.js            │    │
│  ┌──────┴──────────┐   │ chat-prompt.js  │         │ · PDF/docx/xlsx 渲染  │    │
│  │ chat-executor.js │   │ history-compact │         │ · 划词标注/片段收藏    │    │
│  │ (工具执行内核,    │   │ rss-tools.js    │         │ · 浮动聊天 + 编辑模式  │    │
│  │  三宿主共享)      │   └────────┬────────┘         │ doc-edit-sheets/word │    │
│  └─────────────────┘            │                  └──────────┬──────────┘    │
│         │ chrome.runtime.sendMessage / connect              │                │
│         ▼                                                       ▼                │
│  ╔═══════════════════════════════════════════════════════════════════════╗  │
│  ║         Service Worker (background/service-worker.js)                  ║  │
│  ║  ── 消息中枢 / 业务编排 / alarms / tabs / scripting / debugger ──       ║  │
│  ║                                                                       ║  │
│  ║  switch(message.type) { COLLECT / FEED_* / TRANSLATE_* /               ║  │
│  ║    TAB_* / READER_* / DOC_EDIT /                                       ║  │
│  ║    COLLECT_SNIPPET / EXTRACT_CHART_DATA ... }                          ║  │
│  ║  + onConnect('ann-chat') 浮动聊天长连接端口（content/reader 共用）        ║  │
│  ╚══════════════════════════╤════════════════════════════════════════════╝  │
│                            │ import                                       │
│                     src/lib/* （领域服务）                                   │
│  ┌──────────┬──────────┬──────────┬───────────┬───────────┬───────────┐   │
│  │extractor │ai-client │md-to-docx │create-docx│feed-* 系列 │translator │   │
│  │extract-  │tools(定义)│doc-import│video-ext │(fetcher/   │(local+    │   │
│  │ common   │similarity│doc-import│video-ext │parser/db/  │ cloud)    │   │
│  │html-utils│tag-library│doc-marks │          │backfill/   │limits     │   │
│  │page-data │chat-exec │doc-store │          │rsshub-fall │external-  │   │
│  │vision-cli│          │annota-   │          │            │ bridge    │   │
│  │tab-session│         │tions     │          │            │           │   │
│  │doc-edit-*│          │          │          │            │           │   │
│  └──────────┴──────────┴──────────┴───────────┴───────────┴───────────┘   │
│                                                                            │
│  持久化:  chrome.storage.sync   (配置)                                      │
│           chrome.storage.local  (文库 entries + feedPrefs)             │
│                                   + externalBridge + installationId       │
│                                   + agentMemories + effortProbeCache       │
│                                   + annotations_<url> + annotations_index)│
│           IndexedDB "citecat-feeds" v3 (feeds + items + itemTokens + seqPub) │
│           IndexedDB "citecat-docs"  v1 (files = 文档原始二进制原件)         │
└────────────────────────────────────────────────────────────────────────────┘
              │ HTTPS
              ▼
   ┌────────────────────────────────────────────────────────────────────────┐
    │ LLM API (OpenAI 兼容)  ·  RSS/Atom 源  ·  RSSHub 多实例                  │
    │ 搜索渠道（设置里点选的一家；sidepanel 跑 search_web）  ·  YouTube watch 页 / Bilibili API（字幕）│
    │ Google translate / Tencent TMT（云翻译三层链路，可选）                    │
    │ External Bridge Endpoint (HTTP POST RSS 快照到本地分析服务)             │
   └────────────────────────────────────────────────────────────────────────┘
```

### 1.1 Agent 与工作区主数据流（v2）

`User → Main → task(explore) → passages → Main → write_document（按体裁成文，对照原文改一稿）→ 产出`。有状态对话 Agent 只有 Main 与 Sub；`explore/general/browser/custom` 是 Sub 工种。explore 交回原文段落；只有带 claims 的交回才走 Check。Sub 可以通过 `section_job` 并行调用无状态章节 Worker，Worker 每次使用全新短上下文，只读一个已入库且可引用的 `doc_id#anchor`，不创建 session，也不能委派、浏览或写入。单次 2 万字，`content_has_more` 时用 `offset` 续拉。

Sub 的自然语言输出只用于过程展示，不能令任务完成。唯一交回通道是 `submit_report` 的 `TaskReport {summary, findings[], claims[], actions[], unresolved[]}`（findings 是 Sub 对任务书问题的判断，引用 claim id）。调研报告由 Main 调 `compose_report` 在独立写作阶段生成（见不变式 51）。每个事实 claim 必须携带逐字 quote 和 `doc_id#anchor`。运行时随后强制执行 Check：项目/来源资格、锚点回读、SHA-256、一致性 quote 匹配、窄模型 entailment、独立信源计数。`checkRunId/checkerVersion/checkedAt/artifactHashes/usage` 由运行时生成并写入 session/card，Sub 无法自称“已核验”。内容失败最多对同一 `task_id` 修正一次；读取/API 基础设施失败不消耗该次数。

用户工作区固定为三主干：**来源 / 笔记 / 产出**。来源是 `entryType=source` Entry 与合格 artifact 的合并视图；笔记保存 claim 与可回放锚点；产出仅含 `entryType=output`，不能作为 Check 原文。RSS 仍是独立候选池，执行“加入来源”后才进入证据链。

---

## 2. 源码 -> 产物 映射

| 源码 (`src/`) | 产物 (`dist/`) | 体积（实测） |
|---|---|---|
| `background/service-worker.js` + **`doc-edit-service.js` + `doc-edit-word.js`**（docx 编辑引擎，v30 起 SW 无头运行，含 @xmldom/xmldom） | `background/service-worker.js` | ~785 KB+（含 readability/**defuddle**/docx/jszip/fast-xml-parser 全部依赖；youtubei.js 已移除） |
| `content/global.js` + `extract-common.js` | `content/global.js` | ~98 KB |
| `sidepanel/panel.js` + `panel-export.js` + `feed-view.js` + `chat-prompt.js` + `history-compact.js` + `rss-tools.js` + 所有 lib | `sidepanel/panel.js` | ~632 KB+ |
| `sidepanel/index.html` | `src/sidepanel/index.html` | ~30 KB |
| `sidepanel/style.css` | `src/sidepanel/style.css` | ~72 KB |
| `reader/reader.js` + `doc-edit-sheets.js`（Univer 编辑器，xlsx 仍驻阅读器）+ `doc-marks.js` + `float-css.js` + `orb-state.js` | `reader/reader.js` | 阅读器主 bundle（docx 引擎已迁 SW，阅读器只渲染 + 修订面板） |
| `reader/index.html` / `reader/reader.css` | `src/reader/index.html` / `src/reader/reader.css` | - |
| `lib/plot-runtime.js`（G2：默认柱/线/面积/散点/热力 + 点名图种 + canvas） | `lib/plot-runtime.js` | 按需动态加载，不进 SW / content 常驻包 |
| `manifest.json` | `manifest.json` | - |
| `icon/logo.png` | `icon/logo.png` | ~386 KB |

**动态 import 产物**（`dist/chunks/`，按需加载，不进常驻 bundle）：
- `doc-edit-sheets-*.js`（Univer 电子表格编辑器）、`doc-edit-word-*.js`（docx OOXML 手术引擎）-- 仅进入阅读器编辑模式时加载
- `mammoth.browser-*.js`（docx->HTML）、`xlsx-*.js`（SheetJS）、`pdf-*.js` / `pdf.worker.min-*.mjs`（pdfjs-dist）-- 文档导入/渲染时加载
- `orb-state-*.js`（ThinkingOrb 动画）、`index-*.js` 等
- 大量 `xx-XX-*.js` 语言包 chunk（pdfjs CMap / Univer locale）
- `dist/assets/`：`pdf.worker.min-*.mjs`（pdfjs worker，`?url` 导入）、`cursor-editorTextHighlight-*.svg`、`doc-edit-sheets-*.css`（Univer 主题样式）

`src/lib/*` 和 `src/sidepanel/panel-export.js`、`src/sidepanel/feed-view.js` 等侧栏子模块若被静态导入则内联进 panel bundle。**例外**：`plot-runtime.js` 单独打成 `dist/lib/plot-runtime.js`，侧栏/浮动窗/阅读器经 `chrome.runtime.getURL` 动态 import。`extract-common.js` / `html-utils.js` / `doc-marks.js` / `float-css.js` / `orb-state.js` / **`agent-memory.js`** 是多端共用的纯工具模块，分别被内联进对应 bundle。

构建命令：
```bash
npm run build     # node build.js  （会清空 dist 后重建）
npm run dev       # build + 提示加载 dist/
```

---

## 3. manifest.json 关键字段（MV3）

```json
{
  "manifest_version": 3,
  "name": "SuperCat",
  "version": "0.3.0",
  "description": "浏览器侧栏 AI：采集网页、联网调研、写出文档",
  "update_url": "http://47.104.128.124/citecat/update.xml",
  "permissions": ["storage", "sidePanel", "tabs", "scripting", "webNavigation", "alarms", "debugger", "unlimitedStorage"],
  "host_permissions": ["<all_urls>"],
  "background": { "service_worker": "background/service-worker.js", "type": "module" },
  "side_panel":  { "default_path": "src/sidepanel/index.html" },
  "content_scripts": [{ "matches": ["<all_urls>"], "js": ["content/global.js"], "run_at": "document_end" }],
  "action": { "default_title": "SuperCat" },
  "icons": { "16": "icon/logo.png", "48": "icon/logo.png", "128": "icon/logo.png" },
  "web_accessible_resources": [{ "resources": ["lib/plot-runtime.js"], "matches": ["<all_urls>"] }]
}
```

- **`type: "module"`** - SW 必须保留为 ESM 模块。
- **`<all_urls>`** content script：在任意页面跑 Readability + 监听 URL_CHANGED + 支持页面交互（`browser_act` 紧循环 / `interact_page` 逃生口）+ 检视模式 + 标注 + 浮动聊天。**不注入扩展页面**（阅读器是扩展页，故 reader 自行监听 `EXTRACT_CONTENT`）。
- **`alarms`** 用于 RSS 定时刷新（默认 30 分钟，alarm 名 `citecat-feed-refresh`，常量 `DEFAULT_REFRESH_MIN`）与全文索引手动重建的兜底续跑（alarm 名 `citecat-index-build`，仅设置页「重建全文索引」触发后才存在）。
- **`scripting`** 用于 SW 主动注入到目标 tab 抓取（`extractor.js#fetchViaTab`）及页面交互（`browser_act` 的 `loop_observe`/`loop_act`，以及 `interact_page` 的 `number_elements` / `click_number` 等）。
- **`debugger`** 用于 `interact_page` 的 CDP 可信事件：`cdp_click` / `cdp_type` / `ax_snapshot` / `ax_click`。统一走 `src/lib/cdp.js`：attach 前 `tabs.update({active:true})` + 聚焦窗口（不改尺寸；仅最小化才还原，禁止 `state:'normal'` 把最大化窗口压成小窗），`discarded/frozen` 先唤醒；`debugger.attach` / `Page.captureScreenshot` / `Accessibility.getFullAXTree` 硬超时 `CDP_TIMEOUT_MS=20000`，超时抛错并 detach，让 `acquireBrowserLock` 释放。会短暂显示调试横幅。
- **`unlimitedStorage`** 解除 `chrome.storage.local` 默认 10MB 配额（文库条目带 `fullText`、文档原件存 IDB，体积增长快）。
- **`webNavigation`** 用于 SPA 路由（pushState / hash）变化通知 content script：监听 `onHistoryStateUpdated` + `onReferenceFragmentUpdated`，向对应 tab 发 `URL_CHANGED`；**`onCommitted` 另用于 PDF 阅读器接管**（检测 `.pdf` URL，开 SuperCat 阅读器 tab 替代内置 viewer）。
- **`host_permissions: <all_urls>`** 覆盖所有出站请求：SW 抓取原网页、sidepanel 里 `search_web`（`fetch('https://html.duckduckgo.com/html/?q=...')` 在 panel.js 跑，不在 SW）、视频字幕 API、RSS 源等。已移除单独的 `https://duckduckgo.com/*`（`<all_urls>` 已覆盖）。
- **`update_url`** 指向自托管更新服务器，用于扩展自更新。
- **`web_accessible_resources`** 仅暴露 `lib/plot-runtime.js`，给页面浮动聊天窗的 content script 动态 import G2 运行时。侧栏/阅读器是扩展页，不依赖 WAR，但也走同一 URL。
- **`icons`** 16/48/128 均使用同一张 `icon/logo.png`。

---

## 4. 模块职责速查表（`src/lib/` + `src/background/`）

> 所有 lib 都是纯 ESM。多数**无 DOM 依赖**，可在 SW 和 sidepanel 共用（仅 `extractor.js#fetchViaTab` 依赖 `chrome.scripting`，只能在 SW 跑）。`extract-common.js` / `html-utils.js` / `doc-marks.js` 写了 DOM API 但**只在传入的 doc/root 上操作**（`cloneNode` 后改），不直接碰全局 `document`/`window`，所以 SW（无 DOM）导入时只要调用方先建好 doc 就不崩。`src/lib/limits.js` 是纯常量表，无任何依赖。

### 4.1 持久化层

| 模块 | 存储位置 | 关键导出 |
|---|---|---|
| **storage.js** | `chrome.storage.sync` + `chrome.storage.local` | `getEntries / saveEntry / saveEntries / saveEntryList / updateEntry / deleteEntry / clearEntries / reorderEntries / getEntryByUrl`、`getApiConfig / setApiConfig`（旧 searchProvider 只在首次迁移搜索渠道时读取；现行选择在 search-channels.js）、**`getAiChannels / saveAiChannels / getActiveChannelId / setActiveChannelId / ensureDefaultChannel`**（ccswitch 式渠道管理，数据在 local 不入 sync；ensureDefaultChannel 幂等地把旧配置合成首个「默认」渠道）。**`getProjectConfig` 解析顺序：有渠道时以激活渠道为准返回 {model,baseUrl,protocol,apiKey,contextTokens,channelId,channelName}（projConfig 的旧 model/baseUrl 字段不再参与）；无渠道回落旧合成逻辑**、`getBlacklist / setBlacklist`、`getProjectConfig / setProjectConfig`；**`getCustomSubagents / saveCustomSubagents`**（`chrome.storage.local.customSubagents`）；常量 `STORAGE_KEYS / DEFAULT_BLACKLIST / DEFAULT_API_CONFIG`（`DEFAULT_API_CONFIG` 含 `contextTokens=1000000` 模型上下文窗口（1M），推导上下文防护阈值用；`getProjectConfig` 带钳制回落，**并透传 `protocol` 字段**（'openai'|'anthropic'|'gemini'，缺省回落 openai）供多协议适配层 providers/ 使用；设置页「接入预设 + 接口协议」下拉写入）。**所有写操作带按 storage key 串行写队列**（`_enqueue`）：读-改-写整体排队，防止批量采集并发（`handleFeedItemsCollect` 并发 3~6）读改写互相覆盖静默丢条目 |
| **feed-db.js** | IndexedDB `citecat-feeds`（**v3**, stores: `feeds` / `items` / `itemTokens` / `seqPub`；索引：feeds 的 `url`(unique)/`scope`/`sortOrder` 均为 v1；items 的 `feedId`/`feedId_publishedAt`(复合)/`read`(已废弃，字段保留)/`starred` 为 v1，`publishedAt` 单字段为 **v2 新增**；v3 为 2-gram 倒排 `itemTokens` + `seqPub`，升级只建结构，索引由 SW 异步 `buildTokenIndex` 回填）。`listItems({ metaOnly })` 聚合扫描时只回 `{id,feedId,publishedAt,title,starred,collectedEntryId,hasFullText,summary}`，不带 `fullText` | `listFeeds / listFeedsForProject / getFeed / getFeedByUrl / addFeed / updateFeed / deleteFeed`、`deleteAllItemsForFeeds / reorderFeeds`、`upsertItems / listItems / getItem / getItemsByIds`、`makeItemId`、`toggleStar / setCollectedEntryId / updateItemFullText`、`countFeedItems`（走 feedId 索引 `count()`，O(log n)，不再全表扫）、`listItemsNeedingTranslation / countItemsNeedingTranslation / applyItemTranslation / resetTranslateFailures` |
| **artifact-store.js** | IndexedDB `citecat-artifacts`（**v2**：docs 新增 `sourceEntryId` / `trustClass` 索引，chunks 保持原主键） | 来源证据快照。除既有 `docId/kind/url/fullText/chunks/pageOffsets/projectId` 外，写入 `provenanceType/sourceEntryId/contentHash/capturedAt/trustClass`；`readSection` 返回 provenance 摘要。`kind=text` 旧记录可读但为 `derived`，不能用于 Check。删除支持 docId/URL/sourceEntryId 级联；`migrateArtifactProvenance` 原地补字段，不改变 docId 与锚点 |
| **notebook.js** | `chrome.storage.local` 的 `notebook_{projectId}`（最多 200 条） | **调研笔记本 / 事实库**：`(claim, confidence, sources[], status)` 跨轮存活，与证据库分离。`addNote`（**sources 必填**，空数组直接回错误——引用强制的落点）、`listNotes`、`updateNote`、`removeNote`、`normalizeSource`（doc_id#锚点 / URL / 描述 都收）、`formatNotebookDigest`（注入主助手动态前言，超长截断并指向 `notebook(list)`）。写操作带本地串行队列 |
| **doc-store.js** | IndexedDB `citecat-docs`（**v1**, store: `files`，**无 keyPath**，显式 key = docId，value = ArrayBuffer 原始二进制） | `saveDocFile(docId, arrayBuffer)`、`getDocFile(docId)`、`deleteDocFile(docId)`、`listDocIds()`。文库条目只存元数据+提取全文；原件按 docId 存此库供预览/编辑回写/下载。**删除条目不删原件**（支持 undo 恢复，孤儿文件自然闲置）。**原件 IDB key = 条目 id**（`entry.docId || entry.id`） |
| **project-purge.js / entry-cascade.js** | 无自有存储（编排 local/sync 与三个 IDB） | 项目级与单 Entry 级级联/撤销。统一处理 Entry、匹配 artifact、文档原件、库内标注、引用笔记状态，以及 `heartbeatTasks` 里该项目的心跳任务（`purgeHeartbeatTasks` / `restoreHeartbeatTasks`）；保留 AI 记忆与 RSS。已删除的旧资产数据不进入快照 |
| **source-model.js** | 纯逻辑 | `Entry.entryType=source|output` 与 Entry/Artifact provenance、`trustClass=source|derived|unverified` 的唯一推断和归一化边界；只有合格 source artifact 可引用 |
| **workspace-migration.js** | `chrome.storage.local.workspaceSchemaVersion` | v2 幂等迁移；侧栏与 SW 启动时执行。先回填 Entry/Artifact/笔记状态，成功后删除旧 `assets_*` 与四主干折叠键；失败不删除来源、笔记或产出 |
| **annotations.js** | `chrome.storage.local`（`annotations_<normalizedUrl>` 数组 + `annotations_index` URL 列表） | `normalizeUrl(url)`、`getAnnotationsForUrl(url)`、`saveAnnotation(url, ann)`、`setAnnotationEntryId(url, annotationId, entryId)`、`deleteAnnotation(url, id)`、`getAllAnnotations()`。写操作带 `_enqueue` 串行化队列（与 storage.js 同款防覆盖）。`normalizeUrl` 去掉 hash（锚点变化不算新页面） |
| **limits.js** | 无存储；AI 上下文与截断口径总表（单一事实来源）：`EXEC_OUTPUT_CAP_CHARS=30000`(超长工具输出溢出入库阈值——exec_js/exec_js_main/`call_api` 响应/网络抓包单条，全文进工作区、模型拿预览 + doc_id，**进历史的工具结果要么全文要么带 doc_id，禁止无出口截断**；旧的进历史全局砍 `TOOL_RESULT_CAP_CHARS` 与 `FEED_ITEM_MAX_CHARS` 已删，工具结果原样入历史)/`NET_BODY_LIMIT=80000`(抓包**采集**护栏，SW 内存保护；截过头时带 `bodyTruncated`/`bodyChars` 标记，出口如实告知——完整响应以工作区溢出副本为准)/`HISTORY_KEEP_TAIL_TOKENS=32000`/`READ_SINGLE_MAX_CHARS=200000`(read 单次分页尺寸非截断)/`AGENT_MAX_ROUNDS=100`+`AGENT_WRAP_HINT_ROUND=95`(父代理工具循环轮数)/`SUBAGENT_MAX_PARALLEL=3`+`SUBAGENT_MAX_DEPTH=1`+`SUBAGENT_MAX_TABS=6`(单子代理同时打开的标签页上限，滚动窗口；`manage_tabs(open)` 超限拒绝并提示先关)(子代理；**轮数与交回报告都不设上限**——2026-09-10 用户拍板：删掉旧的 `SUBAGENT_MAX_ROUNDS=24` 硬顶与第 20 轮收尾提示，实测打满 24 轮时循环按预算退出、把模型唯一说过的开场白当报告交回（父代理收到 completed + 一句话）；现在子代理做到自己交出最终报告为止，终止靠模型某轮不再调工具或父代理 abort；2026-10-07 起另有**软预算**：`SUBAGENT_BUDGET_TOKENS=2_000_000`/`SUBAGENT_BUDGET_MINUTES=20`（设置可调，0=不限），用到 `SUBAGENT_BUDGET_WARN_RATIO=0.85` 注入一次收尾提醒，用满后工具集只剩 `submit_report`、最多 `SUBAGENT_FORCED_SUBMIT_ROUNDS=2` 轮——强制交出已查到的内容而不是丢弃；报告去掉旧的 16000 字符上限，长度改由结构化交回约束)。**章节作业**：`SECTION_WORKER_MAX_PARALLEL=4`/`MAX_CHARS=20000`/`MAX_ROUNDS=3`/`TIMEOUT_MS=45000`。**Check 窄模型**：`CHECK_BATCH_SIZE=8`/`CHECK_MAX_CLAIMS=80`/`CHECK_TIMEOUT_MS=30000`。**CDP 硬超时**：`CDP_TIMEOUT_MS=20000`（`debugger.attach` / `Page.captureScreenshot` / `Accessibility.getFullAXTree` / `captureVisibleTab`）。**通用 call_api**：`CALL_API_TIMEOUT_MS=30000`/`CALL_API_MAX_BODY=256KB`（**响应不在源头截断**，`CALL_API_MAX_RESPONSE_CHARS` 已删，全量交执行器溢出入库）。**RSS 聚合扫描**：`RSS_SCAN_PAGE=1000`（count/group_by_feed/by_day 单页）+ `RSS_SCAN_MAX=50000`（单次工具调用硬顶；顶满 `truncated=true` 并给 `next_cursor`，不得把上限说成库总量）。曾在 panel/SW 多处硬编码靠人肉同步，出过不一致事故后收口 | 全部常量 |
| **md-to-docx.js** | sidepanel 上下文 | `markdownToDocxBlob(md, options?)`、`entriesToMarkdownDocxBlob(entries)` |
| **agent-memory.js** | 纯函数；数据在 `chrome.storage.local.agentMemories` | 经验记忆匹配与排序。`save_memory` 写入、`retrieveMemories()`（**chat-executor.js**）检索。**最多 80 条**，超限按 `calcRelevance()` 淘汰。检索优先级：当前页 URL 命中 `urlPrefixes` 且 tag/domain 命中 → 仅 URL 命中 → 仅用户文本命中。旧记忆无前缀时 domain/tags 能对上 hostname 也算站点命中。同 `domain` 更新去重，`urlPrefixes` 合并。导出 `calcRelevance` / `rankMemories` / `inferHostPrefix` / `mergeUrlPrefixes` / `formatMemoriesBlock`（主助手动态前言与子代理 SYSTEM-CONTEXT 共用注入文本） |
| **heartbeat.js** | `chrome.storage.local.heartbeatTasks` + `chrome.alarms` `citecat-heartbeat-tick` | 心跳定时任务：create/list/update/pause、到期优先交给打开的侧栏跑一轮对话，关闭则 queued。**按项目隔离**：每项目最多 20 条；`listHeartbeatTasks(pid)` / 改删 / 抽屉与角标都只看当前项目；缺 `projectId` 的旧任务归 `default`。`upsert` 更新不得改归属。删项目走 `purgeHeartbeatTasks`，撤销 `restoreHeartbeatTasks`。切项目时侧栏 `syncHeartbeatUi` 重绘列表与角标。**调度模型（2026-09-10 重做）**：`task.schedule = {type, ...}`，类型显式化 + cron 兜底——`once{at}`（跑一次自动停用）/ `interval{everyMin}` / `daily{time}` / `weekly{time, weekdays}` / `cron{cron}`，全部按本地时区。`parseScheduleFields` 是唯一入口（工具参数与 UI 表单共用），非法即抛可执行错误。`computeNextRunAt` 的 interval **从上次计划时刻推整倍数**（不再从执行完成时刻起算，避免每跑一次往后漂）。旧字段 `everyMin`/`dailyAt` 由 `normalizeSchedule` 兼容读取，新写入只落 `schedule`。**`until`（截止日期，含当天）可叠加在任意周期上**——「会议 1 月开、每天查一次」= `daily` + `until=2026-01-31`；到期未达成则停用并保留（用户要看得见它没成）。**自我终止**：`heartbeatUserText` 带上 `task.id`，AI 在触发的那轮里可调 `manage_heartbeat(action='complete')` 结束自己（宿主用 `ctx.getActiveHeartbeatTaskId()` 解析，AI 不必记 id）。最短间隔 5 分钟。`manage_heartbeat` 工具与闹钟按钮抽屉共用；验证 `test/heartbeat-smoke.mjs` / `test/timeline-smoke.mjs` |

#### 数据结构

**Entry**（`chrome.storage.local` 的 `entries_{projectId}` 数组元素）
```js
{
  id, url, originalTitle, fullText, publishedAt, candidatePublishedAt,
  entryType: 'source' | 'output',
  provenance: {
    type: 'web' | 'rss' | 'upload' | 'snippet' | 'generated' | 'unknown',
    publisher, tier, canonicalUrl, capturedAt, feedItemId,
    trustClass: 'source' | 'derived' | 'unverified'
  },
  status: 'collecting' | 'summarizing' | 'completed' | 'blocked' | 'error',
  aiTitle, aiSummary, source, sourceTier, sourceTierReason,
  tags: string[],
  similarity: { level, finalScore, matchedEntryId, matchedTitle, ... } | null,
  usage, cost,
  createdAt, errorMessage,
}
```
> 注：正文存 `fullText`（无 `content` 字段）。`source` 从 v2 起只表示出版方；旧 `source === 'AI 生成'` 只在迁移时推断 `entryType=output`，运行时分流不得再依赖该字符串。
`blocked` 常用于 Cloudflare / captcha / 登录墙：卡片会显示「打开验证页」和「已验证，继续采集」，用户在真实页面通过验证后再手动重试。

**Feed**（IDB `feeds`）
```js
{
  id, url, title,
  scope: 'global' | <projectId 字符串>,   // 字符串，不是对象 {projectId}
  etag, lastModified, lastFetchedAt, lastError,
  maxItems, fetchFrom, fetchTo, autoTranslate,
  totalCount, sortOrder,                    // totalCount 由 countFeedItems 维护（无已读/未读计数）
  siteUrl, faviconUrl, description,        // 订阅源站点信息
  intervalMin, lastSuccessAt, createdAt,   // 刷新间隔 / 上次成功 / 创建时间
}
```
> 过滤用 `f.scope === 'global' || f.scope === projectId`（projectId 为字符串）。无 `lastErrorAt` 字段。

**Item**（IDB `items`，主键 `id = sha1(feedId + (guid||link))`，保证天然去重）
```js
{
  id, feedId, guid, link, title, summary, contentHtml,
  author, publishedAt, fetchedAt, createdAt,
  starred, collectedEntryId,                 // read 字段已废弃（保留但不读写）；
                                             // 「是否处理过」用 collectedEntryId 判断
  hasFullText, fullText,
  // 翻译相关（feed-backfill 写入；fullText 仅按需翻译，不在 backfill 内做）
  //   原文备份：translator 第一次成功时把 title/summary 备份到 originalTitle/originalSummary
  //   译文落位：title/summary 字段被就地替换为目标语言
  //   状态字段：translated(bool) / translatedTo(BCP-47) / sourceLanguage
  //              translatedAt / translateAttempts / translateError
  originalTitle, originalSummary, originalFullText,
  translated, translatedTo, sourceLanguage,
  translatedAt, translateAttempts, translateError,
}
```

**Annotation**（`chrome.storage.local` 的 `annotations_<url>` 数组元素，由 doc-marks.js 构造、annotations.js 落库）
```js
{
  id, kind: 'hl' | 'ul' | 'el-hl' | 'el-ul',   // 荧光笔/下划线/元素荧光/元素下划线
  text, prefix, suffix,                          // TextQuoteSelector 上下文（各 40 字符）
  posStart, posEnd,                              // TextPositionSelector 绝对偏移
  pageTitle, createdAt, entryId, note,           // entryId = 关联的文库 snippet 条目
  selector?,                                     // 元素标注的 cssPath（文本标注无此字段）
}
```

### 4.2 采集 / 提取

| 模块 | 作用 | 关键导出 |
|---|---|---|
| **extract-common.js** | SW + content script 共用的纯提取工具（DOM 操作但两端都能跑）。日期识别（`extractPublishedDateFromDoc`，meta/JSON-LD/属性/短文本多策略，含事件日期过滤、文章正文内日期跳过）、`extractByScoredBlocks`（候选块打分：长度+段落+标点+正向 hint - 链接密度 - 负向文本 - 超长惩罚）、`normalizePublishedDate`（多语言多格式归一化）。常量 `MAX_TEXT_LENGTH=500000`（AI 阅读不截断，仅防御极端页失控）/ `TEXT_BLOCK_SELECTOR` | `extractPublishedDateFromDoc`, `extractByScoredBlocks`, `normalizePublishedDate`, `openAllDetails`, `getTitleFromDoc`, `MAX_TEXT_LENGTH`, `TEXT_BLOCK_SELECTOR` |
| **html-utils.js** | 三端共用 HTML->纯文本工具，取代 4 处重复实现（translator/extractor/feed-parser/service-worker）。`preserveNewlines` 选项控制块标签是否转 `\n` | `htmlToText` |
| **extractor.js** | URL -> 正文 + 候选发布日期（SW 端，从 fetch 到的 HTML）。提取链：①**Defuddle 优先**（`new Defuddle(doc,{markdown:true}).parse()`，质量最高、输出 Markdown、带 schema.org 元数据）-> ②Readability + scored blocks（scored 更短且不丢内容时取 scored）-> ③`extractByScoredBlocks` -> ④legacy CSS 选择器。`fetchViaTab` 用 `chrome.scripting` 注入隐藏 tab 抓取需要 JS 渲染的页面，**轮询 `EXTRACT_CONTENT`** 直到正文长度稳定（500ms 间隔、连续 2 轮不变或 8s 上限，取最长结果，处理 SPA 懒加载）；遇到 Cloudflare / captcha / 登录墙时 `detectBlocked` / `detectVerificationPage` 返回 `needsVerification` | `extractContent`, `detectBlocked`, `detectVerificationPage`, `fetchViaTab` |
| **content/global.js** | content script 版提取器，在网页上下文跑 Readability + scored blocks（**不跑 Defuddle**，因 Defuddle 需 fetch 来的 doc 而非 live DOM），结果 `sendMessage` 给 SW；响应 SW 推来的 `URL_CHANGED`、`EXTRACT_SNAPSHOT`（manage_tabs list 廉价快照）和 `EXTRACT_CONTENT`；支持 `interact_page` 工具的页面编号/点击/滚动/输入/截图/CDP 等操作。**结构化 Markdown 提取**：`EXTRACT_CONTENT` 支持 `format` 参数（`text`/`markdown`/`auto`），`markdown` 走 `extractStructuredMarkdown()`（表格->Markdown 表、卡片间空行、h1-h3 标题保留层级、过滤 SVG 坐标轴刻度/图例/导航噪音、`addCjkSpacing` 中英文自动加空格、`detectChartInfo` 检测 ECharts/Chart.js 并标注"数据未提取"）。**另有完整页面交互层**：圆形 checkbox（页面级 + 搜索引擎结果级）、检视模式、文本/元素标注与高亮、snippet 收藏、浮动 AI 聊天窗（见 §7） | （非模块，无导出） |
| **doc-import.js** | 把上传的 PDF / Word（**docx + 旧版 doc**）/ Excel / CSV / **Markdown / 纯文本** 解析成全文文本，供文库条目的搜索与 AI 上下文。pdfjs-dist / mammoth / xlsx **全部动态 `import()`**（只在用户上传时加载对应 chunk）。csv/md/txt 先按字节解码（UTF-8 严格模式失败回退 GBK）；xlsx 走 SheetJS `sheet_to_csv`；docx 走 mammoth `extractRawText`；**doc 走 `legacy-doc.js`（OLE2 + 字块表，失败则 UTF-16 启发式 / RTF）**；pdf 逐页 `getTextContent`。扩展名撒谎时用魔数纠偏（`.doc` 实为 zip → 当 docx）。导出 `extractDocText(file)` 与 `extractDocTextFromBuffer(name, ab)`、`decodeTextBuffer` | `{format, fullText, pageCount?, pageOffsets?}`（PDF 记 `[{page,start,end}]`，给 `read_section(page=N)` 当锚点） |
| **doc-kind.js** | 扩展名 / URL / 魔数判定。kind=`pdf\|docx\|doc\|xlsx\|csv\|md\|txt`（`.xls` 归 xlsx）。**上传白名单** `isUploadDocName`：仅 `pdf/docx/xlsx/csv/md`。`isDocumentFileUrl` / `readerUrlForRemote` 给 SW 把文档直链改写到阅读器 | `kindOfName` `resolveKind` `isUploadDocName` `readerUrlForRemote` |
| **legacy-doc.js** | Word 97-2003 `.doc` 纯文本提取（无第三方依赖、无 DOM）。OLE2/CFB + MS-DOC 字块表优先，失败 UTF-16LE 扫描；也剥 RTF | `extractLegacyDocText(ab)` |
| **create-xlsx.js** | AI 生成 xlsx：`structured_data` / CSV / markdown 表 → JSZip 最小 OOXML。不把 SheetJS 打进 SW。数字/公式/inlineStr。另导出 `colFromName` / `parseA1` / `parseA1Range` 给无头编辑器 | `aoaToXlsxBuffer` `rowsFromCreateDocumentArgs` |
| **create-docx.js** | AI 生成 docx：markdown → JSZip 最小 Word OOXML（标题/列表/表格/加粗/**图表/来源图插图**）。SW 安全，不把 `docx`/`marked` 打进 SW。侧栏高质量导出仍走 `md-to-docx.js`。**插图**：正文里 `![说明](chart:ID)` / `![说明](img:ID)`（也收 `![chart:ID]` / `[[img:ID]]`）→ `findMediaRefs` + `planChartImages` 按首次出现顺序分配 relId/docPrId 并把尺寸等比压进可打印宽度（`PRINT_IMAGE_MAX_PX=560`，1px=9525EMU）→ 图片段落（居中 + keepNext）+「图 N：说明」题注 + 8pt 灰字来源行；缺字节的引用渲染成可见占位行。图片存在时给 zip 补 `word/media/imageN.png`、`[Content_Types].xml` 的 png Default、`document.xml.rels` 的 image 关系、根元素 drawing 命名空间（无图时输出与旧版字节一致） | `markdownToDocxBuffer` `markdownToBodyXml` `findMediaRefs` `findChartRefs` `planChartImages` `fitImagePx` `PX_TO_EMU` `PRINT_IMAGE_MAX_PX` `encodeUtf8` |
| **doc-edit-xlsx.js** | xlsx OOXML 定点手术（SW 无头，对齐 doc-edit-word）。JSZip + xmldom 改 worksheet/styles。`set_range`/`set_bold`/`append_row`/`append_col`/`clear_range`/`switch_sheet`/`undo`/`redo`。公式以文本写入不求值。测试：`node test/xlsx-headless-smoke.mjs` | `initXlsxEditor` `execXlsxTool` `exportXlsx` `xlsxText` |
| **doc-marks.js** | **共享标注逻辑**，content script（网页）与 reader（扩展页）共用 -- 荧光笔/下划线/元素标注的创建、DOM 包裹（`<mark>`）、锚点定位与重放。锚点策略（W3C 实践，多层交叉校验）：TextQuoteSelector（`text`+`prefix`+`suffix`）+ TextPositionSelector（`posStart`/`posEnd`）；重放顺序 位置优先 -> 失败退回 quote 原文精确匹配（带上下文消歧）-> 再退回归一化（空白压缩 `buildNormIndex`）匹配 | `ANNOTATION_CSS`, `injectAnnotationStyles`, `makeAnnId`, `quoteContext`, `wrapRangeWithMark`, `unwrapMarks`, `cssPath`, `createTextAnnotation`, `collectTextSnippet`, `collectAnnotationAsSnippet`, `buildTextIndex`, `buildNormIndex`, `findAnnotationRange`, `replayAnnotations` |
| **video-extractor.js** | YouTube / Bilibili / b23.tv URL 探测 + 字幕抓取（**已移除 youtubei.js 依赖**）。YouTube：fetch watch 页 HTML -> 正则取 `ytInitialPlayerResponse` -> 取 captionTracks -> fetch 字幕 JSON（偏好 zh/en）。Bilibili：`wbi/view/detail` 拿 aid+cid -> `player/wbi/v2` 拿字幕 URL -> fetch 字幕 JSON。无字幕时返回元数据+简介 | `detectVideoUrl`, `extractVideoTranscript` |
| **vision-client.js** | Vision-LLM 客户端（**纯模块，无 DOM**，SW + sidepanel 共用），全部流量走 `providers/index.js#chatComplete`（任意协议可用，Gemini 原生视觉无需 OpenAI 垫片）。**`resolveVisionModel` 只返回当前渠道主模型**，不再读设置页外挂 `visionConfig`，也不再按静态注册表或探测缓存把请求改道。主模型拒图时直接报错，提示换一个支持视觉的渠道。`visionChat` 发 text+image_url 内容块；400 且报文提到 max_tokens 时减半重试。`getVisionConfig` 是 `resolveVisionModel` 的兼容别名。侧栏启动时清掉遗留的 `visionConfig` / `visionProbeCache` | `resolveVisionModel`, `getVisionConfig`, `visionChat`, `isImageUnsupportedError`, `OCR_PROMPT` |
| **model-limits.js** | 模型窗口/输出上限/思考档位。按模型 ID 查 models.dev 目录（12h 缓存 + 打包快照）；Gemini/OpenRouter 可再问厂商覆盖。未收录：`contextWindow=2M` 仅作常用档滑块上限（默认工作上下文 128k），`reasoning='effort'` 且 `defaultEffort='off'`（Off 不发思考字段）。Effort 滑条对未收录解开 | `inferModelCaps`, `defaultWorkingContext(max, source)`, `contextPresets`, `catalogSourceLabel`, `probeModelMeta`, `refreshModelCatalog`, `EFFORT_LEVELS` |
| **effort-probe.js** | 思考参数探测缓存（`chrome.storage.local.effortProbeCache`）。400/422 且报错像 thinking/reasoning 时：取值非法降一档，字段不认识则剥字段；最多 2 次。成功写入 `{omit}` 或 `{maxEffort}`。用户再拨 Effort 会 `clearEffortProbe`。401/429/超窗不碰 | `planEffortRetry`, `peekEffortProbe`, `rememberEffortOutcome`, `clearEffortProbe` |
| **cdp.js** | 无存储；CDP 附着/前台唤醒/超时封装。`ensureTabForeground`（`tabs.update({active:true})` + 聚焦窗口且不改尺寸，最小化才还原；`discarded/frozen` 先等到 renderer 醒）/`withSerialForeground`（前台滚动排队，同一时刻只激活一个标签）/`debuggerAttach`（20s 超时 + `Page.bringToFront`）/`debuggerSend`/`debuggerDetach`/`withDebugger`/`withDeadline`。窗口不可见时 attach/截图/AX 树可能永不返回，禁止裸 `chrome.debugger.attach` | `ensureTabForeground`, `withSerialForeground`, `debuggerAttach`, `debuggerSend`, `debuggerDetach`, `withDebugger`, `withDeadline`, `CDP_VERSION` |
| **tab-session.js** | SW 持有（panel 经 `TAB_SESSION_OPERATE` 调用）。**持久 CDP 会话池**（业界 Playwright Page / Browserbase Session 模式）：`TabSession` = lazy attach（走 `cdp.js`，前台唤醒 + 20s 超时）+ 统一命令层 `send`（detach 错误 retry-once 重连，命令同样 20s 超时）+ 高级动作 `evalJS`/`evalJSMain`/`scroll`/`clickAt`/`clickElement`/`axClick`/`typeText`/`screenshot`/`getAXTree`/`captureNetwork`（临时事件订阅）/`navigate` + 事件总线 `on`；`SessionPool` = 上限 6、空闲淘汰、`release`/`closeAll`/`status`；`initDebuggerDispatch` 全局 onEvent/onDetach 按 tabId 分发。CDP/截图/可信点击会激活标签并聚焦窗口；attach 时尝试 `Emulation.setPageThrottlingEnabled` 关闭冻结节流（失败静默降级） | `TabSession`, `SessionPool`, `sessionPool`, `initDebuggerDispatch`, `SESSION_LIMIT` |
| **page-data.js** | SW + sidepanel 共用。统一页面数据构建（read_current_page / read_tab / read_many 同一链路）：EXTRACT_CONTENT + detectPageType + 主世界图表提取（ECharts/Chart.js/框架全局）-> `{pageType, url, title, mode, data, untrusted}` 或 `{error}`；**大文档自动分页**（`READ_PAGE_CHUNK_CHARS=200000`，单次读取上限 20 万字符、可分多次 offset 续拉读完）：正文超过此值或显式传 `offset`/`max_chars` 时返回切片 + `data.content_has_more`/`content_next_offset`/`content_total`/`content_offset`/`content_returned`，AI 用 `offset` 续拉下一段；小页面默认全文。**`untrusted:true` 硬标记**页面内容不可信。`buildTabSnapshot` 走 **EXTRACT_SNAPSHOT**（廉价 title/pageType/160 字摘要，禁止 Readability/全文），单页超时 `TAB_SNAPSHOT_TAB_MS=1500`、总预算 `TAB_SNAPSHOT_BUDGET_MS=8000`，休眠/冻结 tab 只回元数据；`buildPageData` 的 EXTRACT_CONTENT 带 `TAB_READ_MS=20000` 超时。`withTimeout` / `isReadableTab` / `tabListMeta` 给 SW 与 chat-executor 共用 | `buildPageData`, `buildTabSnapshot`, `withTimeout`, `isReadableTab`, `tabListMeta`, `READ_PAGE_CHUNK_CHARS`, `TAB_SNAPSHOT_TAB_MS`, `TAB_SNAPSHOT_BUDGET_MS`, `TAB_READ_MS` |

### 4.3 AI 与工具

| 模块 | 作用 | 关键导出 |
|---|---|---|
| **providers/（多协议适配层）** | **全部 AI 对话流量的唯一出口**（2026-08-26 收口，禁止调用点自己 fetch）。统一入口 `chatStream(cfg, messages, tools, onChunk, signal)` / `chatComplete(cfg, messages, opts)` 按 `cfg.protocol` 分发三个适配器：`openai-chat.js`（ChatCompletions 兼容系：OpenAI/DeepSeek/GLM/Qwen/Kimi/豆包/OpenRouter/SiliconFlow/Grok/本地 Ollama 等 ~80% 市场端点；含 o 系/gpt-5 的 max_completion_tokens + 省略 temperature quirk、response_format 400 重试）、`anthropic-messages.js`（Claude 官方及 DeepSeek/GLM 等家的 Anthropic 兼容层；system 提取为顶层参数、tool_calls→tool_use blocks、连续 tool 结果合并进一条 user 的 tool_result、SSE content_block_delta 事件解析）、`gemini.js`（generateContent 原生；systemInstruction、functionDeclarations/functionCall/functionResponse——函数名按前文 tool_calls id 回填、schema 清洗 $schema/additionalProperties、alt=sse 流）。思考字段由 `reasoning.js` 按目录 + Base URL 写入；未收录 Off 不发。入口 `withEffortRetry` 对思考参数 400 最多降一档或剥字段。**规范消息格式**：content 可为 string 或内容块数组（text / image_url，图片仅 vision 路径），适配器负责与各家线缆格式双向转换；usage 统一归一化为 OpenAI 形状；错误统一抛 `ApiError(status, body)`。未知 protocol 容错回落 openai。`util.js` 共享 SSE 跨 chunk 行缓冲读取器（三协议流式都是 data: 行格式）；`presets.js` 是设置页厂商预设表。验证：`test/providers-smoke.mjs`（桩 fetch 模拟三家线缆格式） | `chatStream`, `chatComplete`, `ApiError`, `PROVIDER_PRESETS` |
| **ai-client.js** | RSS 摘要提取 + 聊天入口的兼容门面。`summarizeText` 内置中文提示词模板（要求模型输出严格 JSON：`title/source/sourceTier/sourceTierReason/summary/tags/date/tagMerges`；**模板内所有引号为英文直引号**并显式要求模型不用全角引号），请求经 `providers.chatComplete` 发出（`responseFormat:{type:'json_object'}` + 400 去字段重试在 openai 适配器内实现）；`streamChatWithTools` 是 `providers.chatStream` 的薄别名（SW/panel 调用点签名不变）。`nativeWebSearch`（DeepSeek Responses API 服务端联网搜索）是**有意保留的唯一裸 fetch**——它是专用搜索端点不是对话协议。**tool_calls 的 arguments 解析失败不静默吞成 `{}`**：带 `parseError` 字段（含原始片段前 300 字符）上抛，宿主把它作为 tool 结果回喂给模型自纠重发（此约定三协议适配器共用） | `summarizeText(fullText, apiConfig, url, candidateDate, recommendedTags)`、`streamChatWithTools(messages, tools, apiConfig, onChunk)`、`testApiConnection(apiConfig)`、`nativeWebSearch`、`PROMPT_TEMPLATE` |
| **tools.js** | OpenAI function-calling 工具定义（**41 个工具**）+ `TOOL_LABELS` 标签 + **`buildChatTools(agents)`**。默认页面操作为 **`browser_act`**（视口编号表 + 按编号 click/type/select，执行后自动返回新表）。`interact_page` 是逃生口（CDP/vision/JS/抓包）。`create_document` 支持 md/csv/json/docx/**xlsx**（xlsx 用 `create-xlsx.js`、docx 用 `create-docx.js` 立即生成原件写入 IDB）。`update_entry` 改 xlsx/docx/md/txt/csv 正文时同步重建原件。`collect_content` / `manage_tabs(open)` / `interact_page(navigate)` / `browser_act(navigate)` 对 PDF/Word/Excel/CSV/md/txt 直链改写到阅读器再抽正文。`validateToolArgs` 轻量 schema 校验。其余工具清单与参数见 `src/lib/tools.js`。**`ask_research_scope`**：调研开工前一问一窗确认卡（Claude Code AskUserQuestion 风格），父级专属。**`plot_chart`**：把已对齐的小表画成 G2 图（默认 bar/line/area/scatter/heatmap，点名 donut/histogram/boxplot/radar/funnel/waterfall/sankey + 事件标线），直接显示在对话气泡里，父级专属；**`deliver="docx"`** 时同时光栅化成 PNG 供 Word 文档引用（见 §6.12）。**`place_images`**：AI 取页图/截图交到对话、网页编辑器或文档，来源 `source=place` 用完即弃，父级专属。**`notebook`**：调研笔记本（结论 + 出处，父级专属）。**`plan`**：任务清单（父级专属；`action` = set 整表重发 / get / clear；长任务计划外置，每轮由动态前言注入，对话里渲染成单实例清单卡）。**`call_api`**：通用 HTTPS 调用（Fed/REST/交易所）；公开接口在线查文档后直打，密钥进 `chrome.storage.local.apiConnectors` 由运行时注入；POST 等写入须连接开启 `allowWrite`；响应不在源头截断，超限整包溢出入库（预览 + doc_id 回读，2026-10-07）。**`refresh_feeds`**：立刻刷新订阅源（可选 `feed_ids`/`feed_titles`） | `CHAT_TOOLS`, `buildChatTools`, `TOOL_LABELS`, `validateToolArgs` |
| **browser-loop.js** | 无 DOM：把 content script 的 loop snapshot 格式化给模型。`BROWSER_ACT_OPS` = observe/click/type/select/scroll_*/wait/navigate。前台标签的 `browser_act` 在编号表后另附一张当前视口截图（`appendViewportShots`，只进本轮请求，历史与子代理落盘去掉像素；后台标签不截、不抢焦点） | `formatPageSnapshot`, `formatLoopResult`, `BROWSER_ACT_OPS` |
| **chat-executor.js** | **工具执行内核**，被三个宿主共享：sidepanel `panel.js`（侧栏聊天）、SW（浮动/阅读器聊天 via ann-chat 端口）、reader.js。把全部 chat tools 的 `executeToolCall` 及辅助函数集中在此，保证各宿主功能平价。宿主通过第三个参数 `ctx` 注入数据/回调/`bridge.*` 跨上下文消息通道。含记忆系统（`retrieveMemories` 调 `agent-memory.js#rankMemories`，按当前页 URL 前缀优先）、条目摘要（`buildEntriesDigest`）、工具状态标签（`toolDisplayLabel`）、写工具集合 `WRITE_TOOLS`（delete/update/reorder/collect 系列/collect_feed_items/create_document/compose_report/write_document/place_images）、**上下文防护（不截断 read）**：`contextCompactBudget` 轮间压缩预算（窗口×0.7−20k，压缩更早对话、不碰本轮 read 结果）+ `isContextOverflowError` 识别 API 超限报错文本。阈值从项目配置 `contextTokens`（模型上下文窗口，默认 1000000 即 1M）推导。**read 结果不做中途折叠/截断**（保持 callMessages 全量），大文档由 read 工具源头分页（见 page-data.js）。`HISTORY_KEEP_TAIL_TOKENS=32000` 是压缩保留尾部，与 history-compact.js 的函数默认 3000/1200 是两套数字。**`task` 经 `registerTaskTool` 注入（subagent.js 加载时注册，禁止动态 import，以免 Vite 往 SW 打 `__vitePreload`）**；`processRoundToolCalls` 里非 task 仍串行，`task` 最多并行 3；子代理 `ctx.subagentAllowedTools` 在执行前再拦一层（模型幻觉出未授权工具名也不跑）。**子代理的 apiMessages 与 historyMessages 是同一数组**：落账必须走 `commitRoundToolTranscript`（同引用只 push 一次），否则 Anthropic 下一条请求会 400（tool_use 缺 tool_result） | `executeToolCall`, `retrieveMemories`, `calcRelevance`, `WRITE_TOOLS`, `buildEntriesDigest`, `toolDisplayLabel`, `getContextTokens`, `contextCompactBudget`, `isContextOverflowError`, `DEFAULT_CONTEXT_TOKENS`, `HISTORY_KEEP_TAIL_TOKENS`(转出口), **`processRoundToolCalls`**, `CHAT_TOOLS`(re-export) |
| **workspace-tools.js** | 工作区/笔记本工具处理器。`ingest` 只接受现有 Entry 或标签页；不再允许任意 `ingest(text)` 伪装来源。read_* 首读自动形成 source artifact，续拉切片不覆盖完整快照。**`spillOversizedOutput` 是超长工具输出的统一出口**（阈值 `EXEC_OUTPUT_CAP_CHARS`）：全文进工作区、模型拿预览 + doc_id，失败退回全文不静默 slice；已参数化 `kind/provenanceType/trustClass`——代码执行输出保持 derived（不可引用），**网络抓包按 `kind='page'` + `source` 标**（网站原始数据，可进证据链），消费方=exec_js/exec_js_main/`call_api`/两路 `capture_network` | `ingestTool`, `readSectionTool`, `searchWorkspaceTool`, `notebookTool`, `autoIngestRead`, `spillOversizedOutput` |
| **plan.js** | **任务清单**（长任务计划外置）。存 `chrome.storage.local` 的 `plan_{projectId}`（与 notebook 同款），形状 `{items:[{text,status}], updatedAt}`，status = todo/doing/done；上限 30 条 / 单条 120 字，写入走 `writeChain` 串行化。`planTool` 三动作（set 整表重发 / get / clear），成功后**回调 `ctx.onPlan(plan)`**（clear 时传 null）供宿主就地更新清单卡；`formatPlanDigest` 供动态前言注入（空清单不注入、全完成只留一句收尾提示）；`planCardHtml` / `upsertPlanCardEl` 是卡片的纯 HTML 渲染与原地替换（保留用户展开状态），侧栏 `chat-` 与浮动窗 `cw-` 两套皮肤共用 | `planTool`, `getPlan`, `setPlan`, `clearPlan`, `planStats`, `formatPlanDigest`, `formatPlanForTool`, `planCardHtml`, `upsertPlanCardEl`, `normalizePlanItems` |
| **doc-edits.js** | **文档修改痕迹**（对话内 diff 卡的渲染与模型自证材料）。三个 doc_edit 引擎（docx/xlsx/txt）在成功写操作时把 `{op, location, before, after, note}` 塞进返回值 `edits`，执行器 `chat-executor#case 'doc_edit'` 用 `makeEditsCard` 挂到当轮 assistant 消息（`msg.docEdits`），并把**紧凑摘要**（`formatEditsForModel`）追加进 tool 结果回喂模型（原始 edits 从 JSON 剔除，避免重复占上下文）。同一文档多次编辑按 `doc_id` 用 `mergeEditsIntoList` 累加进同一张卡；`docEditsCardHtml` / `upsertDocEditsCardEl` / `docEditsListHtml` 是卡片渲染与原地更新 | `makeEdit`, `makeEditsCard`, `mergeEditsCard`, `mergeEditsIntoList`, `formatEditsForModel`, `docEditsCardHtml`, `upsertDocEditsCardEl`, `docEditsListHtml` |
| **subagent-policy.js** | 无运行时依赖的白名单：父级专属工具、explore 可调工具、browser 可调工具、explore 允许的 `interact_page` action。chat-executor 与 subagent 都要读，不能互相 import | `PARENT_ONLY_TOOLS`（含 `save_memory`、`notebook`、`plot_chart`、`place_images`、`plan`：子代理只读注入、禁止写入/画图/改清单）、`EXPLORE_TOOLS`（含 `ingest`/`read_section`/`search_workspace`/`refresh_feeds`/`call_api`）, `BROWSER_TOOLS`（含 `browser_act` + `interact_page` 逃生口）, `isExploreInteractAllowed` |
| **task-report.js / subagent-core.js** | `submit_report` schema、TaskReport 校验、Main 短摘要、Agent 工种/白名单/会话序列化。claim 必填 `attribution`（谁说的）+ `modality`（`CLAIM_MODALITIES`：confirmed/claimed/reported/denied/assessed/speculative，非法值回落 reported），可选 `event_time`；“X 称…”不得写成 confirmed。`formatTaskResult` 输出 JSON envelope，XML 与 Markdown 软协议已删除。主代理摘要（`reportForMain`）：有 findings 时事实挂在判断的 supporting/contradicting 下，不再平铺 claims；未被引用的事实只留条数；claims ≥ 3 且没有 findings 时只留 `claim_count`。`verificationForMain` 只列未通过的 `failures`，通过项不重复交回。完整 claims 与引文留在子会话，供 Check 与 compose_report | `SUBMIT_REPORT_TOOL`, `validateTaskReport`, `reportForMain`, `formatTaskResult`, `revisionRequestFor` |
| **subagent.js** | Sub 独立有状态消息循环、`task_id` 续传/后台回注。只有成功调用 `submit_report` 才是 completed；否则 incomplete。交回后强制运行 Check；内容错误最多一次 revision，运行时仅注入失败 claim id 与错误类型。仍保留 `Object.defineProperty` 隔离父子历史与 `commitRoundToolTranscript` | `runTaskTool`, `listAgents` |
| **document-writer.js** | 按体裁成文。收集子会话 `passages`，干净上下文写一稿，再对照原文改一稿。`<<<GAPS>>>` 里还有会改变做法的要点时不保存，把 `need_reading` 交回主代理补派。`compose_report` 与 `write_document` 走同一条路径 | `collectPassages`, `splitDraft`, `writeDocument`, `genreGuide` |
| **section-worker.js** | Sub 专属无状态章节 Worker。只接受可核验来源，预读指定 chunk/page/offset，模型仅拥有 `submit_report`；不持久化 session，不可浏览、写入或再委派。单次最多 2 万字，结果带 `content_has_more` / `content_next_offset`，Sub 用 `offset` 续拉直到读完。并发/轮数/超时见 limits.js | `SECTION_JOB_TOOL`, `runSectionJob`, `sectionJobCursor` |
| **decision-model.js** | 决策板数据模型（纯函数，无 DOM/chrome）：按线程聚合 trace + 笔记 + 心跳任务为议题（结论、证据强度、判断、分歧、缺口、7 天变化）与全局关注区（待拍板、告警、到期复核），并生成“派去调研 / 去回答”的预填指令。测试 `test/decision-smoke.mjs` | `buildDecisionBoard`, `claimStrength`, `researchPrompt`, `decisionPrompt` |
| **check/** | 强制 Check 管线：schema/项目归属、锚点回读、SHA-256、quote match、entailment、跨信源、verdict 与 Main 摘要（只含 failures，不含通过项全文）。核验身份与 usage 全由运行时产生。`CHECKER_VERSION='citecat-check-v2'`：entailment 同时核模态与归因（引文只证明“某方称”却写 confirmed → overclaim）；判定模型取设置里的 `checkChannelId`（独立审查渠道），未配置时回落撰写模型并在结果里标 `sameModelJudge` / Main 摘要带 `judge_note`。`independence.js`：来源身份 = 发布方名（`entry.provenance.publisher`/`entry.source`）> 可注册主域名 > doc，再按引文 3-gram Jaccard≥0.6 / 包含关系做并查集归并通稿转载，`cross-source-pass` 需 ≥2 个**独立**来源 | `runCheckPipeline`, `verificationForMain`, `deriveClaimVerdict` |
| **subagent-ui.js** | 分开展示任务过程、结构化 claims 与运行时 verification；通过项紧凑，失败项展示错误和证据摘录。**`upsertSubagentCardEl` 把 `.chat-subagents` / `.cw-subagents` 钉在主 agent 流式正文（`.chat-stream-body` / `.cw-stream`）之前**，Thinking 行留在气泡底；禁止插到 Thinking 行前（正文一涨卡片会被顶到下面，回合结束 innerHTML 重建才跳回顶部） | `subagentCardHtml`, `subagentListHtml`, `upsertSubagentCardEl` |
| **scope-quiz.js** | 调研范围确认卡（AskUserQuestion 一问一窗）。归一化 `questions[]`、本地翻题、`【调研简报】` 交回。侧栏 / 浮动窗 / 阅读器共用 HTML + `attachScopeQuiz` | `normalizeScopeQuiz`, `applyScopeQuizAction`, `renderScopeQuizHtml`, `attachScopeQuiz`, `formatScopeBrief` |
| **plot-spec.js** | 无 DOM 的 G2 spec 编译器。`plot_chart` 参数（tidy 表 / `{name,points}` 序列 + events 标线）→ `{id,title,type,rows,option}`。默认图种 bar/line/area/scatter/heatmap；点名 donut/histogram/boxplot/radar/funnel/waterfall/sankey。上限 2000 行 / 8 系列 / 20 事件 / 环形 6 类。SW 与 Node 测试可直接 import。**`buildPlotOption(args, {mode:'print'})`** 出打印锁定 spec（`printLockOption`：白底、`animate:false`、关 tooltip、固定字体栈、轴标签字号 10→11）——图会从 480 逻辑 px 缩到 560px（5.83in）印在纸上，字号不同步放大会印糊 | `buildPlotOption`, `printLockOption`, `PLOT_TYPES`, `DEFAULT_PLOT_TYPES`, `NAMED_PLOT_TYPES`, `MAX_ROWS`, `PRINT_CHART_WIDTH/HEIGHT`, `PRINT_FONT_FAMILY` |
| **api-call.js** | 通用 HTTPS 调用。连接存在 `chrome.storage.local.apiConnectors`（name/baseUrl/authType/密钥/`allowWrite`/notes）。`executeApiCall`：list/save/delete/test/request；鉴权 none/bearer/header/query/basic/hmac_sha256；结果打码 query 密钥；POST 等必须已保存且允许写入。**响应不在源头截断**（2026-10-07 删掉旧的 3 万字砍，`CALL_API_MAX_RESPONSE_CHARS` 已移除）：全量文本交给执行器的溢出入库；超 100 万字符跳过 JSON 解析（慢且必然溢出），恒带 `chars` 字段。验证：`test/api-call-smoke.mjs` | `executeApiCall`, `loadConnectors`, `formatApiCatalog`, `API_PRESETS` |
| **insight.js** | **决策洞察**（主代理用 `record_insight` 工具上报的决策要素）：goal/decision/conclusion/pivot/risk/ask/next 七类；ask/risk/next 创建为 open 待处理，goal/conclusion 同线程单例（新值自动取代旧值标 superseded）；存 trace-log（`kind='insight'`，挂上报时所在回合下）。`formatInsightDigest` 把仍有效条目注入每轮动态前言（~900 字符，2026-10-07 接线：侧栏与 SW 两宿主都传 `insights`） | `insightTool`, `listInsights`, `formatInsightDigest`, `INSIGHT_TYPES` |
| **plot-runtime.js** | `@antv/g2` Canvas 运行时。独立产物 `dist/lib/plot-runtime.js`，**禁止静态导入进 SW** | `renderChart`, `disposeChart`, `chartToDataURL` |
| **chat-charts.js** | 聊天气泡挂载层 + **光栅化**（DOM-only）。按需 `import(chrome.runtime.getURL('lib/plot-runtime.js'))`。侧栏 / 浮动窗 / 阅读器共用宿主 HTML。**`rasterizeChartOption(option,{width,height,pixelRatio})`** 建一个视口外但**保留布局**的容器（`left:-10000px`，`display:none` 量不到宽高会出白图）→ `renderChart` → 从 G 画布 `toDataURL` → 返回 `{bytes,dataUrl}`，用完即 destroy+摘除。**必须真 DOM，SW 禁 import** | `chartHostHtml`, `mountChatCharts`, `disposeChatCharts`, `appendChartsTo`, `appendChartInMessage`, `rasterizeChartOption`, `dataUrlToBytes` |
| **chart-store.js** | 图表插图登记表：PNG 字节进 doc-store（键 `chart:<chartId>`），**题注/来源/尺寸**进 `chrome.storage.local.chartRefs`（全局字典，不按项目分）。上限 `MAX_REFS=200`，超限按 `at` 淘汰最旧并删掉其 PNG（否则 IDB 只增不减）。生成/重建 docx 时按 markdown 引用取回两者 | `chartBlobKey`, `saveChartRef`, `getChartRef`, `loadChartRefs`, `dropChartRef`, `MAX_REFS` |
| **place-images.js** | AI 图片交货。从当前/指定标签取原图（jpg/png/webp/gif）或元素截图，写入来源 `kind=image` + `source=place`，再交到对话 / 网页 contenteditable / docx。交货后默认删中转。一次最多 8 张。父级专属 `place_images`。测试：`node test/place-images-smoke.mjs` | `runPlaceImages`, `saveImageSource`, `loadImageSource`, `discardPlacedImages`, `discardEmbeddedPlaceImages`, `bytesToPreviewDataUrl` |
| **similarity.js** | 条目相似度打分（标题+摘要+标签综合），输出 `{ level: 'high'/'medium'/'low', finalScore, matchedEntryId }`；采集完成后由 SW 调用 | `findBestSimilarityMatch`, `calculateEntrySimilarity`, `similaritySeverity` |
| **tag-library.js** | 项目级标签库（NFKC 规范化、大小写不敏感、最多 50 个常用标签）。AI 返回的 `tagMerges` 会触发批量重命名 | `getTopTags`, `recordTags`, `mergeTags`, `replaceTagInEntries`, `applyTagMergesToTags` |

### 4.4 RSS / 订阅

| 模块 | 作用 | 关键导出 |
|---|---|---|
| **feed-parser.js** | `fast-xml-parser` 包装，支持 RSS 2.0 / Atom 1.0 / RDF / OPML，输出统一 item 结构 | `parseFeed`, `parseOPML` |
| **feed-fetcher.js** | 单源拉取与批量刷新：超时 20s（`FETCH_TIMEOUT_MS`）、并发 6（`MAX_CONCURRENT`）、UA 伪装、`If-None-Match` / `If-Modified-Since` 条件请求、304 短路、自动发现首页 `<link rel="alternate">`、RSSHub 失败切实例；`setDefaultsProvider(fn)` 用来在 SW 启动时注入 `getFeedPrefs` 作为全局默认值提供者 | `subscribe`, `refreshFeed`, `refreshFeeds`, `discoverFeedUrl`, `setDefaultsProvider` |
| **rsshub-fallback.js** | RSSHub 实例列表 + 路由重写。失败时按优先级遍历公共实例，首个成功的会回写到 `feed.url` 避免下次再撞死实例 | `isRsshubUrl`, `buildRsshubFallbacks` |
| **feed-backfill.js** | 后台翻译回填引擎。扫描 `translatedTo != 当前目标语言` 的 items，100/批（`BATCH_SIZE`）、最多 3 次 retry（`ATTEMPT_CAP`）、5 批并行（`PARALLEL_BATCHES`）、批间暂停 30ms（`IDLE_BETWEEN_BATCHES_MS`）；广播 `TRANSLATE_PROGRESS` 给 sidepanel 进度条（数据形状：`{ running, done, total, targetLang, download }`）。**三层链路**：按用户偏好挑选首选 tier（`tencent` / `google` / `local`），失败逐项 fallback 到下一 tier，最后兜底 `local`；写库时仅在**至少**标题或摘要翻译成功才标记 `translated:true`，否则只递增 `translateAttempts` 并保留 `translateError`（**不写 `translatedTo`**，避免后续永久跳过） | `runBackfill`, `getBackfillStatus`, `stopBackfill`, `setTranslateProvider` |
| **translator.js** | Chrome 138+ 内置 Translator API 封装（本地、免费、离线）。缓存 translator 实例、检测源语言、模型下载进度回调、不支持语言对入内存黑名单 | `translateBatch`, `isTranslatorReady`, `stripHtml`, `normalizeBcp47`, `onTranslatorProgress`, `sameLanguage` |
| **translator-cloud.js** | 云翻译后端：`google`（主端点 `clients5.google.com/translate_a/t?client=dict-chrome-ex`，Chrome 内置翻译同款免 Key 端点、CORS:*；gtx 老端点自动回退；并发 6、长文按 2000 字符切分）和 `tencent`（TMT TextTranslateBatch，TC3-HMAC-SHA256 签名、50/批、并发 3，免费 500 万字/月）。统一公开 `translateBatchCloud(texts, { provider, targetLanguage, tencent })` 与 `testCloudProvider(opts)` | `translateBatchCloud`, `testCloudProvider` |

**`feed-db.js#listItems` 查询参数**（v2 新增 `searchQuery` + `searchAny` + `searchInFullText` 支持）：
```js
listItems({
  feedId, feedIds,        // 单源 / 多源；都为空时走全表分支
  limit = 50,             // 单页大小
  beforePublishedAt,      // 翻页游标（取该时间戳之前的条目）
  onlyStarred = false,    // true  = 仅星标
  searchQuery = '',       // 多 token 空格分词、AND 匹配
  searchAny = '',         // 多 token 空格分词、OR 匹配（任一命中即可）
  searchInFullText = false, // true = 关键词额外匹配 fullText/originalFullText（跳过倒排索引，全表扫）
})
```
**两条路径都走 cursor 流式扫描**（不再 `getAll`）：单源/多源走 `feedId`/`feedId_publishedAt` 索引 cursor；全表分支走 `publishedAt` 索引的 `openCursor(range,'prev')` 反向游标（避免全表载入内存）。搜索默认匹配 5 个字段：`title / summary / author / originalTitle / originalSummary`（`buildHay`，要加字段在数组里追加）；`searchInFullText=true` 时追加 `fullText / originalFullText`（全文不进倒排索引，自动跳过索引走全表扫）。**已读/未读已废弃**：`includeRead` 参数、`markRead`/`countUnreadForProject`/`refreshFeedCounts` 函数均已移除；`read` 字段保留在库中但不读写，「已入库/未处理」用 `collectedEntryId` 判断；`feed.totalCount` 由 `countFeedItems`（feedId 索引 `count()`，O(log n)）维护。

### 4.5 导出

| 模块 | 作用 | 关键导出 |
|---|---|---|
| **md-to-docx.js** | Markdown -> DOCX 转换器，用于侧栏导出 / PDF 转可编辑 / 旧条目懒预览。用 `marked` 解析 markdown AST -> `docx` 库构建 OOXML。`create_document(format=docx)` 在 SW 走 `create-docx.js`（避免把 docx/marked 打进 SW）。**图表插图（与 create-docx 同一份引用写法）**：`markdownToDocxBlob` 顶部一次性解析 `![说明](chart:<id>)` 引用的字节与题注/来源（唯一 await 段），随后把 `currentChartImages` 置好、**同步**建块（同步段不可能被并发导出插进来，模块级变量才安全）——整行引用渲染成居中图片 +「图 N：说明」+ 8pt 灰字来源，行内引用渲染成图片本体，取不到字节留 `[图表缺图：id]` 占位。**`ImageRun` 必须显式传 `type:'png'`**（漏了媒体文件会叫 `media/<sha1>.undefined`，Word 直接坏） | `markdownToDocxBlob(md, options?)`、`entriesToMarkdownDocxBlob(entries)` |

### 4.6 导出面板子模块

| 模块 | 作用 | 关键导出 |
|---|---|---|
| **panel-export.js** (`src/sidepanel/`) | Export 子模块（2026-08-27 从 panel.js 拆出）：导出下拉菜单 + JSON/Markdown/TXT/CSV/DOCX 五格式导出（含 AI 文档经 md-to-docx 的结构化导出与降级链）。库状态由宿主以 getter 注入（getEntries/getSelectedIds/getProjectId/formatSourceTier），不共享可变全局 | `createExportApi({getEntries,getSelectedIds,getProjectId,formatSourceTier})` → `{toggleExportDropdown, closeAllDropdowns, exportAll, exportSelected}` |

> **已移除的子系统**（2026-08-27）：旧 `license.js` 明文 HTTP 轮询裸 IP、fail-open（`contentLocked` / `LOCK_STATE_CHANGED`）；`background/external-bridge.js`。不要再引用这些符号。
>
> **现行许可证**（2026-09-20）：[`src/lib/license.js`](src/lib/license.js) Ed25519 JWT、fail-closed、设备绑定。消息 `GET_LICENSE_STATE` / `ACTIVATE_LICENSE` / `LICENSE_STATE_CHANGED`；alarm `citecat-license-heartbeat`。公钥 [`src/lib/license-pubkey.js`](src/lib/license-pubkey.js)，私钥 `license-server/keys/private.pem` 只放 VPS。接口见 `license.js` 文件头。
### 4.7 Side Panel 辅助模块

| 模块 | 作用 | 关键导出 |
|---|---|---|
| **chat-prompt.js** (`src/sidepanel/`) | 缓存友好的系统提示词构建器。静态前缀含 **call_api 外部 HTTP API**（已保存渠道含免费无需 Key，用来提醒模型；不为每个源发版）/ plot_chart / ask_research_scope / RSS / task 等。动态前导含 `apiCatalog`（已保存连接，无密钥明文）+ **决策板摘要**（`formatInsightDigest`，`record_insight` 仍有效条目 ~900 字符，2026-10-07 v49 接线；侧栏与 SW 浮动窗两宿主都传 `insights`，SW 同时补上了此前缺失的 `notebookNotes`）。`const PROMPT_PROTOCOL_VERSION = 'citecat-v52-2026-10-09'` | `getStaticSystemPrompt`、`buildDynamicPreamble`、`PROMPT_PROTOCOL_VERSION` |
| **history-compact.js** (`src/sidepanel/`) | 对话历史压缩。当 tokens 超过 `budgetTokens`（默认 3000）时，保留最近 `keepTailTokens`（默认 1200）原文，旧消息用 LLM 摘要（失败则规则兜底）。tail 起点必须在 `user` 消息上 | `estimateTokens`、`estimateMessagesTokens`、`findSafeCut`、`compactHistory` |
| **rss-tools.js** (`src/sidepanel/`) | RSS 工具的 sidepanel 端处理函数。`listFeedsHandler`（列订阅源，含 `last_fetched_at`）、`queryFeedItemsHandler`（mode=list/count/group_by_feed/**by_day** + AND/OR + `search_in_fulltext` + 游标分页；聚合模式内部按 `RSS_SCAN_PAGE` 翻页直到过滤窗穷尽或 `RSS_SCAN_MAX`，返回 `truncated`/`scanned`/`hint`/`next_cursor`）、`refreshFeedsHandler`（立刻刷新，可选 `feed_ids`/`feed_titles`）、`fetchFeedItemHandler`（单条全文）、`fetchFeedItemsHandler`（批量最多 15 条，正文写入工作区回 `doc_id`）。通过 `chrome.runtime.sendMessage` 调 SW 拿数据 | `listFeedsHandler`、`queryFeedItemsHandler`、`refreshFeedsHandler`、`fetchFeedItemHandler`、`fetchFeedItemsHandler` |
| **pixel-cat.js** (`src/sidepanel/`) | 探头像素猫：趴在聊天输入框（.cmd-input-wrap 上沿）的 8-bit 小猫，只露耳朵+头+双爪（指尖压住输入框顶边造"扒住"感）。内联 SVG rect 网格（shape-rendering=crispEdges，14x9 字符网格生成，零图片零依赖）；行为（用户多轮迭代定稿）：**非场驻概率出没**——约每 4-9 分钟尝试一次、70% 概率探头、停留 2-4 分钟（均值≈10 分钟出来 3 分钟）后平滑滑出裁剪层完全消失（.peek-cat-clip overflow:hidden，猫 translateY(27px) 藏于层外；上升时被层裁切形成"头先露、爪后搭"的爬窗台时序，rising 0.7s / 回落 0.5s）；**伸爪概率**：每分钟 tick 概率 10% 起 +10%/分钟，触发一次平滑伸爪（.tap，ease 非 steps）后重置 10%，AI 生成中 .is-thinking 双爪循环快按；随机眨眼（2.2-6s JS 调度）；平滑缓动探头入场（cubic-bezier(0.22,1,0.36,1) + 0.1s 延迟，切回聊天面板时重播并重置停留计时）；轮廓色调浅（亮 --peek-line:#8a7466 / 暗 #52525b）；无呼吸浮动；配色 CSS 变量 --peek-fur/--peek-pink/--peek-line 随亮暗主题；prefers-reduced-motion 静态化。状态联动挂在 updateSendButton()（所有 chatInProgress 变化都刷新） | mountPeekCat, setPeekCatThinking |
| **rolling-number.js** (`src/lib/`) | 苹果风格数字文本过渡（SwiftUI `.contentTransition(.numericText())`）：`rollNumber(el, from, to)` 逐位纵向滚动（旧位滚出虚化、新位滚入合焦，千分位静态，位数变化退化为整串滚动，方向随增减翻转）。**整串滚动用隐藏 sizer（取新旧较宽者）钉列宽**，否则新数字会被列的 overflow:hidden 裁掉（曾出现"16,840 只显示 16,"）；faces 用 `fill:'both'` 防延迟期闪现。**位数收缩时**（如清空会话 9,999 -> 0）sizer 钉旧值宽度会使滚完后数字右边留空、把"tokens"标签顶在远处回不来，`glideShrink` 等滚完（duration 后）把列宽 glide 回新值宽度让标签滑回（300ms `cubic-bezier(.4,0,.2,1)`）；**位数增长时** sizer 取新值宽度、列宽本就正确，标签直接到位 snap 不 glide（避免与滚入的新数字重叠）。纯 WAAPI 自包含、只操作传入元素、`prefers-reduced-motion` 直接跳变。当前用于 chat-header 的 **Token 计数**（`#chatTokenMeter`，panel.js `updateTokenMeter`） | `rollNumber` |

### 4.8 阅读器与文档编辑

| 模块 | 作用 | 关键导出 |
|---|---|---|
| **reader.js** (`src/reader/`) | 文档阅读器页面主逻辑。统一渲染 5 种格式：PDF / docx / **doc（旧版 Word，抽出纯文本只读）** / xlsx / csv。xlsx/csv 走 SheetJS；docx 走 docx-preview；doc 走 `legacy-doc.js`。划词标注、片段收藏、浮动 AI、编辑模式入口（仅 xlsx/docx）。**content script 不注入 `chrome-extension://` 页，阅读器自己响应 `EXTRACT_CONTENT` / `SCROLL_COLLECT`**（`extractDocFullText` 按 docKind 分派，带全文懒缓存 + docUrl/title/kind 签名失效；**EXTRACT_CONTENT 先等文档就绪**——`beginDocLoad`/`endDocLoad` 包住下载+渲染，上限 15s，否则 AI 在 `manage_tabs(open)` 后立刻 `read_tab` 会拿到空正文）；PDF 分支同时产出 `pageOffsets` 随响应回给 `page-data.js`，供工作区按页锚定 | （非模块，无导出） |
| **doc-edit-sheets.js** | xlsx 编辑模式的可编辑层，基于 **Univer**（`@univerjs/presets` 的 `UniverSheetsCorePreset`）。因 Univer OSS 0.25 的 xlsx 导入导出是 Pro 功能不可用，故用 SheetJS 桥接：导入 SheetJS 解析 -> 构造 Univer workbook snapshot -> `createWorkbook`；导出 `workbook.save()` 快照 -> 转回 SheetJS -> `write`。公式以文本进 Univer 由其引擎计算，样式仅支持粗体。AI 编辑工具：`switch_sheet`/`set_range`/`set_bold`/`append_row`/`append_col`/`clear_range`/`undo`/`redo`（undo/redo 走 `univerAPI.undo()/redo()`） | `initSheetsEditor`, `disposeSheetsEditor`, `execSheetsTool`, `exportSheetsXlsx`, `sheetsText`, `getSelectionText`, `isDirty`, `onSheetsSelectionChange` |
| **doc-edit-word.js** | docx 编辑引擎 = **OOXML 定点手术**（2026-08-17 重写，替代 mammoth+Tiptap+htmlToDocx 有损往返）：JSZip 解压 -> DOMParser 解析 word/document.xml -> 文本索引层（w:t 全文拼接 + 段间换行 + 空白归一化匹配 + 跨 run 拆分定位）-> 只改目标节点 -> 塞回 zip 重压缩；**其余 zip 条目（styles/numbering/页眉页脚/媒体）字节原样保留，未动区域 100% 保真**（替换文本继承原 run 的 rPr 字体字号颜色）。AI 编辑工具：replace_text/insert_text/set_format（字体、字号、颜色、高亮、对齐、行距、缩进，直接写入）/set_bold/set_heading（复用或注入 heading 样式）/add_list（无 numbering.xml 时整包注入 part+Override+rel）/add_table（显式边框）/set_cell/undo/redo（document.xml 快照栈，cap 30）。**审阅修订**（doc_review）= OOXML 原生痕迹：w:ins/w:del（作者 SuperCat，del 内 w:t 转 w:delText），note 以**原生批注**锚定（comments.xml part + commentRangeStart/End + commentReference，接受/拒绝时一并清理）；accept=去 del+解包 ins、reject=删 ins+delText 还原；保存**保留修订痕迹**（Word/WPS 打开仍可逐条审阅），不强制落定；**首次创建修订时向 settings.xml 注入 `<w:trackChanges/>`**（Word 打开修订模式直接开启，用户后续输入也被跟踪）。**v30 起引擎在 SW 无头运行**（`@xmldom/xmldom` 提供 DOMParser/XMLSerializer；DOM 全局走 `docRef` 间接引用以通过 SW bundle 校验；`initWordEditor(null, ab)` 跳过渲染容器/selection 监听，`renderDoc` 为 no-op——阅读器已自行渲染）；**xmldom 无 `Element.remove()`，全部改用 `removeNode(node)` 帮助函数**（原生 DOM 同样可用）。曾用 `await import('docx-preview')` 动态加载渲染器，已删除（会向 SW bundle 注入 Vite `__vitePreload` 触发 build.js 回归守卫误报，且 SW 无 window 走不到）。Node 冒烟测试：test/docx-headless-smoke.mjs（无头链路：修订/直接改/undo/accept/settings 注入） | initWordEditor, disposeWordEditor, execWordTool, execReviewTool, pendingReviewCount, listReviewItems, exportWordDocx, wordText, isDirty |

> **doc_edit 工具全集**（tools.js L669 注册）：xlsx 6 个专属 + docx 8 个专属（含 set_format） + 通用 `undo`/`redo`/`export`，与两个编辑模块的 switch 及 reader 的 export 拦截完全对应。**入口归一化**：`chat-executor.js#executeToolCall` 对 `doc_edit`/`doc_review` 的 `args.tool` 做 `action`/`act`/`op` 别名回退，仍缺失时直接返回可用动作清单（引导模型自纠重试，不再透传 undefined 到编辑器）；编辑器 default 分支错误同样列出全部可用动作。触发链见 §6.9。

### 4.9 浮动 UI 与状态

| 模块 | 作用 | 关键导出 |
|---|---|---|
| **float-css.js** | 浮动 UI 的统一样式表（一个 CSS 字符串常量），供 content script 的 shadow DOM 与文档阅读器普通 DOM 共用。覆盖 `.inspect-tip`（检视信息条）、`.sel-bar`/`.sel-btn`（选区工具条）、`.mini-toast`、`.multi-frame`/`.multi-bar`（检视多选）、`.chat-win` 及全套 `.cw-*`（浮动聊天窗），含暗色 `@media (prefers-color-scheme: dark)` 适配。**聚焦模糊入场动画**：`tip-in`（检视信息条）/`bar-in`（选区条+多选条）/`chatWinIn`（聊天窗）/`cwMsgIn`（浮动聊天消息）均为 `blur+scale+saturate bloom -> filter:none` 的合焦感动画（`filter:none` 终点避免残留 containing block，见 §9 陷阱 36）。**注入到独立 host `#tsc-float-container`** 的 shadow（非主 checkbox 容器，因主 host 有 `backdrop-filter`/`transform` 会破坏 `position:fixed`） | `FLOAT_UI_CSS` |
| **orb-state.js** | AI 工具/动作 -> ThinkingOrb 动画状态的映射表（静态查表，非状态机；真正状态由各宿主 agent loop 传入）。9 种状态：`listening`/`searching`/`working`/`weaving`/`shaping`/`composing`/`breathing`/`connecting`/`solving`，所有工具/动作均显式分配不依赖默认 fallback | `ORB_STATE_BY_TOOL` |

---

## 5. Service Worker 消息路由（最重要）

`src/background/service-worker.js` 内 `chrome.runtime.onMessage` 的 `switch(message.type)`（共 45 个 case）。**所有跨上下文通信都走这里**（或走 §5.6 ann-chat 长连接端口），所以这是新功能的强制入口。

> **注意工具执行位置**：并非所有工具都走 SW 的 onMessage。以下工具在 **sidepanel 端 `chat-executor.js#executeToolCall`** 直接执行，不经 SW 消息：`read_current_page` / `interact_page`（含 CDP `chrome.debugger`）/ `search_web`（`fetchSearchResults` 直接 `fetch('https://html.duckduckgo.com/html/?q=...')`）/ `fetch_video_transcript` / `manage_tabs`（`chrome.tabs.*`）/ `create_document` / `plot_chart` / `call_api` / `save_memory` / `clear_context` / `auto_compact` / `doc_edit`（经 `ctx.bridge.docEdit` 到 SW 无头引擎，见 §6.9）。仅 RSS 查询/刷新类（`list_feeds` / `query_feed_items` / `refresh_feeds` 等）和采集类（`collect_content` 等）才 `sendMessage` 到 SW。浮动/阅读器聊天的工具执行在 SW 内（ann-chat 端口宿主），同样调 `chat-executor.executeToolCall`。

### 5.1 采集相关
| 消息 | 处理函数 | 作用 |
|---|---|---|
| `COLLECT` | `handleCollect` | 用户点采集 -> 跑 content script 拿正文 -> AI 总结 -> 查重 -> 入库 |
| `RETRY` | `handleRetry` | 对失败/未完成条目重跑流水线 |
| `FETCH_PAGE` | `handleFetchPage` | 仅抓页面正文（不入库） |
| `COLLECT_CONTENT` | `handleCollectContent` | content script / reader 主动推送当前页正文 |
| `COLLECT_SNIPPET` | `handleCollectSnippet` | 标注片段收藏（kind='snippet'，跳过 AI 总结，原文直接入库），由 doc-marks `collectAnnotationAsSnippet` 发出 |
| `COLLECT_IMAGE` | `handleCollectImage` | 用户收藏页面图片（kind=image，原图进 IDB） |
| `GET_IMAGE_SOURCE` | `handleGetImageSource` | `place_images` 往网页编辑器插图时，注入脚本按 id 取来源字节（回 `{ok, dataUrl}`） |
| `DELETE_SNIPPET_BY_ANNOTATION` | `handleDeleteSnippetByAnnotation` | 按标注重删关联 snippet（幂等），标注删除时联动 |
| `EXTRACT_CHART_DATA` | 内联（`chrome.scripting.executeScript` MAIN world） | 主世界读 ECharts/Chart.js 实例数据 |
| `CHECK_URL` | `handleCheckUrl` | 查询 URL 是否已在文库 |
| `DELETE_ENTRY` | `handleDeleteEntry` | 按 URL 删除（sidepanel 撤销恢复同步） |
| `OPEN_TAB` | `handleOpenTab` | 打开 URL 并记录 tabId；若带 `pendingAnnotationId`，加载完成后推 `SCROLL_TO_ANNOTATION` |
| `BROADCAST_COLLECTION_STATUS` | `broadcastCollectionStatus` | 向所有 sidepanel 实例广播状态变化 |

### 5.2 订阅相关（前缀 `FEED_`）
| 消息 | 处理函数 |
|---|---|
| `FEED_SUBSCRIBE` / `FEED_SUBSCRIBE_BATCH` / `FEED_IMPORT_OPML` | `handleFeedSubscribe / Batch / ImportOPML` |
| `FEED_LIST` / `FEED_UPDATE` / `FEED_DELETE` / `FEED_REORDER` | `handleFeedList / Update / Delete / Reorder` |
| `FEED_DELETE_ALL_ITEMS` | `handleFeedDeleteAllItems` - 批量删某些 feed 下的所有 items（feed 记录保留） |
| `FEED_REFRESH_ONE` / `FEED_REFRESH_ALL` | `handleFeedRefreshOne / All`（`FEED_REFRESH_ALL` 可传 `feedIds[]` 只刷指定源，省略则按 `scope` 刷当前项目或全部） |
| `FEED_ITEMS_LIST` / `FEED_ITEM_GET` / `FEED_ITEM_FETCH_FULL` | items 列表（支持 `searchQuery` + `searchAny` + `searchInFullText` + `beforePublishedAt` 游标分页 + **`metaOnly`** 瘦字段，供 count/by_day 扫描不拉 `fullText`）/ 详情 / 抓全文 |
| `FEED_ITEM_STAR` | 切换星标 |
| `FEED_ITEMS_COLLECT` | 批量把 items 转成文库条目，**并发池**（默认 3，上限 6，可传 `concurrency` 覆盖）；每步广播 `COLLECTION_STATUS_CHANGED` 让采集 panel 实时显示骨架卡。**调用方**：sidepanel UI（feed-view.js）与 AI 工具 `collect_feed_items`（chat-executor 经 `bridge.feedTransport`；SW 端 `swFeedTransport` 直调本 handler） |
| `FEED_GET_PREFS` / `FEED_SET_PREFS` | 订阅全局偏好。存放于 `chrome.storage.local.feedPrefs`，字段含 `intervalMin / defaultMaxItems / defaultFetchFrom / defaultFetchTo / defaultAutoTranslate / defaultTargetLanguage / rsshubInstance / translateProvider('google'\|'tencent'\|'local') / tencentSecretId / tencentSecretKey / tencentRegion`。`handleFeedSetPrefs` 在翻译相关字段变化时会调用 `syncTranslateProvider()` 把新配置注入 `feed-backfill`，且必要时触发一次 `resetTranslateFailures` |

### 5.3 翻译相关
| 消息 | 处理函数 |
|---|---|
| `TRANSLATE_GET_STATUS` | 查询 backfill 进度 |
| `TRANSLATE_RUN` | 立即触发 backfill |
| `TRANSLATE_STOP` | 中止 backfill |
| `TRANSLATE_TEST_PROVIDER` | `handleTestTranslateProvider` - 用一条 "hello" 探测云提供商配置是否可用，返回 `{ ok, sample, error }` |
| `TRANSLATE_RETRY_FAILED` | 调 `resetTranslateFailures(targetLang)` 把"未真正翻译成功但 attempts > 0 / 有 error / 错误地标了 translatedTo"的条目重置回可重试状态，然后立即跑一次 `runBackfill` |

### 5.3b 外部桥接相关（已移除）

> 2026-08-27 随 external-bridge.js 一并删除（EXTERNAL_BRIDGE_STATUS/SET/PUSH_NOW 三条）。

### 5.3c 多标签页相关（后台虚拟操作引擎）
| 消息 | 处理函数 | 作用 |
|---|---|---|
| `TAB_SNAPSHOT` | `handleTabSnapshot` | manage_tabs(list)：全部可读 tab 的 `{tabId, url, title, pageType, 摘要}` 快照。走 **EXTRACT_SNAPSHOT**（禁止 EXTRACT_CONTENT 全文），并发 6，单页 1.5s 超时、总预算 8s；休眠/冻结 tab 只回标题/URL。超时或 SW 被杀时 chat-executor 回退 `chrome.tabs.query` 元数据列表，避免「Managing tabs…」卡死。**候选过滤保留 SuperCat 阅读器页**（`isReadableTab`/`isReaderPage`）——阅读器页是 doc_edit/doc_review 的目标页，必须可被 AI 列出/读取 |
| `TAB_READ_MANY` | `handleTabReadMany` | read_many：批量 buildPageData（并发 4，≤10 页），每页带 `untrusted` 标记 |
| `TAB_SESSION_OPERATE` | `handleTabSessionOperate` | interact_page(tabId) 后台 CDP 操作：cdp_click / cdp_type / ax_snapshot / ax_click / capture_network / screenshot / exec_js / exec_js_main / scroll / scroll_to_bottom / navigate，走 TabSession 持久会话池 |
| `TAB_SESSION_STATUS` / `TAB_SESSION_RELEASE` | 直调 `sessionPool` | 会话池状态查询 / 释放指定 tab 会话 |

### 5.3d 阅读器与文档编辑相关
| 消息 | 处理函数 | 作用 |
|---|---|---|
| `READER_SESSION` | 内联 | 阅读器会话上报（state ∈ open/editing/closed + docId/docKind/docTitle），写入 **`readerSessions` 多会话注册表**。`doc_edit` / `doc_review` **不再**经 `routeDocMessage` 转发到阅读器（该函数仅遗留兜底）；docx/xlsx 一律走 SW `dispatchDocEdit` / `dispatchDocReview`，**无需点「编辑」**。`pickReaderSession()` + `formatReaderSessionNote` 注入动态前言：阅读器是 `chrome-extension://…/src/reader/index.html` 内页，禁止 `interact_page`、禁止让用户点「编辑」 |
| `READER_SESSION_GET` | 内联 | 查询当前 `readerSession`（doc_edit 工具定位目标阅读器 tab 用） |
| `DOC_EDIT` | 内联 async | 侧栏聊天的 `doc_edit` 分发：`dispatchDocEdit` 按文档类型分流——docx / xlsx 均由 SW 引擎（doc-edit-service）执行，无需阅读器/编辑模式（见 §6.9） |
| `DOC_FILE_CHANGED` | 同步 | `update_entry` 重建原件后通知 SW 丢弃内存引擎并广播 `DOC_UPDATED` |
| `DOC_REVIEW` | 内联 async | 侧栏聊天的 `doc_review`：docx 修订管理（list/accept/reject），SW 引擎执行；提出修订统一走 doc_edit 的 track_changes（见 §6.9） |
| `DOC_EXPORT` | 内联 async | 阅读器保存按钮（docx）：SW 导出最新字节 + 更新条目全文，返回给阅读器下载 |

### 5.4 SW 主动出站消息
| 消息 | 方向 | 触发 |
|---|---|---|
| `URL_CHANGED` | SW -> content script | `webNavigation.onHistoryStateUpdated` / `onReferenceFragmentUpdated` 时通知 content 重新判断 |
| `COLLECTION_STATUS_CHANGED` | SW -> 所有 sidepanel + content scripts | 条目状态变化广播：sidepanel `panel.js` 监听后重读 `entries` 并 `render()`（用微任务级 `_refreshScheduled` 合并多次广播）；content script 监听后同步页面圆形 checkbox 状态 |
| `SCROLL_TO_ANNOTATION` | SW -> content script / reader | `handleOpenTab` 带 `pendingAnnotationId` 时，tab 加载完成后推此消息定位高亮（从库内 snippet 跳回原页标注） |
| `RASTERIZE_CHART` | SW -> content script / reader | 浮动聊天调 `plot_chart(deliver="docx")` 时 SW 无 DOM，借发起聊天的页面渲染一张 PNG（回 `{ok, dataUrl}`；见 §6.12 陷阱 47） |
| `DOC_EDIT` | sidepanel -> SW | 侧栏 `runtime.sendMessage` 广播。只许 SW `dispatchDocEdit` 回执；阅读器页若应答会抢走回执（写入已成功、调用方看到失败） |
| `TRANSLATE_PROGRESS` | SW(`feed-backfill.js`) -> 所有 sidepanel | 翻译/模型下载进度 |
| `DELETE_ANNOTATION_MARK` | sidepanel -> content script / reader | 库内删 snippet 时通知原页移除高亮 |
| `REPLAY_ANNOTATIONS` | sidepanel -> content script / reader | 库内恢复 snippet 时通知原页重放标注 |

### 5.5 SW 内部事件
- `chrome.action.onClicked` -> 打开 SidePanel
- `chrome.alarms.onAlarm`（SW 文件内监听器，3 个）：`citecat-feed-refresh`（每 `prefs.intervalMin` 分钟批量刷 feeds，刷完触发一次翻译 backfill）；`citecat-index-build`（索引重建 alarm 兜底续跑——仅手动重建期间存在）；**`citecat-heartbeat-tick`**（每 1 分钟扫到期心跳任务，侧栏在则 `HEARTBEAT_FIRE`，否则 queued）
- `chrome.webNavigation.onHistoryStateUpdated` / `onReferenceFragmentUpdated` -> SPA 路由（pushState / hash）变化时推 `URL_CHANGED` 给 content
- `chrome.webNavigation.onCommitted` -> **PDF 阅读器接管**：检测 `.pdf` URL（15 秒去重），开 SuperCat 阅读器 tab 替代内置 viewer（见 §6.10）
- `chrome.runtime.onConnect` -> **ann-chat 长连接端口**（见 §5.6）
- `chrome.storage.onChanged` -> `entries_*` 写入时标记各 ann-chat 端口 `entriesDirty`（下次该端口聊天时重读条目）
- `chrome.tabs.onRemoved` -> 若该 tab 是用户从条目卡上点开重试的，关闭时自动 `handleRetry({entryId})`；并清理 `readerSession`
- `chrome.tabs.onUpdated` -> `handleOpenTab` 内**动态注册**，`pendingAnnotationId` 时推 `SCROLL_TO_ANNOTATION`，触发后自动 `removeListener`
- **SW 启动副作用**（`initOnStartup()` 顶层执行，非消息驱动）：
  1. `initDebuggerDispatch()` - Step 0（同步），后台 tab 会话池 CDP 事件全局分发
  2. `await syncTranslateProvider()` - Step 1（**await**，必须在 `runBackfill` 之前完成）
  3. Step 2 构造 `tasks` 数组经 `Promise.allSettled` 并行执行（fire-and-forget，单个失败不阻断）：`scheduleFeedAlarm()` / `runBackfill(targetLang)`（仅当 `prefs.defaultTargetLanguage` 存在才推入）。倒排索引的开机自动构建已封存（写入路径增量建索引足够），全量重建只从设置页按钮触发
  > 注：`setDefaultsProvider(getFeedPrefs)` 是**模块顶层语句**（模块加载时即执行），不在 `initOnStartup()` 内。

### 5.6 ann-chat 浮动聊天长连接端口
独立于 onMessage 的另一传输通道，承载**浮动 AI 聊天**（content 浮动窗 + reader 浮动窗 + 侧栏聊天的 SW 侧）。端口名 `'ann-chat'`，`chrome.runtime.onConnect` 监听。

- **入站**（content/reader -> SW）：`{type:'CHAT', messages, context}`（发起一轮对话）、`{type:'ABORT'}`（中止）
- **出站**（SW -> content/reader）：`{type:'chunk'}`（流式文本片段）、`{type:'done', messages, aborted}`（完成，**权威历史由 SW 维护**，含 assistant+tool 消息，随 done 回传覆盖本地）、`{type:'error'}`、`{type:'tool', status:'start'|'done'|'error', label, tool}`（工具执行状态，驱动 ThinkingOrb）、`{type:'ui', ...}`（clearHistory / toast / suggestions）
- SW 为每个端口维护 `portState`（entries/messages/summary/entriesDirty 等），构造 `ctx`，在 agent loop 中调 `chat-executor.executeToolCall`（与侧栏同一套工具实现）。
- content 侧逻辑在 `global.js`（`openChatWindow`/`sendChatMessage`/`handleChatPortMessage`），reader 侧在 `reader.js`，断线自动重连，60s 看门狗 `CHAT_WATCHDOG_MS`。

---

## 6. 核心数据流

### 6.1 网页采集
```
panel.js  --{type:COLLECT, url}-->  SW
   SW -- extractor.fetchViaTab(url) --> 开后台 tab
      fetchViaTab 三级降级链（默认超时 55s）:
        ① SCROLL_COLLECT (content script 滚动+累积 DOM 文本) -- 快路径，无 debugger 横幅。
           后台能滚就在后台滚。只有隐藏标签里滚动位置连续两轮不动，才返回 needsForeground；
           SW 用 withSerialForeground 排队，一次只把这一页拉到前台再滚，不并行抢焦点。
        ② captureNetworkViaCdp (DOM 不足/乱码: attach CDP + 重新滚动 + 抓 XHR/Fetch JSON
           + extractTextFromNetworkCapture 递归取最长字符串) -- 反爬首选，干净结构化数据
        ③ visionOcrViaCdp (网络也没抓到 + garbled + 配了 Vision: CDP 截图 + visionChat OCR) -- 最后兜底
      -> {content, publishedAt, title, networkCaptured?/visionOcr?}
   SW -- ai-client.summarizeText --> LLM --> {aiTitle, aiSummary, source, tags, date, tagMerges}
   SW -- similarity.findBestSimilarityMatch --> 标注查重结果
   SW -- tag-library.recordTags / applyTagMergesToTags --> 更新项目标签库
   SW -- storage.saveEntry / updateEntry --> 保存到 chrome.storage.local
   SW --{type:COLLECTION_STATUS_CHANGED}--> panel.js --> render()
```

### 6.2 RSS 订阅刷新
```
chrome.alarms (citecat-feed-refresh, 30 min)  -->  SW
   SW -- feed-fetcher.refreshFeeds (并发 6, 304 短路, If-None-Match)
        |-> feed-parser.parseFeed (XML --> 统一 item)
        |-> rsshub-fallback.buildRsshubFallbacks (失败时切实例)
        \-> feed-db.upsertItems (sha1 去重 --> IndexedDB)
AI 工具 refresh_feeds --> chat-executor --> FEED_REFRESH_ALL { feedIds? , scope }
   指定 feed_ids/feed_titles 则只刷那些源；省略 = 当前项目可见源
SW -- feed-backfill.runBackfill --> translateWithChain
         tier 链 (示例 user picked tencent): tencent -> google -> local
             tencent / google  --> translator-cloud.translateBatchCloud
             local             --> translator.translateBatch (Chrome 138+ 内置)
         100 条/批、5 批并行、批间 30ms 暂停; 广播 TRANSLATE_PROGRESS（含 download 子进度，仅 local tier 触发）
   feed-view.js 主动调用 FEED_LIST / FEED_ITEMS_LIST 拉刷新列表
```

### 6.3 加入文库（RSS item -> Entry）
```
用户在订阅 Panel 多选 + 点"加入文库"
panel.js --{FEED_ITEMS_COLLECT, itemIds[]}--> SW
   SW.handleFeedItemsCollect:
      并发池(默认 3，上限 6) 同时跑 processOne(itemId):
        1. 检查 item.collectedEntryId 已设？ 是则跳过
        2. 凑 fullText (fullText > contentHtml > summary)
        3. **无 http(s) 链接 且 正文 < 200 字** -> 返回 {ok:false, needsAiSearch:true, payload:{title,summary}}
           前端 feed-view 自动切到采集 Panel + 预填提示词调 sendChatMessage
           -> AI 走 search_web -> collect_content -> confirm_collect 流程
        4. 否则：link = item.link 或 `feed-item://{itemId}`(伪 URL，保留 dedup)
        5. 已存在同 url 的 entry？ 是则只 setCollectedEntryId 后跳过
        6. 立即 saveEntry({ status: fullText>=800 ? 'summarizing' : 'collecting' }) 占位
           --> broadcast COLLECTION_STATUS_CHANGED --> 采集 Panel 显示骨架卡 (动画)
        7. 有真实 http 链接且正文 < 800 字？ handleFetchPage(url) 抓原网页 (走 extractor.js, 不开 tab)
           --> updateEntry({ fullText, status:'summarizing' }) --> 再广播一次
           无真实链接但正文 >= 200 字 (自包含条目，如微博/X)：直接 status:'summarizing'
        8. summarizeWithTags(fullText) --> AI JSON
        9. updateEntry({ status:'completed', aiTitle, aiSummary, tags, ... })
        10. updateSimilarityForEntry / setCollectedEntryId(itemId, entryId)
        11. 最后再广播一次 --> 卡片刷新成完整内容
   sidepanel panel.js 监听 COLLECTION_STATUS_CHANGED
     --> refreshEntriesAndRender() (微任务合并, 多张卡同时进来只 render 一次)
```
### 6.4 DOCX 导出

```
panel.js -- entriesToMarkdownDocxBlob / markdownToDocxBlob
    \- downloadBlob --> 文件下载

panel.js -- create_document 工具
    |- format=xlsx -> create-xlsx.aoaToXlsxBuffer -> saveDocFile + kind=document
    |- format=docx -> create-docx.markdownToDocxBuffer -> saveDocFile + kind=document
    |- format=md/csv -> UTF-8 原件 saveDocFile
    |- markdownToDocxBlob(md) 仍用于侧栏导出 / 转可编辑 / 旧条目懒预览
    |- saveEntry({..., fullText, format, docId}) 入库
    \- downloadBlob --> 文件下载
```

### 6.5 订阅 Panel 列表加载（游标分页 + 后端搜索）
```
feed-view.js state: { items[], hasMore, loadingMore, loadToken, searchQuery }

切 Tab/订阅源/搜索 (搜索框 220ms debounce):
   reloadItems() --> loadToken++  --> FEED_ITEMS_LIST { limit:80, searchQuery }
     resp.items.length >= 80 ? hasMore = true
     renderItems()  --> 创建 .feed-load-more-sentinel + IntersectionObserver

滚动接近底部:
   sentinel 进入视口 --> loadMoreItems()
     beforePublishedAt = state.items[last].publishedAt
     FEED_ITEMS_LIST { limit:80, beforePublishedAt, searchQuery }
     appendItemCards() --> 末尾追加 N 张
```

### 6.6 文档上传与预览
```
用户在侧栏上传 PDF / Word（docx）/ Excel（xlsx）/ CSV / Markdown
panel.js ingestFiles 白名单拒绝 .doc/.xls/.txt/.gif 等；选择器不设 accept（全部文件）
   |- doc-import.extractDocText(file)  (动态 import pdfjs/mammoth/xlsx)
   |     -> {format, fullText, pageCount?}
   |- storage.saveEntry({ id, originalTitle:file.name, fullText, format, ... }) 入库
   |- doc-store.saveDocFile(id, file.arrayBuffer()) -> 原始二进制存 IndexedDB citecat-docs
   \- openDocPreview(id)
        |- doc-store.getDocFile(id) 检查原件存在？
        |     无原件(AI 生成 docx/md) -> md-to-docx 生成 -> saveDocFile 补存；
        |     无原件(AI 生成 csv) -> fullText 包 text/csv Blob 补存
        |     （卡片「预览」按钮对 docx/md/csv 三种格式显示）
        \- chrome.tabs.create({ url: getURL('src/reader/index.html?doc=<id>&name=<name>') })

reader.js init(?doc=):
   |- doc-store.getDocFile(docId) -> ArrayBuffer
   |- loadArrayBuffer(name, ab, 'doc://lib/<docId>')  (docUrl 用于标注分组)
   \- 按 detectKind 选渲染器: renderPdf / renderSheet / renderDocxDoc

PDF 卡片「转可编辑」（PDF 阅读器里只读，此为拿到可编辑版的通道）:
panel.js convertPdfToEditable(entry)
   |- pdfTextToMarkdown(fullText): 空行分段；段内断行拼接（两侧 CJK 直连，
   |    否则补空格）；markdown 结构字符全部转义（原文按字面进 Word）
   |- fullText 为空（扫描版）-> toast 拒绝
   |- md-to-docx.markdownToDocxBlob(md, {title}) -> 新 docx 原件
   |- saveDocFile(新id) + saveEntry(新条目: format:'docx', fileName:'<原名>_可编辑.docx',
   |    convertedFrom: 原 id；原 PDF 条目保留不动)
   \- openDocPreview(新条目) 直接打开可预览/编辑/AI 改
```

### 6.7 标注创建与重放
```
【创建 - 文本标注】网页/reader 划词
content/global.js onTextSelectChange (250ms debounce) -> tryShowSelectionBar
   用户点"荧光笔/下划线" -> createTextAnnotation(kind)
   doc-marks.createTextAnnotation(range, kind, url, pageTitle, root, noWrap):
      |- quoteContext(range, 40, 40) -> {text, prefix, suffix}  (TextQuoteSelector)
      |- buildTextIndex(root) 算 posStart/posEnd               (TextPositionSelector)
      |- annotations.saveAnnotation(url, ann) 落库
      \- wrapRangeWithMark(range, kind, id) <mark class=citecat-hl|ul> 包裹
【创建 - 元素标注】检视模式选中元素
   createElementAnnotation(kind) -> cssPath(el) 作 selector + 加 class citecat-el-hl|el-ul
【收藏为 snippet】点"收藏"按钮
   collectAnnotationAsSnippet -> SW {type:COLLECT_SNIPPET} 入库(不走AI)
   成功后 setAnnotationEntryId(url, annId, entryId) 回填双向关联
【重放】页面加载 / URL_CHANGED / REPLAY_ANNOTATIONS
   replayAnnotations(url, root):
      位置选择器优先(O(1)) -> 失败退回 quote 原文匹配(上下文消歧) -> 再退回归一化匹配
   SPA/动态内容: scheduleAnnotationReplay 用 MutationObserver 重试，上限 12 次
【删除】点标注浮层"删除"
   annotations.deleteAnnotation + unwrapMarks + SW {DELETE_SNIPPET_BY_ANNOTATION} 联动删 snippet
【库内联动】侧栏删/恢复 snippet
   panel.js notifySourceTabs(url, 'DELETE_ANNOTATION_MARK'|'REPLAY_ANNOTATIONS')
```

### 6.8 浮动 AI 聊天（ann-chat 端口）
```
content/global.js openChatWindow() 或 reader.js openChatWindow()
   |- 建/重用 .chat-win (380×420, 可拖拽 + 边框 resize)
   |- chrome.runtime.connect({name:'ann-chat'}) 长连接
   |- buildChatContext() 构造上下文(多选/元素/划词三分支)
   \- port.postMessage({type:'CHAT', messages, context})

SW onConnect('ann-chat'):
   |- 建 portState (entries/messages/summary/entriesDirty)
   |- 构造 ctx (含 bridge.* 跨上下文通道)
   |- agent loop: ai-client.streamChatWithTools -> 遇 tool_calls
   |     \- chat-executor.executeToolCall(name, args, ctx)  (与侧栏同一套)
   |     工具状态: port.postMessage({type:'tool', status, label, tool}) -> 驱动 ThinkingOrb
   |- 流式: port.postMessage({type:'chunk'}) 
   \- 完成: port.postMessage({type:'done', messages})  (权威历史回传覆盖本地)

content/reader handleChatPortMessage: chunk(追加) / done(覆盖历史) / error / tool(orb) / ui(suggestions/toast)
断线: handleChatPortDisconnect 置 null, sendChatMessage 自动重连; 60s 看门狗
```

### 6.9 doc_edit 工具链（v37：docx 与 xlsx 引擎都在 SW）
```
用户在侧栏/浮动窗/阅读器任一聊天入口说"改文档"
AI 调 doc_edit 工具(tools.js) {tool, args, doc_id?, track_changes?, note?}
   |- 宿主 executeToolCall('doc_edit') -> ctx.bridge.docEdit / SW DOC_EDIT 消息
   \- SW dispatchDocEdit({tool, args}):
        resolveDocTarget: args.doc_id 显式优先，缺省取最优阅读器会话的 docId
        docKindFor: 会话 kind 或库条目 format 判定类型
        |- xlsx -> doc-edit-service.editXlsxDoc（doc-edit-xlsx.js OOXML 手术，无需阅读器）
        |- docx -> doc-edit-service.editWordDoc(docId, tool, args):
        |     ensureEngine: 无头 initWordEditor(null, ab)（doc-store IDB 按 docId 取原件，
        |                    单引擎按 activeDocId 键控，切文档时用最新字节重建）
        |     track_changes 默认 false：replace_text / insert_text 直接写入
        |     track_changes=true：replace_text -> execReviewTool(suggest_replace)，
        |                     insert_text -> suggest_insert（w:ins/w:del + 批注 note）
        |     其余（含 set_format）-> execWordTool 直接改
        |     成功后 exportWordDocx 写回 IDB + 广播 DOC_UPDATED{docId}（阅读器重渲染）
        |     首次编辑附带 doc_digest（字符数/段落数/开头片段，轻量 read-before-write）
        |     **每次成功写操作回带 edits[{op,location,before,after,note}]**（引擎内 editBuf 按次清空，
        |        doc-edit-service 补 doc_id）→ 执行器 ctx.onDocEdit → 对话里的修改卡（见 §7）
        \- tool==='export' -> 对应引擎导出 + 更新条目全文 + 通知阅读器 DOC_EXPORT_DOWNLOAD

reader.js（docx 编辑视图 = 渲染器 + 修订面板；xlsx 只读表 / 可选 Univer 手动编辑）：
   DOC_UPDATED 监听 -> 250ms 防抖重渲染（docx 与 xlsx）
   修订面板: fetchRevList/applyReviewAction 经 DOC_REVIEW 消息走 SW 引擎
   saveEdit(docx) -> 未处理修订确认弹窗 -> DOC_EXPORT 取最新字节 -> 下载
   阅读器「编辑」仍可开 Univer 做手动改表；AI doc_edit 不再转发过去

保存/导出: 每次编辑已即时写回 doc-store（SW 重启不丢）；export 时同步条目 fullText
update_entry 改 xlsx/docx/md/txt/csv 正文会重建原件并 DOC_FILE_CHANGED 使引擎失效
```

### 6.10 文档阅读器接管
```
用户在浏览器打开 .pdf / .docx / .doc / .xlsx / .xls / .csv / .txt / .md URL
SW webNavigation.onCommitted 检测扩展名（15 秒去重）
   -> chrome.tabs.create({ url: getURL('src/reader/index.html?url=<远程文件>') })
collect_content / FETCH_PAGE 遇到文档 URL：后台开阅读器抽正文后关掉（不把 Office 当 HTML 抓）
manage_tabs(open) / interact_page(navigate) / handleOpenTab：文档 URL 改写到阅读器
```

---

### 6.11 AI 网页批注与文档审阅修订
```
【网页批注 annotate_page】panel/SW 聊天 -> executeToolCall('annotate_page')
   |- 目标 tab 解析（tab_id 或缺省当前页）+ 内部页面守卫
   |- chrome.tabs.sendMessage(tabId, {type:'ANNOTATE_QUOTE', data:{quote, kind, note}})
   \- content/global.js: findAnnotationRange(引文) -> createTextAnnotationCore(落库+<mark>包裹)
        -> saveAnnotation 回填 note；侧栏「标注」视图显示 note 行

【文档审阅修订 doc_review / doc_edit track_changes（v30：SW 引擎）】panel/SW 聊天 -> executeToolCall -> SW `dispatchDocEdit`/`dispatchDocReview`
   \- docx 由 doc-edit-service 在 SW 无头执行（无需阅读器/编辑模式），每次编辑写回 doc-store 并广播 DOC_UPDATED
        track_changes=true（默认直接写入；仅用户要求留痕时）：replace_text/insert_text -> execReviewTool 的
          suggest_replace: 原文 runs 包 w:del（w:t->w:delText）+ 其后 w:ins 新文（继承 rPr）
          suggest_insert: 整段 runs 包 w:ins；note -> comments.xml 原生批注（锚定修订处，Word/WPS 可见）
          accept/reject: 去 del+解包 ins / 删 ins+delText 还原，关联批注一并清理
        settings.xml 首次修订时注入 <w:trackChanges/>：Word 打开修订模式直接开启
   \- 阅读器修订面板 .review-panel（计数/全部接受/全部拒绝/逐条 + 点击定位）经 DOC_REVIEW 消息走 SW
   \- 保存: 带未处理修订时 confirmDialog（确定=带痕迹保存，Word 中可继续审阅；取消=返回处理）
        保存不自动接受--w:ins/w:del 落盘后仍是合法的 Word 修订模式文档
```

### 6.12 图表进 docx（G2 → PNG → Word 插图）
```
AI: plot_chart(deliver="docx", data=[...], title=..., source=...)
   |- 照旧 buildPlotOption -> ctx.onChart 把图显示在对话气泡里（用户看得到同一张图）
   |- buildPlotOption(args, {mode:'print'})：printLockOption 白底/止动画/关 tooltip/字号放大 10->11
   |- ctx.rasterizeChart(option,{width:480,height:270})   ← 宿主能力，三个宿主各不相同：
   |    侧栏（panel.js ctx）    -> chat-charts.rasterizeChartOption 本地渲
   |    浮动窗/阅读器（SW ctx）-> chrome.tabs.sendMessage(tabId,{type:'RASTERIZE_CHART'})
   |                              内容脚本 / 阅读器页用同一份 rasterizeChartOption 渲染，
   |                              回 {ok, dataUrl}（base64 字符串——ArrayBuffer 过不了 sendMessage）
   |    无 DOM 又找不到页面     -> 明确报错并提示改用侧栏（不静默降级）
   |- PNG 字节 -> doc-store（键 chart:<chartId>）；题注/来源 -> chart-store 登记表
   \- 返回：`![标题](chart:chartId)` 引用行 + 「单独一行原样写」的用法说明

AI: create_document(format="docx", content="...\n![标题](chart:cht_xxx)\n...")
   |- writeEntryOriginal(docx) -> collectChartImages(markdown)：按引用取 PNG + 题注/来源（缺图记入 missing）
   |- markdownToDocxBuffer(md, {images})：planChartImages 分配 relId/docPrId -> 正文图片段+题注+来源行
   |    + zip 补 media/imageN.png / Content_Types png Default / document.xml.rels image 关系 / 根元素 drawing 命名空间
   \- 结果文案回带「已嵌入 N 张图表图片」或「有 M 个引用取不到图片，请重新出图」
        （update_entry 改 docx 正文时走同一条 writeEntryOriginal，引用未变即自动重新嵌入）

导出侧（同一份引用写法，两条转换器各有一套 OOXML 组装）：
   导出面板把 markdown/来源条目转 docx -> md-to-docx.js（docx npm 库）
     |- markdownToDocxBlob 顶部解析 chart 引用（唯一 await 段）-> currentChartImages
     |- 同步建块：整行引用 -> 居中 ImageRun +「图 N」+ 来源；行内引用 -> 内联 ImageRun
     \- ImageRun 必须带 type:'png'（漏了生成 media/<sha1>.undefined，Word 打不开）
   docx 条目导出走 panel-export.js 直读 doc-store 原件（AI 生成时图已嵌进去，不经转换器）
```


## 7. Side Panel UI 与页面交互结构

`src/sidepanel/index.html` 是单页应用，4 个 Panel 切换 + 底部 Tab Bar：

| Tab idx | id | 渲染入口 | 主要文件 |
|---|---|---|---|
| 0 | `panelCollect`  | `workspace-view.js#refresh()` | `workspace-view.js`（来源/笔记/产出三主干 + 统一预览） |
| 1 | `panelFeed`     | `initFeedView()` | `feed-view.js`（订阅源侧栏 + 条目流 + add/edit dialog） |
| 2 | `panelLibrary`  | `renderProjects()` | `panel.js`（项目管理） |
| 3 | `panelSettings` | `initSettings()` | `panel.js`。**层级=使用频率**：常开区仅「接入渠道」（列表+编辑器）与「外观」（缩放）；低频组收进原生 `<details class=settings-fold>` 折叠：外部 API / 搜索与提示词 / 订阅与翻译（含索引维护）/ DOCX 导出模板 / 采集黑名单 / AI 记忆 / **子代理** / 关于与更新。视觉请求走当前渠道，设置里不再单列视觉模型。渠道列表无「当前渠道」下拉（非激活行整行点击即切换）；行内「编辑/删除」是 `.channel-icon-btn` 图标按钮（铅笔/垃圾桶 SVG，panel.js 顶部 `PENCIL_SVG`/`TRASH_SVG`），切换不再弹「已切换到…」状态文字。渠道编辑器的预设填充是**点击式芯片**（#chPresetChips）——曾用原生 select 弹层在侧栏里收不起来，勿改回下拉 |

切换由 `switchPanel(targetIdx)` 控制，CSS 用 `display:none` 隐藏非活动 Panel。底部 Tab Bar 必须保持为 `#app` 的直接子元素（与 `#panelContainer` 同级）；Feed 编辑弹窗等中间区域若多写闭合标签，浏览器会提前闭合 `#app`，令 Tab Bar 落到 `body` 下并被视口裁掉。当前底栏由 `.tab-bar` 固定为 60px。

- **composer 渠道快速切换**：`#chatChannelSwitch` 在输入盒底栏（回形针、闹钟右侧），**纯文字+展开箭头**（无边框底色，悬停墨色转主题色，展开时箭头旋转 180°），菜单向上弹出（聚焦虚化入场 240ms、收场 150ms；外点/Esc 关闭）；按钮 label=cur.model||name，菜单由 getAiChannels 每次现拉，切换经 setActiveChannelId 后 `handoffChannel`（插分隔、预检窗口/视觉）并调 renderChannelManager 同步设置页。
- **采集 Panel 的 chat 子区**：文档式对话（Cursor/Claude）——用户浅灰圆角卡拉满列宽（距边 12px），AI 无气泡通栏 Markdown。底部悬浮 composer：回形针上传（粘贴图片 / 文档入库并 pin）+ 心跳闹钟抽屉 + 渠道切换（左下）+ 发送（右下）。换模型继续同一线程，插入分隔并预检窗口/视觉。ThinkingOrb 动画不改。
- 流式 LLM 由 `ai-client.streamChatWithTools` 驱动
- 工具调用通过 **`chat-executor.js#executeToolCall`** 派发到本地实现（`fetchSearchResults` 等）；`panel.js` 仅 import 该函数并构造宿主 `ctx`
- 工具总共 **38 个**（见 `src/lib/tools.js`）：
  - **页面类**：`read_current_page`（读取当前浏览页，**返回统一 JSON**：`{"pageType":"article|list|dashboard|form","url","title","data"}` 或 `{"error"}`，**小页面默认全文，大文档自动分页**：正文 >200000 字符时返回首段 + `data.content_has_more`/`content_next_offset`，AI 用 `offset` 续拉下一段直到 `content_has_more=false`（单次读取上限 20 万字符，可多次读完）；也可主动传 `max_chars` 控制每段大小）。`pageType` 由 `content/global.js#detectPageType` 自动检测，AI 见类型即可决定下一步：article 正文在 `data.content`；dashboard 的 `data.tables`（数组，首行表头作列名）/`data.kv`（字段值对）/`data.charts`（ECharts/Chart.js 时间序列或数组）为结构化数据--DOM 层由 `extractStructuredData` 提取，图表实例数据由 `page-data.js` 在页面主世界只读获取（复用 `mainWorldEval`，不自动跑 CDP 抓包）；list 的 `data.items` 为条目数组；form 页提示用 describe_form。`format` 参数 `text`/`markdown`/`auto` 保留，auto 默认按 pageType 路由。后台采集路径（`extractor.js#fetchViaTab`）不带 format 保持纯文本） / `read_tab`（定向读任意标签页，**无需激活**，同一套结构化 JSON + offset 分页，tab_id 从 manage_tabs(list) 拿） / `read_many`（批量读 ≤10 页，SW 并发池，返回 `{pages:[...]}`，跨页对比/交叉验证用，需小段用 `max_chars`，不分页） / **`browser_act`**（默认紧循环：视口控件表 + 按编号 click/type/select，执行后自动返回新表，不抢前台） / `interact_page`（逃生口：编号/点击/滚动/输入/截图/**CDP 可信事件** `cdp_click`/`cdp_type`/**无障碍树** `ax_snapshot`/`ax_click`/`extract_subtitles`/`vision_find`/`vision_read`/`vision_extract`/`describe_form`/`navigate`/`exec_js` 等 **36 个**动作；**`tabId` 参数**：省略=当前活跃 tab，指定=后台标签页操作--cdp_click/cdp_type/ax_*/capture_network/screenshot 走 SW TabSession 持久会话，其余 action 的 content script 消息/scripting 直达目标 tab，vision 类仅限激活页）
  - **工作区 Entry 类**：`fetch_entry` / `delete_entry` / `update_entry` / `reorder_entries`
  - **采集类**：`collect_content` / `confirm_collect` / `cancel_collect`
  - **RSS 查询类**：`list_feeds`（列出订阅源，含 `last_fetched_at`） / `query_feed_items`（AND/OR 关键词 + `search_in_fulltext` 全文搜索 + mode=list/count/group_by_feed/**by_day** + 游标分页；count/by_day/group 穷尽过滤窗或返回 `truncated=true` + `next_cursor`，扫描上限 `RSS_SCAN_MAX` 不是库总量） / `refresh_feeds`（立刻刷新订阅，可选 `feed_ids`/`feed_titles`） / `fetch_feed_item`（单条全文） / `fetch_feed_items`（批量最多 15 条全文 + 写入工作区回 `doc_id`） / **`collect_feed_items`**（RSS 条目批量入库，最多 20 条，走 SW `FEED_ITEMS_COLLECT` 流水线）
  - **来源 / 笔记类**：`ingest`（只接受已有 Entry 或标签页 id → `doc_id`） / `read_section`（按 `chunk/page/offset` 回读） / `search_workspace`（只检索合格来源） / `notebook`（父级专属；verified 要求全部来源均为合格 `doc_id#anchor`） / `plan`（父级专属；任务清单，set 整表重发 / get / clear；预计 5 步以上的任务开工前先建，同一时刻只留一项 doing）
  - **视频/标签/文档类**：`fetch_video_transcript` / `manage_tabs` / `create_document`（生成 md/csv/json/docx/xlsx，写入“产出”） / `doc_edit` / `annotate_page` / `doc_review`
  - **对话内画图**：`plot_chart`（父级专属；已对齐小表 → G2，默认 bar/line/area/scatter/heatmap，点名 donut/histogram/boxplot/radar/funnel/waterfall/sankey，可 `events` 标线；图挂在气泡 `.chat-chart`，option 随 `msg.charts` 落盘）。**`deliver="docx"`** 时额外做一次打印锁定 + 光栅化，返回 `![标题](chart:<id>)` 引用行供 create_document / update_entry 的 markdown 嵌入（见 §6.12）；`source` 参数进图下 8pt 灰字来源行
  - **图片交货**：`place_images`（父级专属；取页图或截图 → 来源中转 `source=place` → `to=chat|editor|document`）。对话挂 `.chat-placed-images`（`msg.images`）；编辑器经 `GET_IMAGE_SOURCE` + 全 frame 注入插入 contenteditable；文档写 `![说明](img:id)`，`create_document` / `update_entry` 嵌入后删中转。不要图库、不要用户自己复制粘贴
  - **外部 API**：`call_api`（通用 HTTPS；已保存连接含免费无需 Key，注入目录提醒模型优先 `connector=名称`；密钥用设置页或 `action=save`；POST 等须 `allowWrite`；explore 仅 GET）
  - **通用**：`search_web` / `clear_context` / `auto_compact` / `suggest_actions` / `ask_research_scope` / `save_memory` / `manage_heartbeat` / `task` / `compose_report`（父级专属；研报写作阶段，成功后写入 report/kj/evidence 追踪节点）。`submit_report` 与 `section_job` 是仅注入 Sub 的内部工具，不属于 Main 的 `CHAT_TOOLS`
- AI 可返回 `suggest_actions` 工具结果 -> `renderSuggestionChips` 渲染按钮 -> 用户点击触发对应操作
- AI 可返回 `ask_research_scope` -> `scope-quiz.js` 在 AI 气泡里一问一窗翻题（侧栏完整说明、浮动窗 compact）；全部答完后作为用户消息「【调研简报】」发回；出卡后本轮工具循环中断，禁止接着派 task
- AI 可返回 `plot_chart` -> `plot-spec.js#buildPlotOption` 编 option，宿主 `onChart` 立刻把图挂进当前气泡（侧栏直接 DOM；浮动/阅读器经 ann-chat `{type:'ui', chart}`）；回合结束 `msg.charts` 写入会话，`renderChat` 重建后 `mountChatCharts` 再挂一次。不要用 ASCII/Markdown 表冒充图
- AI 可返回 `place_images` -> `place-images.js#runPlaceImages` 取图并交货；`to=chat` 时宿主 `onImage` 把预览挂进当前气泡（侧栏直接 DOM；浮动/阅读器经 `{type:'ui', image}`），回合结束 `msg.images` 写入会话
- **任务清单卡**（`plan` 工具）：`planTool` 成功后回调 `ctx.onPlan(plan)`，侧栏 `applyPlanUpdate` / 浮动窗 `upsertFloatPlan` **删掉旧卡再把新卡挂到最新一条 AI 消息**（数据上同时清掉其它消息的 `plan` 字段 → 单实例不变量），`clear` / 清空对话 / 整库清空时传 null 撤卡。卡片头部 `N/M` + 进度条 + 状态徽标，全完成自动收起；`renderChat` 用 `chatPlanHtml(m)` 从 `msg.plan` 重建（会话落盘自带）。`loadChatSession` 时用 `reconcilePlanFromStorage` 对齐按项目存的清单（浮动聊天建的清单切回侧栏也能看到）。样式 `.chat-plan*` / `.cw-plan*`
- **任务追踪页**（工作区时间线 `timeline-view.js` 的「任务追踪」tab → `trace-graph.js`）：简报（`briefing-view.js`，数据来自 `briefing-model.js` / `decision-model.js`）加过程时间线（`chat-flow-view.js`，数据来自 `trace-model.js#buildProcessTimeline`）。闲聊回合降级，调研回合保留子代理与断言分组。`data-tg-output` 打开产出。
- **文档修改卡**（对照 Cursor 的 diff 视图）：doc_edit 引擎回带 `edits` → 执行器 `ctx.onDocEdit(card)` → 侧栏 `applyDocEdit` / 浮动窗 `upsertFloatDocEdit` 挂 `.chat-diffs` 里的 `.chat-diff`（同一文档一张卡，多次编辑就地累加；本轮的卡默认展开）。卡内每处改动是 `位置 / 操作` + 改前（− 红底）改后（+ 主色底）两行，直接写入标「已写入」；只有 track_changes 产生的条目标「待审修订」并指向阅读器/Word。**不在卡上放接受/拒绝按钮**（与 Word 原生修订双头管理必出 bug）。doc_review 的 accept/reject 同样回带 edits，挂进同一张卡
- 工具执行状态由 `chat-executor.js#toolDisplayLabel` 生成标签、宿主 `showToolStatus/updateToolStatus` 渲染成 `.tool-status`，成功后最少显示 600ms 再淡出；视觉是 `style.css` 里的 `background-clip:text` shimmer：**同色相浅色 tint 软渐变高光**（业界标准参数：底色实色蓝 `#4e75df`，高光为同色相浅蓝 `#8ca5ea→#afc1f1→#8ca5ea` 五段柔和衰减，`background-size:200%` 扫过 2.5s ease-in-out；深色主题底 `#8aa7f2`、高光 `#a7bdf5→#b9caf7→#a7bdf5`；float-css 的 `.cw-thinking-text` 同款）。**不要用灰/白高光 + 硬边停靠**（灰色压在蓝字上发脏、三段硬边停靠显假，历史版本踩过这两个坑）
- `system prompt` 拆分为**静态前缀**（`chat-prompt.js#STATIC_PREFIX`/`getStaticSystemPrompt`，字节稳定，可被提供商 prompt cache 命中）+ **动态前导**（`chat-prompt.js#buildDynamicPreamble`，作为 user message 注入）。含当前时间/项目/页面、**自动检索的相关经验记忆**、**当前任务清单 `plan`**（`formatPlanDigest`，空清单不注入；未完成带一行「每完成一步立刻 set」的催促）、**调研笔记本摘要 `notebookNotes`**（`formatNotebookDigest`，有则注入）、**决策板摘要 `insights`**（`formatInsightDigest`，record_insight 仍有效条目，v49 起侧栏与 SW 两宿主都注入——决策板跟项目走，清空对话后 AI 仍能读到自己的目标/结论/风险/待拍板）、**当前阅读器会话 `sessionReaderNote`**（若有）、勾选 id / 首条预览 / 条目摘要 / 上下文变化。**RSS items 不进 prompt**，AI 全靠 `list_feeds` / `query_feed_items` / `refresh_feeds` 工具按需查 IndexedDB（数量大也不会爆 token）。对话历史过长时由 `history-compact.js#compactHistory` 自动压缩（LLM 摘要 + 规则兜底，摘要请求带 30s 超时防挂起）；触发阈值按模型上下文窗口推导（`chat-executor.js#contextCompactBudget` = 窗口×0.7−20k；窗口来自项目配置 `contextTokens`，设置页 AI 区可填，默认 1000000 即 1M），不再写死 500k。`HISTORY_KEEP_TAIL_TOKENS=32000` 是压缩保留尾部。**上下文防护（不截断 read）**：read 结果不做中途折叠/截断（callMessages 始终全量）；大文档由 read 工具源头分页（`offset`+`content_next_offset`，见 page-data.js）；API 超限 `isContextOverflowError` 识别后，侧栏面板「压缩更早历史 + `messages.slice(turnStart)` 保留本轮全文 + 重试一次」，浮动窗 SW 直接把错误报给用户。工具循环 `MAX_ROUNDS=100`（侧栏与 SW 一致），第 95 轮注入收尾提示引导模型停止调工具给最终回答，防模型陷在工具循环不收敛
- **Token 计数**：chat-header 标题右侧纯文字 `#chatTokenMeter`（`.ctm-num` 数字 + `.ctm-label` "tokens"），数字用 `rolling-number.js#rollNumber` 苹果式滚动过渡。口径 = **累计真实消耗**：`totalUsedTokens`（每轮 API 返回的 `usage.total_tokens` 求和，多轮工具调用逐 round 累加；auto_compact 的摘要请求 usage 也计入；清空对话/切项目归零）+ **流式期间估算预览**（`pendingUserText` 用户文本 + `liveTurnText` 流式生成中，API 流式期间不返回 usage，用估算让数字先动，回合结束用真实值校准，中断/失败回落到已入账部分）。**语义**：从对话开始一共花（烧）了多少 token——重发的历史/系统提示词/工具定义都真实包含在 usage 里，因此与 msg-cost（单次请求 usage）口径一致可加总；不再用 `estimateMessagesTokens` 估算历史大小。**布局铁律**：计数器和数字列必须 `flex:none + width:max-content` 且**不设 overflow:hidden**（flex 收缩会把多位数字裁成"只显示两位"）；"tokens" label 位数增长时随内联流右移到位；位数减少时 sizer 钉旧宽使 label 滞留远处、由 `glideShrink` 滚完后 glide 回新值宽度（否则清空后 label 不回来）；`tabular-nums` 固定数字宽度后只在位数变化时位移
- **设计系统主色已换**：`#4f46e5`（靛蓝）→ `#4e75df`（蓝），hover/active `#4338ca` → `#4267c4`，暗色主题亮变体 `#818cf8`→`#8aa7f2` / `#a5b4fc`→`#aac0f7`，所有 rgba(79,70,229)→rgba(78,117,223)、rgba(129,140,248)→rgba(138,167,242)。色板入口：`style.css :root` 的 `--primary/--primary-active/--accent` 等变量 + `reader.css --indigo` + content/float-css 内联色。新增 UI 直接用 `var(--primary)`，不要写死 hex

**设置 Panel 的「AI 记忆」区**：`#memoryList` 列出 `agentMemories`（domain/lesson/tags/urlPrefixes/importance/accessCount），`#clearMemoryBtn` 一键清空，`#memoryCount` 显示条数。AI 通过 `save_memory` 工具自动积累，每轮对话前 `retrieveMemories(userText, { currentUrl })` 按当前页 URL 前缀优先、tag 命中加分注入。子代理首次会话同样注入（只读，不能 `save_memory`）。

**全局拖放导入**：`panel.js` 顶层监听 `dragenter/dragleave/dragover/drop`，拖入 OPML/JSON 文件时弹出 `.drop-overlay` 蒙层；松开后路由到对应导入逻辑（OPML -> `FEED_IMPORT_OPML`）。

**文件选择器（2026-09-10）**：回形针 / 文库导入 / OPML 都走 `showOpenFilePicker`（`src/lib/pick-files.js`），**不要**用透明 `<input type=file>` 盖按钮，也**不要**对 hidden input 调 `click()`。Chrome 145+/150+ 把低透明度覆盖当 UI 冒充（CVE-2026-2322 / CVE-2026-14031），Side Panel 对不可见 file input 的 `click()` 也会卡数秒。导入/回形针不设类型过滤（全部文件），选完 `ingestFiles` 白名单拒绝：文档 `pdf/docx/xlsx/csv/md`、文库 JSON、配图 `png/jpeg/webp`。OPML 仍用短 `types`。拖放导入不受影响。

### 7.1 content script 页面交互层（`content/global.js`）

除文档已述的内容提取外，`global.js` 还承担全部页面侧交互（无导出，末尾 `init()` 自执行）：

- **圆形 checkbox（两套）**：
  - **页面级**（`createPageCheckbox`）：右上角胶囊容器 `div#tsc-global-container`（shadow DOM），含圆形 checkbox + 标签（"采集此页"/"采集视频"）+ 检视按钮。状态类 `tsc-loading`/`tsc-done`/`tsc-fail`。勾选触发 `COLLECT`；启动发 `CHECK_URL` 查是否已采集。容器可拖拽移动。
  - **搜索引擎结果级**（`injectSearchStyles`/`addSearchCheckbox`/`processResults`）：在 DDG/Google/Bing/Baidu/Yahoo/Yandex 结果每条旁注入圆形 checkbox（`tsc-cb`）。`RESULT_SELECTORS`/`LINK_SELECTORS` 定义各引擎选择器；`MutationObserver` 监听新结果；支持黑名单 + 屏蔽按钮。
- **检视模式（inspect）**：**扩展自建的页面元素选择模式，非 chrome.devtools**。右上角 `.inspect-btn` 切换（`enterInspectMode`/`exitInspectMode`），状态存 `INSPECT` 对象。capture 阶段事件：`mouseover`/`mouseout` 给悬停元素加 `2px solid #4e75df` outline + `.inspect-tip` 信息条（tag.class + 尺寸）；`click` 拦截原点击（`preventDefault`+`stopImmediatePropagation`），Ctrl/⌘+点击累计多选，普通点击退出 + 弹工具条；`contextmenu`（**仅检视模式启用时**）`resolveSectionName` 解析元素所属区块名（基于标题层级推断）-> `navigator.clipboard.writeText` 复制 -> `showMiniToast` 提示（即"右键复制区块名"，**不自动调 AI**）；`keydown` Esc 退出；`scroll`/`resize` 重绘多选框。
- **文本/元素标注与高亮**：划词弹 `.sel-bar`（AI/荧光笔/下划线/收藏）；检视选中弹工具条。标注经 `doc-marks.js` 创建 + `annotations.js` 落库 + `<mark>` 包裹。点标注弹收藏/删除浮层（`onMarkClick`/`showAnnPopover`）。标注重放见 §6.7。
- **snippet 收藏**：`collectTextSnippet`/`collectElementSnippet`/`collectAnnotationAsSnippet` -- 原文入库，不走 AI 总结。
- **AI 批注（annotate_page）**：`ANNOTATE_QUOTE` 消息 -- 按引文 `findAnnotationRange` 定位 → `createTextAnnotationCore` 落库+包裹 `<mark>` → `saveAnnotation` 回填 `note`（AI 批注说明）；定位失败返回错误引导重读页面。
- **浮动 AI 聊天窗**：工具条"AI"按钮 -> `openChatWindow()` 建 `.chat-win`（380×420，可拖拽 `dragChatWin`、可边框 resize `bindChatResize`），建 ann-chat 端口（见 §6.8）。`chatContext` 由 `buildChatContext` 构造（多选/元素/划词三分支），支持"元素数据"tab（`renderElementData`/`extractChartData` 从 MAIN world 读图表真实数据）。`plot_chart` 经 `{type:'ui', chart}` 把图挂进当前 `.cw-msg.ai`。

### 7.2 阅读器与标注子系统（`src/reader/`）

**为什么独立**：浏览器内置 PDF viewer 是受保护扩展页，content script 无法注入（无法跑标注/浮动聊天）。故 SuperCat 把 PDF/Word/Excel/CSV 统一在扩展页 `src/reader/index.html` 内渲染，reader.js 自行实现提取/标注/聊天/编辑全套逻辑（与 content script 共用 `doc-marks.js`/`annotations.js`/`float-css.js`/`orb-state.js`/`chat-executor.js`）。

**打开方式**（URL 参数）：
- `?url=<远程URL>` -- 网页 PDF 自动接管（`onCommitted` 检测 `.pdf` 触发，§6.10），`loadRemote` 拉取
- `?doc=<docId>` (+`?name=`) -- 库内文档，从 IndexedDB `citecat-docs` 取原件渲染，`docUrl='doc://lib/<docId>'`

**渲染库**：PDF -> `pdfjs-dist`（canvas 高分屏 + TextLayer，2 路并发流水线）；docx -> `docx-preview` `renderAsync`（只读 DOM）；xlsx/csv -> `xlsx` SheetJS `sheet_to_html`（多 sheet 切换条）。worker 用 `?url` 导入 + `getURL` 转扩展绝对路径。

**标注**：文本标注（`hl`/`ul`）+ 元素标注（`el-hl`/`el-ul`），锚点双重校验（TextQuoteSelector + TextPositionSelector），重放优先级 位置->quote->归一化。与网页同一套 `doc-marks.js` 实现。

**编辑模式**：xlsx 的 `enterEditMode` 懒加载 `doc-edit-sheets.js`（Univer）到 `#editorHost`；**docx 的"编辑视图"不再加载引擎**（v30 起引擎在 SW，见 §6.9）——`enterEditMode` 只建 `docxEditRenderEl` 渲染容器（docx-preview renderChanges:true 显示修订痕迹）+ 修订面板（操作经 DOC_REVIEW 走 SW），并取库内最新原件（AI 可能在后台已改过）。`saveEdit`（docx）先确认未处理修订，再经 `DOC_EXPORT` 取 SW 最新字节下载；`exitEditMode(confirmIfDirty)` 退出（docx 无本地未保存状态，只有 xlsx 需要 dirty 确认）。监听 `DOC_UPDATED`（SW 引擎编辑后广播，250ms 防抖重渲染 + 刷修订面板）与 `DOC_EXPORT_DOWNLOAD`（AI 触发导出后下载）。

**会话上报**：`announceReaderSession(state)` 打开文档后报 `'open'`、进入编辑后报 `'editing'`、`pagehide` 报 `'closed'`。SW 据此维护 `readerSessions` + `formatReaderSessionNote` 注入 AI 提示词（阅读器是扩展内页；改 docx/xlsx 用 `doc_edit`，无需点「编辑」）。

**通信**：reader 出站 `sendMessage`（`READER_SESSION`/`DELETE_SNIPPET_BY_ANNOTATION`/`COLLECT_SNIPPET`）+ ann-chat 端口（浮动聊天）；入站监听 `DOC_EDIT`/`EXTRACT_CONTENT`/`SCROLL_COLLECT`/`DELETE_ANNOTATION_MARK`/`REPLAY_ANNOTATIONS`。

---

## 8. 常见维护场景速查

### 场景 A：加一个新消息类型 / 新功能
1. `service-worker.js` 的 `switch(message.type)` 加 `case`
2. 实现 `handleXxx` 函数
3. 在调用方（`panel.js` 或 `content/global.js` 或 `reader.js`）`chrome.runtime.sendMessage({type:'XXX', ...})`
4. 如果要 UI 更新 -> SW 用 `chrome.runtime.sendMessage({type:'COLLECTION_STATUS_CHANGED'})` 广播
5. `npm run build`，到 `chrome://extensions` 点重新加载

### 场景 B：改 AI 提示词
- 改 `src/lib/ai-client.js` 顶部的 `PROMPT_TEMPLATE`。设置页不再提供可编辑副本。`setProjectConfig` 仍会丢掉存量里的 `promptTemplate` / `promptTemplateVersion`，避免旧配置把模板写回去。

### 场景 C：加一个新订阅源类型 / 新的 RSSHub 实例
- 仅追加公共实例 -> `rsshub-fallback.js` 的 `PUBLIC_RSSHUB_INSTANCES`
- 新增完全不同的 feed 格式 -> `feed-parser.js` 加 `parseXxx` 分支

### 场景 D：侧栏 DOCX 导出版式
导出统一走 `md-to-docx.js`（`entriesToMarkdownDocxBlob` / `markdownToDocxBlob`）。Service Worker 里的 `create_document` 走 `create-docx.js`，不要把 `docx` / `marked` 打进 SW。

### 场景 E：数据库迁移
- `feed-db.js` 的 `DB_VERSION` +1，在 `onupgradeneeded` 里写 `if (event.oldVersion < N) { ... }`（v2 迁移还从 createdAt/Date.now() 回填缺失的 publishedAt）
- `doc-store.js` 同理（当前 v1，store `files` 无 keyPath）
- `chrome.storage` 没有 schema 概念，加字段直接读写即可，但要保证 `getXxx` 给出默认值

### 场景 F：调订阅 -> 文库 的批量节奏 / 阈值
- 默认并发：`service-worker.js#handleFeedItemsCollect` 第一段的 `Math.max(1, Math.min(concurrency || 3, 6))`
- 「回原网页抓全文」的最低正文阈值：同函数内的 `if (!fullText || fullText.length < 800)`（< 800 字符就回源）
- 最终下限：`fullText.length < 20` 直接判失败
- 想让多张占位卡 "瞬间出现"：必须保证 SW 在 `saveEntry` 后立即 `await broadcastCollectionStatus({ urls:[link] })`，且 sidepanel `panel.js` 监听了 `COLLECTION_STATUS_CHANGED`（见第 9 条陷阱）

### 场景 G：调 RSS Panel 的分页 / 搜索行为
- 单页大小：`feed-view.js` 顶部 `PAGE_SIZE = 80`（改大 = 单次请求更慢；改小 = 滚动加载更频繁）
- 搜索 debounce：`feed-view.js` 搜索框监听里的 `setTimeout(..., 220)`
- 滚动触发距离：`IntersectionObserver` 的 `rootMargin: '300px 0px'`
- 后端搜索字段（5 个）：`feed-db.js#listItems` 的 `matchSearch` 函数（`title/summary/author/originalTitle/originalSummary`）。要加新字段在数组里追加即可
- **AI count/by_day 扫描上限**：`limits.js` 的 `RSS_SCAN_PAGE` / `RSS_SCAN_MAX`。触顶必须 `truncated=true`，禁止把 50000 说成总量。验证：`test/rss-tools-smoke.mjs`

### 场景 H/J：（已移除）外部桥接与 License

> 这两个子系统已于 2026-08-27 删除，无维护场景。

### 场景 K：加新 Chat 工具 / 改 interact_page 动作
1. `src/lib/tools.js` 的 `CHAT_TOOLS` 数组加工具定义（name/description/parameters），并在 `TOOL_LABELS` 加 UI 标签
2. `src/lib/chat-executor.js#executeToolCall` 的 `switch(name)` 加 `case` 实现逻辑（**不是 panel.js**）
3. 若工具需查 RSS/文库 -> `chrome.runtime.sendMessage` 调 SW（走第 5 节消息路由）；若纯本地操作（fetch/tabs/debugger）直接在 chat-executor 跑；若需 SW 侧能力（如 docEdit/tabSession）走 `ctx.bridge.*`
4. 若是 `interact_page` 新 action -> `tools.js` 的 `action.enum` 加值 + `content/global.js` 的 `handleInteractPage` 分支加实现（CDP 类动作在 chat-executor 直接调 `chrome.debugger`/`ctx.bridge.tabSessionOperate`，不下发给 content script）。默认点选循环改 `browser_act` / `loop_observe`+`loop_act`，不要往 `interact_page` 堆默认路径。
5. 静态提示词 `chat-prompt.js#STATIC_PREFIX` 里如有该工具的使用规则，一并更新并 bump `PROMPT_PROTOCOL_VERSION`；`orb-state.js#ORB_STATE_BY_TOOL` 加动画状态映射
6. `npm run build`，重新加载扩展

### 场景 Q：改子代理 / 加内置类型
1. 白名单：`src/lib/subagent-policy.js`（父级专属、explore 工具、explore 允许的 interact action）
2. 内置类型与纯逻辑：`src/lib/subagent-core.js` 的 `BUILTIN_AGENTS`
3. 运行时：`src/lib/subagent.js#runTaskTool`（独立循环、续传、后台回注）
4. 卡片 UI：`src/lib/subagent-ui.js`；侧栏 `panel.js`、浮动窗 `content/global.js`、阅读器 `reader.js` 都要能 upsert
5. 自定义类型走设置页 CRUD + `chrome.storage.local.customSubagents`，不要做 markdown 文件目录
6. 修改交回协议同时更新 `task-report.js`、三个 provider 的 function schema 转换、Check 与卡片；不能恢复自然语言/XML 真相通道
7. 章节拆分只扩展 `section-worker.js`，保持无状态和只读；不要把它加入 Main 工具集或提高 `SUBAGENT_MAX_DEPTH`
8. 验证：`npm test` 与 `npm run build`；改提示词规则须 bump `PROMPT_PROTOCOL_VERSION`
9. **不要**搬 OpenCode session 树 / Codex git worktree / 权限 ask 弹窗 / depth>1

### 场景 L：调 AI 经验记忆系统
- 存储位置：`chrome.storage.local.agentMemories`（数组，每条 `{id, domain, lesson, tags, urlPrefixes, importance, accessCount, lastAccessed, createdAt, updatedAt}`）
- 纯匹配/排序：`src/lib/agent-memory.js`（`rankMemories` / `calcRelevance` / `inferHostPrefix`）；验证跑 `node test/memory-retrieve-smoke.mjs`
- 写入：`save_memory` 工具 -> `chat-executor.js#executeToolCall` case `'save_memory'`（同 domain 更新去重并合并 `urlPrefixes`；domain/tags 能对上当前 tab hostname 时自动补前缀；超 80 条按 `calcRelevance()` 淘汰）
- 检索：`chat-executor.js#retrieveMemories(userText, { currentUrl, limit })` 每轮对话前调。优先级：URL 前缀命中且 tag/domain 命中 → 仅 URL 命中 → 仅文本命中。旧记忆无 `urlPrefixes` 时用 domain/tags 对齐 hostname。命中后写回 accessCount
- 注入：检索结果经 `formatMemoriesBlock` 传入 `buildDynamicPreamble({memories})`，站点命中带 `[当前站]`。**子代理**首次会话同样 `retrieveMemories`（query=任务 prompt，URL 从 `ctx.currentTabInfo` 抽），写入独立 SYSTEM-CONTEXT；`task_id` 续传不重复注入。子代理工具列表剔除 `save_memory`（`PARENT_ONLY_TOOLS`），执行层遇 `ctx.subagentKind` 也拒绝写入
- UI：设置 Panel「AI 记忆」区（`#memoryList` / `#clearMemoryBtn` / `#memoryCount`），卡片展示 urlPrefixes
- 上限/淘汰：改 `save_memory` case 里的 `if (agentMemories.length > 80)` 和 `calcRelevance()` 权重

### 场景 M：加 / 改 doc_edit 工具动作
1. `src/lib/tools.js` 的 `doc_edit` 工具 `tool.enum` 加值
2. 对应编辑模块加 switch 分支：xlsx 动作在 `doc-edit-sheets.js#execSheetsTool`，docx 动作在 `doc-edit-word.js#execWordTool`
3. `chat-prompt.js#STATIC_PREFIX` 的「文档编辑模式」说明同步更新，bump `PROMPT_PROTOCOL_VERSION`
4. `orb-state.js#ORB_STATE_BY_TOOL` 加 `doc_edit` 状态（当前 `shaping`）

### 场景 N：改标注锚点 / 重放策略
- 锚点构造：`doc-marks.js#quoteContext`（上下文长度）/ `buildTextIndex`（位置偏移）
- 重放优先级：`doc-marks.js#findAnnotationRange` / `replayAnnotations`（位置 -> quote -> 归一化）
- SPA 重试：`content/global.js#scheduleAnnotationReplay`（上限 12 次，改这里）
- 包裹逻辑：`wrapRangeWithMark`（受限父元素 TABLE/TBODY/TR/UL/OL/SELECT 跳过，逐文本节点包裹）
- 改完网页（content）和阅读器（reader）两侧都生效（共用同一模块）

### 场景 O：阅读器新增渲染格式
1. `doc-kind.js#kindOfName` / `reader.js#detectKind` 加格式判定
2. 加 `renderXxx(ab)` 渲染函数
3. `extractDocFullText` 加对应全文提取分支
4. 若要可编辑：新增 `doc-edit-xxx.js` 编辑模块 + `reader.js#enterEditMode` 路由 + tools.js `doc_edit` tool enum
5. `doc-import.js#extractDocTextFromBuffer` 加导入分支（动态 import 解析库；旧版二进制可走零依赖解析器）

---

## 9. 已知陷阱与约定

1. **不要把 DOM API 写进 `src/lib/`**（除非像 `extract-common.js`/`doc-marks.js` 那样只在传入的 doc/root 上操作）。lib 同时被 SW（无 DOM）和 sidepanel 共用，直接碰全局 `document.xxx` 会让 SW 启动崩溃。
2. **Service Worker 是无状态的**，任何变量都可能因 SW 休眠而丢失。需要持久化的状态走 `chrome.storage` 或 IDB；`feed-backfill.running` 是"best-effort 内存态"，可接受 SW 重启后丢失。`openedTabIds`（用于 tab 关闭时自动重试）已改用 `chrome.storage.session` 持久化，跨 SW 重启不丢失。`readerSessions`（阅读器会话注册表）也是内存态，但 reader 页每 45s 心跳重报，SW 重启后 ~45s 内自愈；tab 关闭走 `onRemoved`/`pagehide` 清理。
3. **Side Panel 可能存在多个实例**（多窗口）。`COLLECTION_STATUS_CHANGED` 必须广播给所有实例，sidepanel 内监听后整体 re-render。
4. **content script 上下文可能失效**（页面关闭、扩展更新）。`global.js` 顶部的 `safeSendMessage` 会先检查 `chrome.runtime?.id`，否则直接 reject，避免崩溃。
5. **`build.js` 多入口分别打包**：SW / content / sidepanel / reader 的运行时全局不同（SW 没有 `window`，content 共享页面 `window`，sidepanel 是独立 iframe，reader 是独立扩展页）。共享 lib 直接 `import`，由 rollup tree-shake + 重复打包，每个 bundle 自包含。**`plot-runtime.js` 额外打成 `dist/lib/plot-runtime.js`**（minify + inlineDynamicImports），content 经 WAR 动态加载。构建后 `validateSwBundle()` 会检查 SW 产物是否含 `window.`/`document.` 引用，防止 Vite 升级后注入浏览器代码导致 SW 崩溃。
6. **`manifest.json` 在仓库根也有一份**，`build.js` 会把它拷到 `dist/`。两份必须一致；想改权限改仓库根那份即可。
7. **不要把大块二进制放进 `storage.sync`**。`chrome.storage.sync` 有约 8KB/item 限制；文档原件走 IndexedDB `citecat-docs`。
8. **search_web 走当前选中的搜索渠道**（`search-channels.js`，档案在 `chrome.storage.local.searchChannels`，指针 `activeSearchChannelId`，Key 不进 sync）。设置页「搜索与提示词」是渠道列表：点一行即切换，可同时保存 Tavily / Brave / Serper / Exa / 博查 / SearXNG / DeepSeek 原生 / 网页抓取。缺 Key 直接报错；其它失败改用网页抓取（DuckDuckGo，失败再 Bing）。**请求在 sidepanel（chat-executor.js#fetchSearchResults）跑，不在 SW**。旧 `apiConfig.searchProvider` 只在首次迁移时读一次。
9. **翻译有三层链路**（`feed-backfill.js#buildTierChain`）：用户在设置里选首选 provider（`google` / `tencent` / `local`），失败的条目逐项 fallback 到下一 tier，`local` 始终兜底。云端 provider 由 `translator-cloud.js` 实现（`google` 主端点为 Chrome 内置翻译同款的 dict-chrome-ex（免 Key），gtx 回退；`tencent` 用 TMT TextTranslateBatch 走 TC3-HMAC-SHA256 签名）。失败时**只递增 `translateAttempts`、不写 `translatedTo`**，否则该条目会被永久跳过；切换 provider 时调 `TRANSLATE_RETRY_FAILED` 走 `resetTranslateFailures` 让历史失败可重试。
10. **项目（project）= 一个独立的文库**。所有跨项目的数据隔离都是用 `entries_{projectId}` / `projConfig_{projectId}` / `taglib_{projectId}` 这类带后缀的 storage key 实现的。Feed 的 scope 字段（`'global'` vs `<projectId字符串>`）决定它在哪个项目下可见（scope 是字符串，过滤用 `f.scope === 'global' || f.scope === projectId`）。
11. **`COLLECTION_STATUS_CHANGED` 一定要双向闭环**。SW 改了文库就要广播；sidepanel `panel.js` 加新的 onMessage 监听后**只调一次** `refreshEntriesAndRender()`（已用 `_refreshScheduled` 微任务级合并，多张卡同时进来只 render 一次）。曾经遇到过 SW 在广播 / panel 没监听 -> "加入文库无动画" 的 bug。
12. **MV3 扩展页面 CSP 默认禁止 inline event handler**（`onclick=` / `onerror=`）。所有事件绑定必须用 `addEventListener`。已在 `feed-view.js` 用 `img.error` listener 取代过 `<img onerror>` 字符串拼接。
13. **content script 跑在非 HTML 文档（XML/SVG/原始 RSS 在浏览器中直接打开）时，`document.createElement('div').style` 会是 undefined**。`global.js#createPageCheckbox` 入口处会早退 `if (!(document.body instanceof HTMLElement))` 或 `document.contentType !~ /html/i`。
14. **Cloudflare / captcha 不要自动绕过**。`extractor.js#detectBlocked` 和 `detectVerificationPage` 会返回 `needsVerification:true`；sidepanel blocked 卡片让用户打开真实页面完成验证，再点「已验证，继续采集」。`OPEN_TAB` 默认可传 `retryOnClose:false`，避免用户只是关闭验证页就自动重试。
15. **翻译会就地替换 item 字段**。`feed-backfill` 翻译成功后，会把 `item.title/summary/fullText` 替换为目标语言文本，原文备份到 `originalTitle/originalSummary/originalFullText`。后端搜索（`feed-db.js#matchSearch`）同时匹配原文和译文字段，所以用户用任意语言搜索都能命中。
16. **闹钟回调里调 `runBackfill` 必须吞掉异常**（`.catch(()=>{})`）- `chrome.alarms` 回调里抛错会让 SW 直接挂掉。
19. **Chat 系统提示词的缓存友好布局**（`chat-prompt.js`）：静态前缀（T1+T2 层）放在 system message 里，字节稳定以命中提供商 prompt cache；动态部分（T3-T6）作为 user message 注入。改提示词时注意 `PROMPT_PROTOCOL_VERSION` 版本号（当前 `'citecat-v52-2026-10-09'`）。阅读器是扩展内页，doc_edit 禁止让用户点「编辑」。
20. **对话历史压缩与上下文防护（不截断 read）**（`history-compact.js` + `chat-executor.js` + `page-data.js`）：当 history tokens 超过 `budgetTokens` 时触发，保留最近 `keepTailTokens` 原文，旧消息用 LLM 摘要（失败则规则兜底）。tail 起点必须在 `user` 消息上。`compactHistory` 的函数默认 `budgetTokens=3000, keepTailTokens=1200`；**各宿主实际传的是按模型窗口推导的预算**（`contextCompactBudget(cfg)` = `contextTokens`×0.7−20k，窗口来自项目配置 `contextTokens` 默认 1000000（1M），不再是写死的 500k），`keepTailTokens` 用 `HISTORY_KEEP_TAIL_TOKENS=32000`；`summarizeWithLLM` 带 30s 超时（防溢出恢复路径 await 它时卡死整轮）。**read 结果不做中途折叠/截断**（保持 callMessages 全量，符合"AI 阅读不截断"约定）：大文档由 read 工具源头分页（`page-data.js` 的 `offset` + `content_has_more`/`content_next_offset`，AI 续拉），不再用 `guardTurnContext` 中途砍结果（旧实现砍整个 JSON 字符串会切出半截 JSON 模型解析不了，已移除）。API 超限 `isContextOverflowError` 识别后：侧栏面板走「`compactChatHistoryIfNeeded(force)` 压缩更早历史 + `messages.slice(turnStart)` 保留本轮全文 + 重试一次」（若单条 read 仍超窗口则二次报错如实提示用户，不静默截断）；浮动窗 SW 直接把错误报给 reader。工具循环 `MAX_ROUNDS=100`（侧栏 panel 与 SW 一致，原先 panel 是 Infinity 易陷死循环），第 95 轮注入 system 收尾提示引导模型停止调工具给最终回答。改这套必须同步 `contextCompactBudget`/`getContextTokens`/`page-data.js#buildPageData` 三处。
21. **CDP debugger 动作用完即 detach，且禁止无限等**（`cdp.js` + chat-executor / tab-session / extractor）：CDP attach 前必须 `ensureTabForeground`（激活标签 + 聚焦窗口；`discarded/frozen` 先唤醒）。**`browser_act` 默认路径不走 CDP**，只用 `wakeTabIfSleeping`（仅 discarded/frozen 才激活，不抢用户前台）。`debugger.attach` / `Page.captureScreenshot` / `Accessibility.getFullAXTree` / `captureVisibleTab` 硬超时 `CDP_TIMEOUT_MS=20000`，超时抛错并 `detach`，`interact_page`/`browser_act`/`manage_tabs` 的 `acquireBrowserLock` 在 `finally` 里 `unlock`。一次性动作用 `withDebugger`（attach→fn→detach）；TabSession 持久会话仍是 attach 后复用。`onEvent` 监听器也在 `finally` 中移除。窗口不在前台时不要假设 attach 会成功。
22. **`extract-common.js` / `html-utils.js` / `doc-marks.js` 是多端共用纯模块**，写了 DOM API 但**只在传入的 doc/root 上操作**（`cloneNode` 后改），不直接碰 `document`/`window`，所以 SW（无 DOM）导入它们不会崩--前提是调用方先建好 `new DOMParser().parseFromString(...)`。content/sidepanel/reader 则直接传 `document`。
23. **Defuddle 只在 SW 端跑**（`extractor.js#extractContent` 从 fetch 到的 HTML 建 doc 后 `new Defuddle(doc)`）。content script 走 Readability + scored blocks，不跑 Defuddle（Defuddle 期望独立 doc 而非 live DOM）。改提取链时别把 Defuddle 搬进 content/global.js。
24. **AI 经验记忆（`agentMemories`）存 `chrome.storage.local`**，不进 sync（避免 8KB 限制 + 写入频繁）。最多 80 条，超限按 `calcRelevance()`（importance × recency × accessCount）淘汰。匹配/排序在 `agent-memory.js#rankMemories`：当前页 URL 命中 `urlPrefixes` 优先注入（即使用户没提站名），tag/domain 命中再加分；旧记忆无前缀时用 hostname 对齐 domain/tags。`save_memory` 同 `domain` 更新去重并合并 `urlPrefixes`；`general` 等通用 domain 不会因碰巧停在某站而被自动绑站。主助手每轮注入；子代理首次会话同样注入，但不能 `save_memory`。
25. **video-extractor.js 不再依赖 youtubei.js**。YouTube 走 fetch watch 页 HTML + 正则 `ytInitialPlayerResponse` + captionTracks JSON；Bilibili 走 `wbi/view/detail` + `player/wbi/v2` + 字幕 CDN。无 youtubei.js 的 InnertubeClient，所以不受 YouTube 反爬 Innertube 限制影响，但**依赖页面 HTML 结构稳定**，正则失效需更新。
26. **Vision 是三条渠道**（`chat-executor.js#callVisionModel` 共享调用 + `captureViewport` 截图）：`vision_find`（定位点击）、`vision_read`（页面理解，截图回答问题）、`vision_extract`（逐屏 OCR 提取整页文字，反爬兜底）。三者都走 `ensureTabForeground` 后再 `chrome.tabs.captureVisibleTab`（**需要前台可见**，20s 超时）+ 图片请求（经 providers 适配层，任意协议）。`vision_extract` 自动滚动逐屏截图、`callVisionModel` 逐块 OCR、边界去重拼接。模型选择走 `vision-client.js#resolveVisionModel`，一律用当前渠道主模型，不再外挂 `visionConfig`。提示词里要求 AI 在 `read_current_page` 拿到乱码/空内容时降级到 `vision_extract`。改 Vision 调用逻辑统一改 `callVisionModel`，别在三个 action 里各写一份请求。
27. **反爬三段式优先级**（提示词 `chat-prompt.js` 已写死）：`capture_network`（CDP 抓 XHR/Fetch JSON，首选，又快又干净）-> `exec_js_main`（主世界读框架全局如 `__NEXT_DATA__`）-> `vision_extract`（视觉 OCR，最后兜底）。`capture_network` 用 `chrome.debugger` + `Network.enable` + `Network.responseReceived` + `Network.getResponseBody`，attach/scroll/capture/detach 自包含，和 `cdp_click` 一样会短暂显示调试横幅。**后台采集（`fetchViaTab`）已接入完整三级降级链**：①`SCROLL_COLLECT`（DOM 提取，快路径，无 debugger 横幅）-> ②`captureNetworkViaCdp`（DOM 不足/乱码时，attach+重新滚动触发懒加载 XHR+抓 JSON，`extractTextFromNetworkCapture` 递归找最长字符串）-> ③`visionOcrViaCdp`（网络也没抓到 + `garbled` + 配了 Vision 时，CDP 截图 OCR）。默认超时 55s 以容纳整条链。前台 AI 驱动时用 `capture_network` / `exec_js_main` / `vision_extract` 动作手动选择。
28. **`vision-client.js` 是 SW + sidepanel 共用的纯模块**（无 DOM）。`resolveVisionModel` 三级解析链 + `visionChat` 发内容块请求（经 providers 适配层）。SW 的 `visionOcrViaCdp` 和 chat-executor 的 `callVisionModel` 都调它，避免请求逻辑两份。注意 SW 无 `Image`/`canvas`，不能做图片缩放--`visionOcrViaCdp` 直接发原始 JPEG（quality:80 已压缩），`callVisionModel` 才做 >1920px 缩放。

29. **多协议接入收口**（2026-08-26）：AI 请求只准走 `src/lib/providers/index.js`（chatStream/chatComplete），三个适配器 openai-chat / anthropic-messages / gemini。思考字段走 `providers/reasoning.js`；未收录 Off 不发。思考参数 400 由入口 `withEffortRetry` 最多降一档或剥字段（`effort-probe.js`），不要在各适配器里各写一套。改协议行为改适配器，别在调用点拼 fetch；新增协议 = providers/ 下加一个适配器 + index.js 注册一行。设置页「接入预设」选厂商即填 baseUrl/model/protocol；`contextTokens` 等项目级配置与 protocol 同存于 `projConfig_*`。Base URL 只填到域名或版本段也可自动补全端点（如 `api.openai.com/v1`）。**Anthropic 的 system 收尾提示（工具循环第 95 轮注入）会被并入顶层 system 参数**——这是适配器约定，中途 system 消息不会报错。验证跑 `node test/providers-smoke.mjs`，改适配器必须同步补断言。
29. **`exec_js` vs `exec_js_main`**：前者在 content script 隔离世界跑（`eval`，能访问 `chrome.runtime`、编号状态，但读不到页面框架变量）；后者在页面**主世界**跑（`chrome.scripting.executeScript({world:'MAIN'})`，能读 `__NEXT_DATA__`/React fiber/Vue `$data`，但受页面 CSP 约束、结果需 JSON 可序列化）。虚拟列表源数据用 `exec_js_main`，DOM 操作用 `exec_js`。
30. **UI 刷新铁律：只要有 `entries_*` 数据变动就刷新，不依赖任何单点**。三层保障：①`chrome.storage.onChanged` 全局监听（panel.js 监听 `entries_` 前缀 -> `refreshEntriesAndRender()`，**终极兜底**：覆盖 AI 工具 / SW 采集 / 订阅入库 / 手动操作 / 多窗口 sidepanel / 将来任何新功能，微任务防抖合并批量写入，读操作不回写无循环；另监听 `annotations_` 前缀 -> `renderAnnotationList()`，监听 `blacklist` 键 -> 同步设置页黑名单文本框）；②`COLLECTION_STATUS_CHANGED` 广播监听（SW -> panel）；③工具循环对写工具集合（`WRITE_TOOLS`：delete/update/reorder/collect 系列/create_document，定义在 `chat-executor.js`）执行后强制 `getEntries + render + renderLibrary`。**新增任何改文库数据的代码路径时不需要再手动补刷新**--只要写 `entries_{projectId}` 就会被兜住。注意：订阅面板的 IDB 数据不在 storage 里，onChanged 管不到，feed-view 自管；标注数据 `annotations_*` 在 storage 里，由前缀监听兜住。
31. **阅读器是扩展页，content script 不注入**。所以 reader.js 必须自行监听 `EXTRACT_SNAPSHOT`/`EXTRACT_CONTENT`/`SCROLL_COLLECT`：快照只回标题+缓存摘要（禁止为 list 抽 PDF 全文），全文提取仍给 SW 采集管线。同理 reader 的标注/浮动聊天逻辑自带，但共用 `doc-marks.js`/`annotations.js`/`float-css.js`/`chat-executor.js`。
32. **浏览器内置 PDF viewer 是受保护扩展页**，content script 无法注入（无法跑标注/浮动聊天）。故 `webNavigation.onCommitted` 检测 `.pdf/.docx/.doc/.xlsx/.xls/.csv/.txt/.md` 时开 SuperCat 阅读器 tab 替代（§6.10）。Office 直链还常变成下载，`FETCH_PAGE` / `manage_tabs(open)` / `interact_page(navigate)` 同样改写到阅读器。测试：`node test/doc-xlsx-smoke.mjs`、`node test/xlsx-headless-smoke.mjs`。
33. **删 Entry 必须走 `entry-cascade.js`**。直接调用 storage 的 `deleteEntry` 会漏掉 artifact、原件和笔记核验状态；UI 与 AI `delete_entry` 均使用 `deleteEntryCascade/restoreEntryCascade`。
34. **ann-chat 权威历史由 SW 维护**。content/reader 浮动窗的本地 `messages` 只是显示用；`done` 消息回传的 `messages`（含 assistant+tool 完整记录）会覆盖本地。故浮动窗重连后历史不丢（向 SW 发 CHAT 时 SW 用自己的 portState.messages）。
35. **检视模式（inspect）不是 chrome.devtools**，是扩展自建的页面元素选择模式（capture 阶段事件拦截）。右键在检视模式下复制区块名，**不自动调 AI**（仅 `navigator.clipboard.writeText` + toast）。
36. **聚焦模糊入场动画（filter blur-in）三条铁律**：①**终点必须用 `filter: none` 而不是 `blur(0)`**——`blur(0)` 仍是非 none 的 filter，会让元素永久成为 fixed/absolute 后代的 containing block（`.panel.active` 里若有 fixed toast 会被挪位）。②**全量 innerHTML 重建的列表不能给所有子项挂入场动画**——`renderChat` 每次全量重建，若 `.chat-msg` 直接带动画，每发一条消息整个历史都会重播模糊聚焦；现在只给最新一条加 `chat-msg-anim` 类。订阅列表同理：`appendItemCards`/`updateItemCard` 加 `feed-item-enter` 类（含 `animationDelay` 错峰），初始全量渲染 `appendItemCards(items, false)` 不挂。③**入场动画必须尊重 `prefers-reduced-motion`**（style.css 有全局 `*` 灭活规则自动覆盖；float-css/reader.css/content shadow 各自有媒体查询灭活；WAAPI 处（编号徽章）用 `matchMedia` 判断）。新加入场动画的组件按 `blur(Npx)+saturate(1.2~1.35) bloom -> none` 的合焦感模板写，N 按元素尺寸取 4~12px，时长 240~420ms（小元素短、大容器长）。

   **设置折叠组专用机制**（2026-08-27）：settings-fold 的展开用 ::details-content + html{interpolate-size:allow-keywords} 实现 block-size 0 到 auto 的真框展开（Chrome131+，本项目 138+ 安全），过渡=block-size+opacity+filter blur(10px)->none，开 420/280/340ms easeOutQuint 系、收 260/180/220ms 更短更干脆；**收回必须有 content-visibility … allow-discrete 过渡项**（离散属性配对，closed 态显式 content-visibility:hidden / open 态 visible）——漏了它收回就会瞬间消失无动画（2026-08-27 补）；子项错峰封顶 130ms；#channelEditor 用 :not([hidden]) 触发同款动画。表单皮肤选择器已是 .settings-section 与 .settings-fold 双作用域（新增折叠自动继承），预设填充保持点击式芯片勿改回原生 select（侧栏里弹层收不起来）。

37. **React root（ThinkingOrb）卸载必须在容器被移除之前**：`mountChatOrb`/`mountThinkingOrb` 用 `createRoot(el)` 把 orb 渲进 `.cw-thinking-orb`/`.chat-thinking-orb` span。任何会销毁该 span 的非 React DOM 操作（`body.innerHTML=` 整体替换、`row.remove()` 移掉含它的 `.cw-thinking-row`）发生前，**必须先调 `unmountChatOrb()`/`unmountThinkingOrb()`**，否则 React 后续 `unmount`/commit 的 `removeChild` 抛 `NotFoundError: The node to be removed is not a child of this node`（reader xlsx 页曾触发）。`reader.js` 的 `finishAiChunk`/`failAiChunk` 已是「先 unmount 再 removeThinkingRow」、`resetChatBody` 已是「先 unmount 再 innerHTML」；侧栏 `panel.js` 中断路径同样先 `unmountThinkingOrb` 再 `bubbleEl.innerHTML=`。新增任何会整体重建聊天消息区的代码都要遵守此顺序。
38. **docx 编辑引擎在 SW 无头运行（v30）**：`doc-edit-word.js` 被打进 SW bundle，三条铁律——①DOMParser/XMLSerializer 用 `@xmldom/xmldom` 回退，DOM 访问一律走 `docRef` 间接引用（SW bundle 校验禁止字面 `document.`/`window.` 属性访问；**校验器对依赖产物里字符串/正则内含反引号有脆弱点**，会吞掉大片代码的引号标记导致误报，我方 SW 侧字符串字面量也避免出现连续 `document.` 字样，路径用 `'word/document' + '.xml'` 拼接）；②**引擎内禁止 `Element.remove()`**（xmldom 没有），统一用 `removeNode(node)`；③**禁止动态 `import()`**（会注入 Vite `__vitePreload` 到 bundle 深处触发回归守卫），渲染职责已移给阅读器。改引擎任何 DOM 用法都要对照这三条。测试：`test/docx-headless-smoke.mjs`。
39. **docx 每次编辑即持久化**（doc-edit-service `persistAndNotify`）：SW 引擎单实例按 `activeDocId` 键控，切文档/换项目/重载 SW 都从 doc-store IDB 最新字节重建引擎，未保存改动不丢；代价是每次编辑一次重 zip + IDB 写（人类节奏无感）。`export` 才更新库条目 fullText（逐编辑更新太贵）。。**修订编号为稳定 w:id**（revSeq 单调分配、永不复用；曾用位置编号，accept/reject 后列表移位导致 reject 命中错误对象）；accept/reject 响应带 `processed` 回显（id/find/replacement/note）。**同一文档的操作按 docId 串行队列**（`withDocLock`）：doc_edit / doc_review / export 并发会踩引擎单实例状态，必须排队；`routeDocMessage` 带 kindFilter，xlsx 编辑只发 xlsx 会话（docx 阅读器的兜底文案曾误当最终结果返回给模型）。**待审修订内 find 守卫**（`guardPendingRevision`）：定位到的 run 处于 w:ins/w:del 内时拒绝编辑并引导先 accept/reject（防嵌套痕迹；find 以含插入痕迹的可见文本为准）。**导出自证**：export 响应带 `pending` 修订数，阅读器工具栏「待审 N」徽标（只读/编辑都显示，DOC_UPDATED 时刷新）。**list_revisions 长修订清单不会被砍**（工具结果进历史已无全局截断上限——旧 TOOL_RESULT_CAP_CHARS=30000 及其豁免逻辑已删，后续轮次按稳定 id 操作不被误导）。**Word 拒开修复**（`sanitizeRevisionMarks`）：历史版本曾允许对待审修订内文本再次编辑，产生非法嵌套 ins/del（schema 违规），Word 拒绝打开；init 时拍平嵌套痕迹、文本节点按外层类型纠错（del 内只能 delText / ins 内只能 t），`wasRevisionSanitized()` 标记后由 doc-edit-service 在 ensureEngine 时**立即持久化**修复结果；settings.xml 的 trackChanges 按 CT_Settings schema 顺序插入（最后一个前置元素之后），不再简单拼在根标签末尾。**ArrayBuffer 不能过 chrome.runtime.sendMessage**（响应走 JSON 序列化，ArrayBuffer 变 `{}`）：曾导致 docx 导出下载文件内容为 15 字节的 `[object Object]`（Blob 把 `{}` 序列化成字符串）；凡是"SW 写字节、页面下载"的场景，页面侧一律从共享 doc-store IDB 直读（`getDocFile`），消息只传 `{ok}` 状态。Port.postMessage 是结构化克隆可传字节，sendMessage 不行
40. **`chrome.tabs.sendMessage` 没有默认超时**：内容脚本不 `sendResponse`、抛错、页面冻结/休眠、或 MV3 SW 在异步 handler 中途被杀，Promise 永不 settle，侧栏会永远停在「Managing tabs…」。`manage_tabs(list)` **禁止**对每个 tab 跑 `EXTRACT_CONTENT`（Readability `cloneNode` + `getComputedStyle` 扫整页 + 阅读器 PDF 全文提取都是秒-分钟级）。必须走 `EXTRACT_SNAPSHOT`（廉价 title/snippet）+ 单页/总预算超时 + 执行器侧 `chrome.tabs.query` 回退。`EXTRACT_CONTENT` 自身也必须 try/catch 后一定 `sendResponse`。
41. **Sub 完成条件是 `submit_report`，不是正文**。没有合法 TaskReport 必须标记 incomplete；报告到 Main 前必须强制 Check。核验元数据只能由运行时生成。内容失败最多 revision 一次，基础设施失败不计数。并行 3、depth=1、单 Sub 标签 6、父子历史隔离与 tool transcript 规则保持不变。**预算用满不是失败**：强制轮只开放 `submit_report`（`childCtx.subagentAllowedTools` 同步收窄，防模型硬调别的工具），交回的报告照常过 Check，卡片带 `budgetNote`；只有强制轮也没交才判 incomplete。
42. **Nested 不是第三层有状态 Agent**。`section_job` 只允许 Sub 调用，只读合格 artifact 的指定章节，每作业新上下文且不保存 session；并行 4、单次 20k 字（分页，不是文件上限）、3 轮、45 秒。返回 `content_has_more` / `content_next_offset`，Sub 用 `offset` 续拉，续拉时不要再带 page/chunk。它的结构化结果由 Sub 去重后再 `submit_report`。
43. **来源 / 笔记 / 产出是唯一工作区模型**。`ingest` 不接受裸文本；`kind=text` 仅兼容读取且不可引用。笔记只有全部来源均为合格 `doc_id#anchor` 才能 verified。清空三个主干相互独立且保留聊天；来源删除后关联 verified 笔记降为 open。旧 assets 存储、四主干 UI、hidden entryList、XML task_result 和重复导出入口均已删除。
44. **侧栏文件选择器走 `showOpenFilePicker`**（2026-09-10）：Chrome Side Panel 对不可见 file input 调 `.click()` 会卡数秒；Chrome 145+/150+ 对 `opacity≈0` 覆盖的 file input 会当 UI 冒充再卡几秒。回形针/导入/OPML 用 `pickLocalFiles`（File System Access API），不要叠透明 input。导入/回形针不设类型过滤，选完 `ingestFiles` + `isUploadDocName` 拒绝。白名单：`pdf/docx/xlsx/csv/md` + JSON 文库 + `png/jpeg/webp`。`.doc/.xls/.txt/.gif/.markdown` 不再接收（库内旧条目阅读器仍能开）。
45. **修改痕迹（doc_edit `edits`）三条实现约束**：①`paraLocation()`/`beforeText` 必须在**原节点被移除或包裹之前**取——`loc.runs[0]` 一旦 `removeNode` 或塞进 `w:del`，宿主链就变了，事后取只能拿到空定位（曾导致 location 全空）；②`edits` 按次清空（`editBuf.length = 0` 在入口重置，失败操作不得带残迹，成功才 `splice` 回带）；③回喂模型的摘要用 `formatEditsForModel`（单侧 60 字）而**不是**原始 `edits`（单侧 240 字 + 全量），执行器把 `edits` 从返回 JSON 里剔除再拼摘要，否则一次批量改表能把上下文翻几倍。写操作的「验收证据」= 同一份数据同时给人（修改卡）和给模型（摘要），不要在工具返回值里另写一套。
46. **清单卡是单实例，靠数据不变量而非 DOM 去重**：`plan` 工具成功后必须回调 `ctx.onPlan(plan)`（clear 传 null）——只写存储不通知，UI 不会动；宿主 `applyPlanUpdate` 先把所有消息的 `plan` 字段清掉再写最新一条，DOM 侧同样先删旧卡再挂新卡，否则 `renderChat` 重建后会出现多张卡。`plan_{projectId}` 是**按项目**存的（浮动聊天与侧栏共享），`loadChatSession` 用 `reconcilePlanFromStorage` 按 `updatedAt` 对齐；清空对话 / `clear_context` / 整库清空都要 `clearPlan`（残留旧计划会持续污染动态前言）。
47. **图表进 docx 的四条硬约束**：①**光栅化必须有真 DOM 且容器保留布局**——G2 量不到宽高就出白图，`display:none` 不行（用 `left:-10000px`）；SW 没有 DOM（`chat-charts.js` 禁 import），浮动窗/阅读器走 `RASTERIZE_CHART` 消息借页面渲染，**回传 base64 字符串**（ArrayBuffer 过 sendMessage 会变 `{}`，老坑）；②**图片进 docx 要四处齐全**，缺一处 Word 报「内容有问题」：`word/media/imageN.png` 部件 + `[Content_Types].xml` 的 `<Default Extension="png">` + `document.xml.rels` 的 image 关系 + **根元素声明 r/wp/a/pic 四个命名空间**（embed 引用靠 `r:embed`，命名空间缺了 rId 解析不出来）；③**正文的 r:embed 必须与 rels 同源**——relId/docPrId 由 `planChartImages` 一次分配、正文与 zip 共用同一份结果（各分一次必然对不上）；④**尺寸按 9525 EMU/px 换算并压进可打印宽度**（A4 减页边距≈577px，取 560 上限），字号要跟着放大：图从 480 逻辑 px 缩到 560px 印在纸上，轴标签 10px 只剩 ~7.5pt，必须 11px 起。
48. **PNG 是光栅化的终点，不要指望 SVG/SSR 路线**：G2 能出 SVG，但 SVG 进 Word 仍需光栅回退（要 canvas/sharp，SW 都没有），绕一圈还多一套格式分支。图表图字节存 doc-store（键 `chart:<id>`）、题注/来源存 `chartRefs` 登记表（上限 200，超限删字节防 IDB 只增不减）；`update_entry` 改 docx 正文时走同一条 `writeEntryOriginal`，引用没变就自动重新嵌入。
49. **核验通过 ≠ 事情为真**（2026-10-07）：`entailment-pass` 只说明引文支持“该 attribution 以该 modality 说了这件事”。①claim 的 `modality`/`attribution` 必须一路透传（task-report → Check → trace 节点 meta → 决策板），下游不能把 claimed/reported 渲染成事实；②独立来源数以 `independence.js` 为准，**不要回退成按 docId 或完整 hostname 计数**（转载/通稿会被算成多源印证）；③Check 判定模型优先用设置里的独立审查渠道，回落同模型时必须保留 `sameModelJudge`/`judge_note` 标记，不得静默。
50. **证据原文不得被翻译覆盖**：RSS 翻译回填只改 `item.summary`/`title`，原文保存在 `item.originalSummary`；入库正文、`fetch_feed_item(s)` 取证一律 `originalSummary || summary`，`fullText` 永不被译文覆盖。新写取 RSS 正文作为证据的路径要遵守同一优先级。AI `create_document` 产出的 `sourceTier` 留空，不得自标 high。
51. **成文按体裁，材料是原文段落**（2026-10-16）：用户要一份文档时，Main 派 explore，任务书写明要回答的问题。explore 的 `summary` 是这一路的判断、关键数字和对不上的地方；`passages`（use、doc_id、anchor、逐字 quote）留下原文。claims 为空则不跑 Check。Main 看 summary 和 unresolved，只为会让判断反过来、但还没找到原文的点再派阅读。判断够了调用 `write_document`（`document-writer.js`）：写作看到调查员的判断和原文段落，结论要在判断上再推进一步。改稿只删编造的数字（原文没有、且无法用原文数字算出）。判断不因为原文里没有这句话就删掉，也不因此退回补读。`need_reading` 只在正文把这种编造数字当成事实时返回。研报在定稿后另走一趟挂出处：只在正文里原样存在的短句后插入 `〔doc_id#anchor〕`，文末列出处；挂不上的丢掉，不改句子。成功后对话只告知已保存。`create_document` 仍用于用户已经给了内容的整理和数据表。`compose_report` 名称保留，走同一条成文路径。
52. **追踪页是简报加过程，不是论证图**（2026-10-15）：`trace-graph.js` 渲染 `briefing-view.js` 与 `chat-flow-view.js`。闲聊回合（无子代理/研报/笔记判断）在过程时间线里 grade=idle。旧的 React Flow 论证图、dagre 布局和决策板 HTML 已删除。

---

## 10. 外部依赖一览

| 包 | 用途 | 用在哪 |
|---|---|---|
| `@mozilla/readability` | 网页正文提取（Defuddle 之后的回退） | `extractor.js`、`content/global.js` |
| `defuddle` | 网页正文提取（**首选**，Markdown 输出 + schema.org 元数据） | `extractor.js` |
| `docx` | 程序化生成 DOCX | `md-to-docx.js`、`doc-edit-word.js` |
| `jszip` | 解压/重打包 DOCX（即 ZIP） | `create-docx.js`、`doc-edit-word.js`、`doc-edit-xlsx.js` |
| `fast-xml-parser` | RSS/Atom/OPML 解析 | `feed-parser.js` |
| `marked` | Markdown 解析为 token AST | `md-to-docx.js` |
| `pdfjs-dist` | PDF 渲染（阅读器 canvas + TextLayer）+ PDF 文本提取（doc-import） | `reader/reader.js`、`doc-import.js` |
| `docx-preview` | docx 只读渲染（阅读器） | `reader/reader.js` |
| `xlsx` (SheetJS) | xlsx/csv 渲染 + 导入导出桥接 | `reader/reader.js`、`doc-import.js`、`doc-edit-sheets.js` |
| `@univerjs/presets` (+`@univerjs/core`/`themes`) | xlsx 编辑模式可编辑层（Univer） | `doc-edit-sheets.js` |
| `@tiptap/*`（已弃用） | 旧 docx WYSIWYG 编辑器；2026-08-17 引擎重写后无引用（package.json 暂留，构建已自动剔除） | 无 |
| `mammoth` | docx -> 纯文本提取（仅入库导入用；编辑模式已不再走 mammoth） | `doc-import.js` |
| `react` / `react-dom` | ThinkingOrb 动画组件渲染 | `content/global.js`、`reader/reader.js`（浮动聊天 orb） |
| `thinking-orbs` | AI 思考加载动画指示器 | 三宿主（panel/reader/content 浮动窗） |
| `@antv/g2` | 对话内图表（柱/线/面积/散点/热力 + 点名图种 + canvas） | `plot-runtime.js` → `dist/lib/plot-runtime.js` |
| `gsap` | 动画 | UI 动效 |
| `vite` (dev) | 打包器 | `build.js` |
| `pdf-lib` (dev) | PDF 处理（开发依赖） | 构建辅助 |

> `youtubei.js` 已移除。YouTube 字幕改走 fetch watch 页 HTML + 正则 `ytInitialPlayerResponse` + captionTracks JSON（见 `video-extractor.js`）。

**外部服务**（非 npm 包）：

| 服务 | 用途 | 用在哪 |
|---|---|---|
| Update Server (`http://47.104.128.124/citecat/update.xml`) | 扩展自更新 | `manifest.json` |
| License Server (`http://47.104.128.124/citecat/license`) | 许可证激活 / 心跳 | `src/lib/license.js` |

> 没有 Vue/任何主 UI 框架 -- sidepanel/reader 用原生 DOM 操作 + 手写事件绑定。React 仅用于 ThinkingOrb 动画组件（浮动聊天加载指示器）。新功能也请保持原生 DOM 风格。
> 没有 TypeScript -- 全部纯 JS + JSDoc 注释（如有）。

---

## 11. 给后续 AI 的建议

- 先读这份文档，再读 `service-worker.js` 的 `switch` 块 -> 你就理解了 80%。
- 修改前，**先用 grep 搜消息类型字符串**（如 `COLLECT`、`FEED_REFRESH_ALL`、`DOC_EDIT`），定位所有发送方和接收方。
- 加新依赖前先想：**这个包能在 Service Worker 里跑吗？**（不能用 `window` / `document` / `localStorage` / `XMLHttpRequest` 同步等）。阅读器/编辑器的重依赖（pdfjs/Univer/mammoth/docx-preview）走**动态 `import()`** 拆 chunk，不进常驻 bundle。
- UI 改动可以只动 `src/sidepanel/` 三个文件 + `index.html` + `style.css`，不需要重启扩展（但仍要 `npm run build`）。阅读器 UI 改 `src/reader/`。
- SW 改动后**必须**到 `chrome://extensions` 点"重新加载"，否则不生效。
- 如果改动涉及 storage schema，**保留旧数据兼容性**：读时给默认值，不要直接 `set` 覆盖整个对象。
- **改了代码就同步改本文档对应章节**（见文首维护约定）。

- End of architecture doc -
