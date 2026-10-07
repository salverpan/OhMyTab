/**
 * AI 工具 → ThinkingOrb 状态映射（侧边栏 / 浮动聊天窗 / 阅读器聊天窗共用，
 * 保证三处加载动画逻辑一致）。
 *
 * 九种动画状态语义（thinking-orbs）：
 *   listening  = 波形   — 读取/监听（页面、条目、无障碍树、网络、截图）
 *   searching  = 扫描   — 搜索/枚举（联网搜索、RSS 检索、视觉定位、页面元素编号）
 *   working    = 轨道   — 浏览器操作（点击/输入/滚动/导航/JS/标签页）
 *   weaving    = 编织   — 整合（记忆编织、多页交叉验证）
 *   shaping    = 塑形   — 写库（采集入库、更新条目、排序、文档编辑）
 *   composing  = 编曲   — 创作（生成文档）
 *   breathing  = 呼吸   — 轻量瞬时（删除/清空/压缩/等待）
 *   connecting = 连接   — 远程拉取（视频字幕、API 数据）
 *   solving    = 求解   — 决策/确认（建议、表单分析、确认/取消）
 * 所有工具/动作均显式分配，不再依赖默认 fallback（working）。
 */
export const ORB_STATE_BY_TOOL = {
  // ---- listening：读取/监听 ----
  read_current_page: 'listening',
  read_tab: 'listening',
  fetch_entry: 'listening',
  fetch_feed_item: 'listening',
  fetch_feed_items: 'listening',
  list_feeds: 'listening',
  ax_snapshot: 'listening', // 无障碍树
  vision_read: 'listening', // 视觉理解
  vision_extract: 'listening', // 视觉 OCR
  capture_network: 'listening', // CDP 抓包监听
  get_element: 'listening',
  get_table: 'listening',
  get_links: 'listening',
  screenshot: 'listening',

  // ---- searching：搜索/扫描/枚举 ----
  search_web: 'searching',
  query_feed_items: 'searching',
  vision_find: 'searching',
  number_elements: 'searching', // 页面元素编号
  list_clickable: 'searching',
  clear_numbers: 'searching',

  // ---- working：浏览器操作 ----
  interact_page: 'working',
  browser_act: 'working',
  click: 'working',
  click_number: 'working',
  click_text: 'working',
  click_at: 'working',
  hover: 'working',
  type: 'working',
  press_key: 'working',
  select_option: 'working',
  open_dropdown: 'working',
  select_from_dropdown: 'working',
  scroll_down: 'working',
  scroll_up: 'working',
  scroll_to_bottom: 'working',
  exec_js: 'working',
  exec_js_main: 'working',
  navigate: 'working',
  go_back: 'working',
  cdp_click: 'working',
  cdp_type: 'working',
  ax_click: 'working',
  manage_tabs: 'working',

  // ---- weaving：整合 ----
  save_memory: 'weaving',
  read_many: 'weaving', // 批量读多页交叉验证（编织到一起）
  task: 'weaving',

  // ---- shaping：写库 ----
  collect_content: 'shaping',
  collect_feed_items: 'shaping',
  update_entry: 'shaping',
  reorder_entries: 'shaping',
  doc_edit: 'shaping',
  doc_review: 'shaping',
  manage_heartbeat: 'breathing',

  // ---- composing：创作 ----
  create_document: 'composing',
  plot_chart: 'composing',

  // ---- breathing：轻量瞬时/等待 ----
  delete_entry: 'breathing',
  clear_context: 'breathing',
  auto_compact: 'breathing',
  wait: 'breathing',
  wait_for: 'breathing',

  // ---- connecting：远程拉取 ----
  fetch_video_transcript: 'connecting',
  extract_subtitles: 'connecting',
  refresh_feeds: 'connecting',
  call_api: 'connecting',

  // ---- solving：决策/确认 ----
  suggest_actions: 'solving',
  ask_research_scope: 'solving',
  describe_form: 'solving', // 表单分析出结构化方案
  confirm_collect: 'solving',
  cancel_collect: 'solving',
};
