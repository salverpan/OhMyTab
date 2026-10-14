/**
 * 子代理策略常量（无运行时依赖）。
 * chat-executor 与 subagent.js 都要读白名单，不能互相 import。
 */

export const PARENT_ONLY_TOOLS = new Set([
  'task', 'clear_context', 'suggest_actions', 'ask_research_scope', 'manage_heartbeat', 'auto_compact',
  'save_memory', 'notebook', 'plot_chart', 'plan', 'record_insight', 'compose_report', 'write_document',
]);
// call_api 不是父级专属：explore 可 GET；save/delete/写入在执行器里再拦。

export const EXPLORE_INTERACT_ALLOW = new Set([
  'navigate', 'go_back', 'scroll_down', 'scroll_up', 'scroll_to_bottom',
  'screenshot', 'get_element', 'get_table', 'get_links', 'list_clickable',
  'describe_form', 'ax_snapshot', 'wait', 'wait_for', 'extract_subtitles',
  'vision_read', 'vision_extract', 'capture_network', 'exec_js', 'exec_js_main',
  'number_elements', 'clear_numbers', 'hover',
]);

export const EXPLORE_TOOLS = [
  'search_web', 'read_current_page', 'read_tab', 'read_many', 'manage_tabs',
  'list_feeds', 'query_feed_items', 'fetch_entry', 'fetch_feed_item', 'fetch_feed_items',
  'refresh_feeds',
  'fetch_video_transcript', 'interact_page',
  // 工作区：读页自动落库，子代理也能按锚点回读 / 检索已读材料
  'ingest', 'read_section', 'search_workspace',
  'call_api',
];

export const BROWSER_TOOLS = [
  'browser_act', 'interact_page', 'read_current_page', 'read_tab', 'read_many', 'manage_tabs',
  'search_web', 'fetch_video_transcript',
];

export function isExploreInteractAllowed(action) {
  return EXPLORE_INTERACT_ALLOW.has(String(action || ''));
}
