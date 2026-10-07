/* 子代理纯逻辑冒烟（node test/subagent-smoke.mjs）。不碰 chrome.*。 */

import assert from 'node:assert';
import {
  filterToolsForAgent, parseAgentMentions, formatTaskResult,
  validateCustomAgent, BUILTIN_AGENTS, formatAgentCatalog, serializeSubagentSessions,
  restoreSubagentSessions, allowedToolNames, revisionRequestFor,
} from '../src/lib/subagent-core.js';
import { isExploreInteractAllowed, PARENT_ONLY_TOOLS } from '../src/lib/subagent-policy.js';
import { subagentCardHtml } from '../src/lib/subagent-ui.js';
import { CHAT_TOOLS, buildChatTools } from '../src/lib/tools.js';
import { SUBAGENT_MAX_PARALLEL, SUBAGENT_MAX_DEPTH, SUBAGENT_MAX_TABS, clampSubagentMaxParallel, clampSubagentMaxTabs } from '../src/lib/limits.js';
import { commitRoundToolTranscript } from '../src/lib/tool-round-messages.js';
import { convertMessages as antConvert } from '../src/lib/providers/anthropic-messages.js';

let passed = 0;
function ok(cond, label) {
  assert.ok(cond, label);
  passed += 1;
}

ok(BUILTIN_AGENTS.map((a) => a.name).join(',') === 'explore,general,browser', '内置三类');
ok(SUBAGENT_MAX_PARALLEL === 3 && SUBAGENT_MAX_DEPTH === 1 && SUBAGENT_MAX_TABS === 6, '并行/深度/标签常量');
ok(clampSubagentMaxParallel(0) === 1 && clampSubagentMaxParallel(99) === 12 && clampSubagentMaxParallel('5') === 5, '并行上限钳制');
ok(clampSubagentMaxTabs(0) === 1 && clampSubagentMaxTabs(99) === 20 && clampSubagentMaxTabs('8') === 8, '标签上限钳制');

const names = CHAT_TOOLS.map((t) => t.function.name);
ok(names.includes('task'), 'CHAT_TOOLS 含 task');
ok(names.includes('ask_research_scope'), 'CHAT_TOOLS 含 ask_research_scope');
ok(names.includes('plot_chart'), 'CHAT_TOOLS 含 plot_chart');
ok(names.includes('refresh_feeds'), 'CHAT_TOOLS 含 refresh_feeds');
ok(names.includes('call_api'), 'CHAT_TOOLS 含 call_api');
ok(names.includes('browser_act'), 'CHAT_TOOLS 含 browser_act');
ok(names.includes('plan'), 'CHAT_TOOLS 含 plan');
ok(names.length === 38, '38 个工具');
ok(buildChatTools(BUILTIN_AGENTS).some((t) => t.function.name === 'task' && /explore/.test(t.function.description)), 'buildChatTools 注入类型列表');
ok(/最多 3/.test(buildChatTools(BUILTIN_AGENTS).find((t) => t.function.name === 'task').function.description), 'task 描述默认并行上限');
ok(/最多 5/.test(buildChatTools(BUILTIN_AGENTS, { maxParallel: 5 }).find((t) => t.function.name === 'task').function.description), 'task 描述写入自定义并行上限');
const taskDesc = CHAT_TOOLS.find((t) => t.function.name === 'task').function.description;
ok(!/不要夹杂/.test(taskDesc) && /必须用/.test(taskDesc), 'task 描述允许夹杂并正向委派');
ok(/主动使用/.test(BUILTIN_AGENTS[0].description), 'explore description 写何时主动用');
ok(/自动关/.test(BUILTIN_AGENTS[0].prompt), 'explore 承诺任务结束关标签');
const longText = 'x'.repeat(40000);
const longResult = formatTaskResult({ id: 'sg_2', type: 'explore', state: 'completed', summary: 's', text: longText });
ok(JSON.parse(longResult).message === longText, '运行时结果使用结构化 JSON');

