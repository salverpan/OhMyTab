/* 统一操作日志冒烟（node test/activity-smoke.mjs）。内存版 chrome.storage + 内存版活动后端。 */

import assert from 'node:assert';

const store = {};
globalThis.chrome = {
  storage: {
    local: {
      async get(k) { return typeof k === 'string' ? { [k]: store[k] } : { ...store }; },
      async set(obj) { Object.assign(store, JSON.parse(JSON.stringify(obj))); },
      async remove(k) { delete store[k]; },
    },
    sync: { async get() { return {}; }, async set() {}, async remove() {} },
  },
  runtime: { getURL: (p) => `chrome-extension://test/${p}`, onMessage: { addListener() {} } },
  alarms: { async clear() {}, async get() { return null; }, create() {} },
};

const A = await import('../src/lib/activity-log.js');
A.__useMemoryBackend();
const { addNote, updateNote, removeNote } = await import('../src/lib/notebook.js');
const { saveEntry, updateEntry, deleteEntry, clearEntries } = await import('../src/lib/storage.js');
const { buildActivityStream } = await import('../src/lib/timeline-model.js');
const { activityHtml } = await import('../src/sidepanel/timeline-view.js');

let passed = 0;
function ok(cond, label) {
  assert.ok(cond, label);
  passed += 1;
}
const tick = () => new Promise((r) => setTimeout(r, 15));

// —— 摘要：不泄露 query / hash / 密钥，call_api 只留方法与主机路径 ——
const s1 = A.summarizeToolArgs('read_tab', { url: 'https://a.com/p?token=SECRET#frag', tab_id: 7 });
ok(s1.includes('a.com/p') && !s1.includes('SECRET') && !s1.includes('frag'), 'URL 去掉 query/hash');
const s2 = A.summarizeToolArgs('call_api', {
  method: 'POST', url: 'https://api.x.com/v1/do?key=SECRET', headers: { Authorization: 'Bearer SECRET' }, body: '{"pw":"SECRET"}',
});
ok(s2 === 'POST api.x.com/v1/do', 'call_api 只留方法 + 主机路径');
ok(!A.summarizeToolArgs('interact_page', { text: 'x'.repeat(500) }).includes('x'.repeat(200)), '长文本被截断');
ok(A.summarizeToolArgs('notebook', { action: 'add', claim: '油价上涨', sources: ['u'] }) === 'add · 油价上涨', '嵌套对象不进摘要');

// —— 分类 / 结果判定 ——
ok(A.categoryOfTool('create_document') === 'file' && A.categoryOfTool('search_web') === 'web'
  && A.categoryOfTool('notebook') === 'note' && A.categoryOfTool('suggest_actions') === 'agent', '工具分类');
ok(A.classifyToolResult('参数错误：缺 url') === 'error' && A.classifyToolResult('{"error":"x"}') === 'error'
  && A.classifyToolResult('{"ok":true}') === 'ok' && A.classifyToolResult('一些正文') === 'ok', '结果成败判定');

// —— logToolCall：主 / 子代理归属，task 跳过 ——
const PID = 'p1';
const mainCtx = { projectId: PID };
const subCtx = Object.assign(Object.create(mainCtx), { subagentKind: 'explore', subagentOwner: 's_1' });
await A.logToolCall({ ctx: mainCtx, name: 'create_document', args: { title: '报告' }, result: 'ok', durationMs: 12 });
await A.logToolCall({ ctx: subCtx, name: 'read_tab', args: { url: 'https://b.com/x?a=1' }, result: '正文', durationMs: 30 });
await A.logToolCall({ ctx: subCtx, name: 'read_tab', args: { url: 'https://b.com/y' }, error: 'boom', durationMs: 5 });
ok((await A.logToolCall({ ctx: mainCtx, name: 'task', args: {}, result: 'x' })) === false, 'task 工具不重复记录');

let list = await A.listActivity(PID);
ok(list.length === 3, '三条工具事件入账');
ok(list.some((e) => e.actor === 'main' && e.cat === 'file' && e.detail === '报告'), '主代理文件操作');
const subEv = list.find((e) => e.actor === 'sub' && e.status === 'ok');
ok(subEv && subEv.actorName === 'explore' && subEv.actorId === 's_1' && subEv.detail === 'b.com/x', '子代理归属 + 脱敏 URL');
ok(list.some((e) => e.status === 'error' && e.detail.includes('boom')), '异常状态记 error');

// —— 分页 / 排序 ——
const base = Date.now();
for (let i = 0; i < 5; i++) {
  await A.logActivity({ projectId: 'p2', actor: 'user', cat: 'file', action: `a${i}`, label: `L${i}`, ts: base + i * 1000 });
}
const page1 = await A.listActivity('p2', { limit: 2 });
ok(page1.length === 2 && page1[0].action === 'a4' && page1[1].action === 'a3', '倒序 + limit');
const page2 = await A.listActivity('p2', { limit: 2, before: page1[1].ts });
ok(page2[0].action === 'a2' && page2.length === 2, 'before 翻页');
ok((await A.listActivity('p_none')).length === 0, '项目隔离');

