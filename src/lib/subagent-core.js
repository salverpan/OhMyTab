/**
 * 子代理纯逻辑（无 chrome / 无 chat-executor）。
 * 冒烟测试与运行时共用；派活循环在 subagent.js。
 */

import { CHAT_TOOLS } from './tools.js';
import { PARENT_ONLY_TOOLS, EXPLORE_TOOLS, BROWSER_TOOLS } from './subagent-policy.js';
import { reportForMain } from './task-report.js';

export const BUILTIN_AGENTS = [
  {
    name: 'explore',
    description:
      '只读调研。当需要多路检索、多源读全文、或检索会刷爆主对话时主动使用（不必等用户 @）。' +
      '不能点击/填表/入库/改文档。一次 search_web 或只读当前页不必用。',
    prompt:
      '你是只读调研子代理。目标：按父代理的任务搜集事实并交回结构化报告。\n' +
      '- 任务涉及订阅/RSS/信源/我订的：先 list_feeds / query_feed_items；用户要「最新」时先 refresh_feeds。本地订阅不够再 search_web。\n' +
      '- 其他调研优先 search_web 拿 URL，再用 manage_tabs(open) 开新标签（后台，不抢用户当前页）+ read_tab(tab_id) 读全文。\n' +
      '- 公开 HTTP API（含已保存的免费渠道）用 call_api GET；目录里有的优先 connector=名称。不要把密钥写进参数。写入/save 连接交给父代理。\n' +
      '- 任务结束会自动关掉你开过的页；读完也可立刻 manage_tabs(close, tab_id)。\n' +
      '- 禁止 click/type/采集/写库/编辑文档。不要 switch 用户正在看的标签。\n' +
      '- 完成后必须调用 submit_report；自然语言正文不算交回。不要向用户打招呼。',
    tools: [...EXPLORE_TOOLS],
  },
  {
    name: 'general',
    description:
      '通用多步。当一条支线需要搜索+入库/写文档时主动使用。不能再派 task。' +
      '不要并行多个 general 抢同一个标签页。',
    prompt:
      '你是通用子代理，负责一条完整支线直到交付。\n' +
      '- 需要写库/点页面时自己做完，不要把脏活推回父代理。\n' +
      '- 点页面默认 browser_act（先 observe 或直接按已有编号表 click/type）。不要 number_elements。点不动再用 interact_page。\n' +
      '- 优先开自己的标签（manage_tabs open，后台），避免抢用户正在看的页；任务结束自动 close。\n' +
      '- 完成后必须调用 submit_report：操作结果写 actions，事实写带证据的 claims。不要向用户打招呼。',
    tools: '*',
  },
  {
    name: 'browser',
    description:
      '页面自动化。当需要点击/填表/翻页抽取/过反爬时主动使用。纯搜索用 explore。' +
      '不要并行多个 browser 操作同一标签。',
    prompt:
      '你是页面自动化子代理。目标：在真实标签页上完成父代理交代的操作并交回结果。\n' +
      '- 默认只用 browser_act：系统会先给你一张视口控件表；每步 click/type/select/scroll/wait/navigate 后自动返回新表。\n' +
      '- click/type/select 只能用表里的编号。不要 number_elements，不要发明 CSS/坐标/JS。\n' +
      '- 字段已经是目标值就不要再填。TYPE 之后若出现建议列表，再 click 对应建议。\n' +
      '- 需要的控件不在视口里：scroll_down/up。页面还在加载：wait。证据已可见：submit_report。\n' +
      '- 连续失败或表为空/反爬：再改用 interact_page 的 cdp_click / vision_find / capture_network / exec_js_main。\n' +
      '- 能后台操作就传 tab_id，不要 switch 用户正在看的标签。\n' +
      '- 完成后必须调用 submit_report：操作写 actions（带 URL/可见字段当前值），事实写带证据 claims。不要向用户打招呼。',
    tools: [...BROWSER_TOOLS],
  },
];

export const AGENT_NAME_RE = /^[a-z][a-z0-9-]{0,31}$/;

export function parseAgentMentions(text, agentNames) {
  const allow = new Set((agentNames || []).map((n) => String(n).toLowerCase()));
  const found = [];
  const re = /@([a-z][a-z0-9-]{0,31})\b/gi;
  let m;
  while ((m = re.exec(String(text || '')))) {
    const name = m[1].toLowerCase();
    if (allow.has(name) && !found.includes(name)) found.push(name);
  }
  return found;
}