const runCard = subagentCardHtml({ id: 'sg_r', type: 'explore', description: 'd', status: 'running', prompt: '查 A 和 B', report: '部分结论' }, 'chat');
ok(/ open>/.test(runCard) && runCard.includes('任务书') && runCard.includes('查 A 和 B') && runCard.includes('部分结论'), '运行中卡片展开且含任务书+返回');
const doneCard = subagentCardHtml({ id: 'sg_d', type: 'explore', description: 'd', status: 'completed', prompt: 'p', report: 'r' }, 'chat');
ok(!/ open>/.test(doneCard) && doneCard.includes('r'), '结束的卡片默认收起但保留返回内容');

const exploreTools = filterToolsForAgent(BUILTIN_AGENTS[0], CHAT_TOOLS).map((t) => t.function.name);
ok(!exploreTools.includes('task'), 'explore 无 task');
ok(!exploreTools.includes('collect_content'), 'explore 无采集');
ok(exploreTools.includes('search_web') && exploreTools.includes('read_tab'), 'explore 有搜索/读页');
ok(exploreTools.includes('read_section') && exploreTools.includes('search_workspace'), 'explore 可用工作区回读/检索');
ok(exploreTools.includes('refresh_feeds') && exploreTools.includes('query_feed_items'), 'explore 可查/刷新 RSS');
ok(/query_feed_items/.test(BUILTIN_AGENTS[0].prompt), 'explore 提示词 RSS 优先');
ok(!exploreTools.includes('notebook'), 'explore 不能写笔记本（父级专属）');
ok(!exploreTools.includes('plot_chart'), 'explore 不能画图');
ok(exploreTools.includes('call_api'), 'explore 可只读调 API');

const generalTools = filterToolsForAgent(BUILTIN_AGENTS[1], CHAT_TOOLS).map((t) => t.function.name);
ok(!generalTools.includes('task') && generalTools.includes('create_document'), 'general 可写库但不能套娃');
ok(!generalTools.includes('save_memory'), 'general 不能 save_memory');
ok(PARENT_ONLY_TOOLS.has('suggest_actions'), '父级专属含 suggest_actions');
ok(PARENT_ONLY_TOOLS.has('ask_research_scope'), '父级专属含 ask_research_scope');
ok(PARENT_ONLY_TOOLS.has('save_memory'), '父级专属含 save_memory');
ok(PARENT_ONLY_TOOLS.has('plot_chart'), '父级专属含 plot_chart');

const browserTools = filterToolsForAgent(BUILTIN_AGENTS[2], CHAT_TOOLS).map((t) => t.function.name);
ok(browserTools.includes('browser_act') && browserTools.includes('interact_page') && !browserTools.includes('collect_content'), 'browser 默认可 browser_act，逃生口 interact_page，不能入库');
ok(!exploreTools.includes('browser_act'), 'explore 不能 browser_act');
ok(/browser_act/.test(BUILTIN_AGENTS[2].prompt), 'browser 提示词走紧循环');
ok(/browser_act/.test(BUILTIN_AGENTS[1].prompt), 'general 提示词默认 browser_act');
ok(isExploreInteractAllowed('navigate') && isExploreInteractAllowed('screenshot'), 'explore 可读页动作');
ok(!isExploreInteractAllowed('click_number') && !isExploreInteractAllowed('type'), 'explore 不能点/填');

ok(parseAgentMentions('请 @explore 和 @general 分头查', ['explore', 'general', 'browser']).join(',') === 'explore,general', '@mention 解析');
ok(parseAgentMentions('email@x.com 不是 mention', ['explore']).length === 0, '邮箱不算 mention');

const envelope = JSON.parse(formatTaskResult({ id: 'sg_1', type: 'explore', state: 'completed', summary: '调研', text: '结论' }));
ok(envelope.state === 'completed' && envelope.task_id === 'sg_1' && envelope.message === '结论', 'task 结果 JSON');