// —— 修剪 / 清空 ——
await A.trimActivity('p2', 3);
ok((await A.countActivity('p2')) === 3, 'trim 保留最新 N 条');
ok((await A.listActivity('p2'))[0].action === 'a4', 'trim 丢最旧的');
await A.clearActivity('p2');
ok((await A.countActivity('p2')) === 0 && (await A.countActivity(PID)) === 3, 'clear 只清本项目');

// —— 业务钩子：笔记 / 文库 ——
await A.clearActivity(PID);
const n = await addNote(PID, { claim: '结论一', sources: ['https://e.com/1'], confidence: 'high' });
await updateNote(PID, n.note.id, { status: 'dropped' });
await removeNote(PID, n.note.id);
await saveEntry({ id: 'e1', originalTitle: '标题甲', format: 'pdf', url: 'https://e.com/1' }, PID);
await updateEntry('e1', { status: 'summarizing' }, PID);
await updateEntry('e1', { aiTitle: '新标题' }, PID);
await deleteEntry('e1', PID);
await clearEntries(PID);
await tick();
list = await A.listActivity(PID, { limit: 100 });
const actions = list.map((e) => e.action);
ok(['note.add', 'note.status', 'note.remove', 'entry.add', 'entry.update', 'entry.delete'].every((a) => actions.includes(a)), '笔记与文库变更都被记录');
ok(actions.filter((a) => a === 'entry.update').length === 1, '采集状态流转不记，只记标题等身份变更');
ok(!actions.includes('entry.clear'), '空文库清空不产生噪声');

// —— 活动流：过滤 + 折叠 ——
const t0 = 1_700_000_000_000;
const ev = (o) => ({ projectId: 'x', actorId: '', actorName: '', status: 'ok', durationMs: 0, ...o });
const raw = [
  ev({ ts: t0 + 1000, actor: 'main', cat: 'web', action: 'read_tab', label: '读取标签页', detail: 'a' }),
  ev({ ts: t0 + 5000, actor: 'main', cat: 'web', action: 'read_tab', label: '读取标签页', detail: 'b' }),
  ev({ ts: t0 + 9000, actor: 'main', cat: 'web', action: 'read_tab', label: '读取标签页', detail: 'c' }),
  ev({ ts: t0 + 12000, actor: 'sub', actorId: 's1', actorName: 'explore', cat: 'web', action: 'read_tab', label: '读取标签页' }),
  ev({ ts: t0 + 20000, actor: 'main', cat: 'file', action: 'create_document', label: '创建文档', detail: '报告' }),
  ev({ ts: t0 + 300000, actor: 'main', cat: 'web', action: 'read_tab', label: '读取标签页', detail: 'later' }),
  ev({ ts: t0 + 310000, actor: 'user', cat: 'file', action: 'export', label: '导出' }),
  ev({ ts: t0 + 400000, actor: 'sub', actorId: 's1', actorName: 'explore', cat: 'agent', action: 'subagent.start', label: '子代理开始' }),
  ev({ ts: t0 + 401000, actor: 'sub', actorId: 's1', actorName: 'explore', cat: 'agent', action: 'subagent.start', label: '子代理开始' }),
];
const all = buildActivityStream(raw);
ok(all.items[0].ts === t0 + 401000, '最新在前');
const folded = all.items.find((i) => i.action === 'read_tab' && i.actor === 'main' && i.count === 3);
ok(folded && folded.firstTs === t0 + 1000 && folded.ts === t0 + 9000, '同主体连续同操作折叠为 ×3，记录起止');
ok(all.items.filter((i) => i.action === 'read_tab' && i.actor === 'main').length === 2, '间隔过长的同类操作不折叠');
ok(all.items.filter((i) => i.action === 'subagent.start').length === 2, '生命周期事件不折叠');
ok(buildActivityStream(raw, { filter: 'sub' }).items.every((i) => i.actor === 'sub'), '子代理过滤');
ok(buildActivityStream(raw, { filter: 'file' }).items.every((i) => i.cat === 'file'), '文件过滤');
ok(buildActivityStream(raw, { filter: 'user' }).items.length === 1, '用户过滤');
const limited = buildActivityStream(raw, { limit: 2 });
ok(limited.items.length === 2 && limited.hidden === limited.matched - 2, '截断与 hidden 计数');

// —— 渲染：转义与折叠标记 ——
const evil = buildActivityStream([ev({ ts: t0, actor: 'sub', actorName: '<img onerror=x>', cat: 'web', action: 'a', label: '<b>x</b>', detail: '<script>1</script>' })]);
const html = activityHtml(evil, 'all');
ok(!html.includes('<script>') && !html.includes('<img onerror') && html.includes('&lt;script&gt;'), '活动流渲染转义 HTML');
ok(activityHtml(all, 'all').includes('×3'), '折叠计数渲染');
ok(activityHtml({ items: [], matched: 0, hidden: 0 }, 'all').includes('还没有操作记录'), '空状态');

console.log(`activity smoke passed: ${passed} assertions`);