/**
 * @param {object} input
 * @param {string[]} [existingNames] 已占用名称（编辑时应排除自己当前那条）
 */
export function validateCustomAgent(input, existingNames = []) {
  const name = String((input && input.name) || '').trim().toLowerCase();
  if (!AGENT_NAME_RE.test(name)) return '名称须为小写字母开头、仅含 a-z 0-9 连字符，最长 32。';
  if (BUILTIN_AGENTS.some((a) => a.name === name)) return `「${name}」是内置类型，请换一个名字。`;
  if (existingNames.includes(name)) return `名称 ${name} 已存在。`;
  const description = String((input && input.description) || '').trim();
  if (!description) return '需要 description（父代理靠它决定何时委派）。';
  const prompt = String((input && input.prompt) || '').trim();
  if (!prompt) return '需要 prompt（子代理自己的系统说明）。';
  const tools = (input && input.tools) || ['*'];
  if (!Array.isArray(tools) || tools.length === 0) return 'tools 须为非空数组，或 ["*"] 表示除父级专属外全部。';
  return null;
}

export function formatAgentCatalog(agents) {
  return (agents || []).map((a) => `- ${a.name}: ${a.description}`).join('\n');
}

function resolveAllowlist(agent) {
  if (!agent) return new Set();
  if (agent.tools === '*' || (Array.isArray(agent.tools) && agent.tools.includes('*'))) return '*';
  return new Set((agent.tools || []).map(String));
}

export function filterToolsForAgent(agent, allTools = CHAT_TOOLS) {
  const allow = resolveAllowlist(agent);
  return (allTools || []).filter((t) => {
    const n = t && t.function && t.function.name;
    if (!n || PARENT_ONLY_TOOLS.has(n)) return false;
    if (allow === '*') return true;
    return allow.has(n);
  });
}

export function allowedToolNames(agent, allTools = CHAT_TOOLS) {
  return new Set(filterToolsForAgent(agent, allTools).map((t) => t.function.name));
}

export function formatTaskResult({ id, type, state, summary, text, report, verification }) {
  return JSON.stringify({
    task_id: String(id || ''),
    type: String(type || ''),
    state: String(state || 'error'),
    summary: String(summary || ''),
    ...(text ? { message: String(text) } : {}),
    ...(report ? { report: reportForMain(report) } : {}),
    ...(verification ? { verification } : {}),
  });
}

export function revisionRequestFor(verification) {
  const failures = (verification?.claims || [])
    .filter((claim) => ['citation-fail', 'overclaim', 'source-conflict', 'source-unverified'].includes(claim.verdict)
      && !claim.infrastructureError)
    .map((claim) => ({ id: claim.id, error: claim.verdict }));
  return [
    '[RUNTIME-CHECK-REVISION]',
    '只修正下列失败 claim；不要改写已通过项。完成后重新调用 submit_report。',
    JSON.stringify(failures),
  ].join('\n');
}

export function serializeSubagentSessions(map) {
  if (!map || typeof map.values !== 'function') return [];
  return [...map.values()].slice(-12).map((s) => ({
    id: s.id,
    type: s.type,
    description: s.description,
    messages: Array.isArray(s.messages) ? s.messages.slice(-40) : [],
    report: s.report || null,
    verification: s.verification || null,
    revisionCount: Number(s.revisionCount) || 0,
    updatedAt: s.updatedAt || Date.now(),
  }));
}

export function restoreSubagentSessions(arr) {
  const map = new Map();
  for (const s of arr || []) {
    if (!s || !s.id) continue;
    map.set(s.id, {
      id: s.id,
      type: s.type,
      description: s.description || '',
      messages: Array.isArray(s.messages) ? s.messages : [],
      report: s.report || null,
      verification: s.verification || null,
      revisionCount: Number(s.revisionCount) || 0,
      updatedAt: s.updatedAt || Date.now(),
      card: {
        id: s.id,
        type: s.type,
        description: s.description || '',
        status: 'idle',
        steps: [],
        background: false,
      },
    });
  }
  return map;
}