ok(validateCustomAgent({ name: 'Explore', description: 'x', prompt: 'y' }) , '与内置重名被拒');
ok(validateCustomAgent({ name: 'reviewer', description: '审稿', prompt: '你是审稿人' }) === null, '合法自定义');
ok(!!validateCustomAgent({ name: '1bad', description: 'x', prompt: 'y' }), '非法名称');
ok(!!validateCustomAgent({ name: 'reviewer', description: 'x', prompt: 'y' }, ['reviewer']), '与已有自定义重名被拒');
ok(validateCustomAgent({ name: 'reviewer', description: 'x', prompt: 'y' }, []) === null, '编辑自己不误拦');

const customTools = allowedToolNames({ name: 'reviewer', tools: ['search_web', 'task', 'read_tab'] });
ok(customTools.has('search_web') && customTools.has('read_tab') && !customTools.has('task'), '自定义白名单剔除父级专属');
ok(!allowedToolNames({ name: 'reviewer', tools: '*' }).has('save_memory'), '自定义 * 也不能 save_memory');

ok(formatAgentCatalog(BUILTIN_AGENTS).includes('- explore:'), '目录文本');

const map = restoreSubagentSessions([{ id: 'sg_a', type: 'explore', description: 'd', messages: [{ role: 'user', content: 'hi' }] }]);
ok(map.get('sg_a') && map.get('sg_a').messages.length === 1, '会话恢复');
ok(serializeSubagentSessions(map)[0].id === 'sg_a', '会话序列化');

const revisionPrompt = revisionRequestFor({
  claims: [
    { id: 'bad-cite', verdict: 'citation-fail', infrastructureError: false, reason: '不应泄漏' },
    { id: 'api', verdict: 'source-unverified', infrastructureError: true },
    { id: 'good', verdict: 'entailment-pass', infrastructureError: false },
  ],
});
ok(revisionPrompt.includes('bad-cite') && revisionPrompt.includes('citation-fail'), '修正请求包含失败 claim id 与类型');
ok(!revisionPrompt.includes('api') && !revisionPrompt.includes('good') && !revisionPrompt.includes('不应泄漏'), '修正请求不含基础设施失败和多余内容');

const assistantTc = {
  role: 'assistant', content: null,
  tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'search_web', arguments: '{"q":"x"}' } }],
};
const toolApi = { role: 'tool', tool_call_id: 'call_1', content: 'full' };
const toolHist = { role: 'tool', tool_call_id: 'call_1', content: 'trunc' };

const shared = [{ role: 'user', content: 'go' }];
commitRoundToolTranscript(shared, shared, assistantTc, [{ api: toolApi, history: toolHist }]);
ok(shared.filter((m) => m.role === 'assistant').length === 1, '同一数组 assistant 只落一次');
ok(shared.filter((m) => m.role === 'tool').length === 1, '同一数组 tool 只落一次');
ok(shared.find((m) => m.role === 'tool').content === 'full', '同一数组保留 API 全文');

const ant = antConvert(shared);
const antAsst = ant.messages.filter((m) => m.role === 'assistant');
const antUser = ant.messages.filter((m) => m.role === 'user');
ok(antAsst.length === 1 && antAsst[0].content.some((b) => b.type === 'tool_use' && b.id === 'call_1'), 'Anthropic 一条 tool_use');
ok(antUser.some((m) => Array.isArray(m.content) && m.content.some((b) => b.type === 'tool_result' && b.tool_use_id === 'call_1')), 'Anthropic 紧随 tool_result');

const apiArr = [{ role: 'user', content: 'go' }];
const histArr = [{ role: 'user', content: 'go' }];
commitRoundToolTranscript(apiArr, histArr, assistantTc, [{ api: toolApi, history: toolHist }]);
ok(apiArr.length === 3 && histArr.length === 3 && histArr[2].content === 'trunc', '分数组时历史可截断');

console.log(`subagent-smoke: ${passed} ok`);
