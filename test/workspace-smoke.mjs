/* 工作区 / 笔记本纯逻辑冒烟（node test/workspace-smoke.mjs）。不碰 indexedDB / chrome.*。 */

import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { splitChunks, makeDocId } from '../src/lib/artifact-store.js';
import {
  normalizeSource, formatSource, normalizeConfidence, normalizeStatus,
  formatNoteLine, formatNotebookDigest,
} from '../src/lib/notebook.js';
import {
  inferEntryType, normalizeEntryRecord, inferArtifactProvenance, isCitationEligibleArtifact,
} from '../src/lib/source-model.js';
import { migrateEntryArrays, WORKSPACE_SCHEMA_VERSION } from '../src/lib/workspace-migration.js';
import { artifactMatchesEntry, noteReferencesEntry } from '../src/lib/entry-cascade.js';
import {
  normalizePlanItems, planStats, formatPlanDigest, planCardHtml,
  MAX_ITEM_CHARS, MAX_PLAN_ITEMS,
} from '../src/lib/plan.js';
import {
  makeEdit, makeEditsCard, mergeEditsCard, mergeEditsIntoList,
  formatEditsForModel, docEditsCardHtml, docEditsListHtml, EDIT_PREVIEW_CHARS,
} from '../src/lib/doc-edits.js';

let passed = 0;
function ok(cond, label) {
  assert.ok(cond, label);
  passed += 1;
}

// —— 结构切块：标题另起块、偏移能切回原文 ——
const src = [
  '# 第一章 总则',
  '这是第一段内容。'.repeat(20),
  '',
  '## 1.1 适用范围',
  '这是第二段内容。'.repeat(20),
].join('\n');
const chunks = splitChunks(src);
ok(chunks.length >= 2, '标题分段成多块');
ok(chunks[0].heading.includes('第一章'), '首块挂到一级标题');
ok(src.slice(chunks[0].start, chunks[0].end).startsWith('# 第一章'), '偏移可切回原文');
ok(chunks.every((c) => c.text.length > 0), '没有空块');

// —— 超长单段按句末回退切 ——
const long = '句子内容。'.repeat(600);
const cs = splitChunks(long);
ok(cs.length >= 2 && cs.every((c) => c.text.length <= 1600), '超长段被切分');
ok(cs.map((c) => c.text).join('').replace(/\s/g, '') === long.replace(/\s/g, ''), '切分不丢字');

// —— docId 稳定 ——
const id1 = await makeDocId({ url: 'https://a.com/x' });
const id2 = await makeDocId({ url: 'https://a.com/x' });
const id3 = await makeDocId({ url: 'https://a.com/y' });
ok(id1 === id2 && id1 !== id3 && id1.startsWith('doc_'), 'docId 按 URL 稳定');
const projectId1 = await makeDocId({ url: 'https://a.com/x', projectId: 'p1' });
const projectId2 = await makeDocId({ url: 'https://a.com/x', projectId: 'p2' });
ok(projectId1 !== projectId2 && projectId1 !== id1, 'docId 按项目隔离');

// —— 出处归一化 ——
ok(normalizeSource('doc_ab12#c3').doc_id === 'doc_ab12' && normalizeSource('doc_ab12#c3').anchor === 'c3', 'doc_id#锚点');
ok(normalizeSource('https://a.com').url === 'https://a.com', 'URL 出处');
ok(normalizeSource('见附录').note === '见附录', '描述性出处');
ok(formatSource({ doc_id: 'doc_1', anchor: 'p2' }) === 'doc_1#p2', '出处回写');

// —— 枚举归一化 ——
ok(normalizeConfidence('HIGH') === 'high' && normalizeConfidence('xx') === 'medium', '置信度归一化');
ok(normalizeStatus('verified') === 'verified' && normalizeStatus('') === 'open', '状态归一化');

// —— 笔记本摘要 ——
const notes = [
  { claim: 'A 成立', confidence: 'high', status: 'verified', sources: [{ doc_id: 'doc_1', anchor: 'c0' }] },
  { claim: 'B 待查', confidence: 'low', status: 'open', sources: [{ url: 'https://b.com' }] },
];
const digest = formatNotebookDigest(notes);
ok(digest.includes('2 条') && digest.includes('A 成立') && digest.includes('doc_1#c0'), '摘要含条数与出处');
ok(formatNotebookDigest([]) === '', '空笔记本不注入');
ok(formatNoteLine(notes[0]).includes('已核实'), '行格式含状态');

// —— 三主干分类与幂等迁移 ——
ok(WORKSPACE_SCHEMA_VERSION === 2, '工作区 schema v2');
ok(inferEntryType({ source: 'AI 生成' }) === 'output', '旧 AI 条目迁为产出');
ok(inferEntryType({ source: 'Reuters' }) === 'source', '出版方条目迁为来源');
const migrated = normalizeEntryRecord({ id: 'e1', source: 'Reuters', url: 'https://reuters.com/x', createdAt: 1 });
ok(migrated.entryType === 'source' && migrated.provenance.publisher === 'Reuters', 'Entry provenance');
const twice = normalizeEntryRecord(migrated);
ok(JSON.stringify(twice) === JSON.stringify(migrated), 'Entry 迁移幂等');
const arrays = migrateEntryArrays({ entries_p1: [{ id: 'x', source: 'AI 生成' }], other: [] });
ok(arrays.entries_p1[0].entryType === 'output' && !arrays.other, '只迁移 entries_*');

const sourceArtifact = { kind: 'page', url: 'https://a.com', chars: 10 };
const derivedArtifact = { kind: 'text', chars: 10 };
ok(inferArtifactProvenance(sourceArtifact).trustClass === 'source', '网页 artifact 是来源');
ok(isCitationEligibleArtifact(sourceArtifact), '来源 artifact 可引用');
ok(!isCitationEligibleArtifact(derivedArtifact), '自由文本不可作为合格证据');
ok(artifactMatchesEntry({ docId: 'd1' }, { id: 'e1', docId: 'd1' }), '级联按 docId 匹配 artifact');
ok(artifactMatchesEntry({ sourceEntryId: 'e1' }, { id: 'e1' }), '级联按 sourceEntryId 匹配 artifact');
ok(noteReferencesEntry({ sources: [{ doc_id: 'd1', anchor: 'c0' }] }, { id: 'e1' }, ['d1']), '级联识别笔记引用');

const sidepanelHtml = readFileSync(new URL('../src/sidepanel/index.html', import.meta.url), 'utf8');
ok(sidepanelHtml.includes('工作区三主干') && sidepanelHtml.includes('搜索来源、笔记、产出'), 'UI 使用三主干术语');
ok(!/id="(?:entryList|entrySearchInput|wsViewSwitchBtn)"/.test(sidepanelHtml), '旧工作区入口已删除');

// —— 任务清单（plan）：归一化 / 统计 / 前言摘要 / 卡片 ——
ok(normalizePlanItems([' A ', '', { text: 'B', status: 'doing' }]).length === 2, '清单丢弃空项');
const normPlan = normalizePlanItems([{ text: '  一步  任务 ', status: 'DONE' }, '两步']);
ok(normPlan[0].text === '一步 任务' && normPlan[0].status === 'done', '清单文本压空白 + 状态归一');
ok(normalizePlanItems([{ text: 'x', status: 'bogus' }])[0].status === 'todo', '非法状态回落 todo');
ok(normalizePlanItems([{ text: 'y'.repeat(500) }])[0].text.length === MAX_ITEM_CHARS, '单条超长截断到上限');
ok(normalizePlanItems(Array.from({ length: 50 }, (_, i) => 'i' + i)).length === MAX_PLAN_ITEMS, '清单条数封顶');

const plan = { items: [
  { text: '拉数据', status: 'done' },
  { text: '核对口径', status: 'doing' },
  { text: '写结论', status: 'todo' },
], updatedAt: 1 };
const st = planStats(plan);
ok(st.total === 3 && st.done === 1 && st.doing === 1 && !st.allDone, 'planStats 计数正确');
const planBlock = formatPlanDigest(plan);
ok(planBlock.includes('1/3') && planBlock.includes('[→] 核对口径') && planBlock.includes('未完成 2 项'), '前言清单块含进度与催促');
ok(formatPlanDigest({ items: [] }) === '', '空清单不注入前言');
ok(formatPlanDigest({ items: [{ text: 'a', status: 'done' }] }).includes('清空'), '全部完成时提示收尾');
const planCard = planCardHtml(plan, 'chat');
ok(planCard.includes('chat-plan-item is-doing') && planCard.includes('核对口径'), '清单卡渲染进行中项');
ok(planCard.includes('33%'), '清单卡进度条按完成比例');
const doneCard = planCardHtml({ items: [{ text: 'a', status: 'done' }] }, 'chat');
ok(doneCard.includes('is-done') && !doneCard.includes(' open>'), '全部完成时卡片收起');
ok(planCardHtml({ items: [] }, 'chat') === '', '空清单不出卡片');

// —— 修改痕迹卡（doc_edits）——
const editRec = makeEdit({ op: 'replace', location: '第 3 段', before: '甲', after: '乙' });
ok(editRec.op === 'replace' && editRec.location === '第 3 段' && editRec.before === '甲' && editRec.after === '乙', 'makeEdit 保留痕迹字段');
ok(makeEdit({ op: 'replace', before: 'x'.repeat(999) }).before.length === EDIT_PREVIEW_CHARS + 1, '单侧文本截断（带省略号）');
const card1 = makeEditsCard({ doc_id: 'doc_1', doc_name: '报告.docx', tool: 'replace_text', edits: [editRec] });
ok(card1.id === 'doc_1' && card1.edits.length === 1, 'makeEditsCard 以 doc_id 为卡标识');
ok(makeEditsCard({ edits: [] }) === null, '空痕迹不出卡');
const card2 = makeEditsCard({ doc_id: 'doc_1', edits: [makeEdit({ op: 'insert', after: '丙' })] });
const merged = mergeEditsCard(card1, card2);
ok(merged.edits.length === 2 && merged.edits[1].op === 'insert', '同文档多次编辑合并进一张卡');
ok(mergeEditsCard(card1, makeEditsCard({ doc_id: 'doc_2', edits: [editRec] })).id === 'doc_2', '不同文档不合并');
ok(mergeEditsIntoList([card1], card2)[0].edits.length === 2, 'mergeEditsIntoList 同文档就地累加');
const modelText = formatEditsForModel(card1);
ok(modelText.includes('报告.docx') && modelText.includes('甲」→「乙'), '回喂模型的自证摘要含文档名与改前改后');
ok(formatEditsForModel(null) === '', '无卡不回喂');
const diffHtml = docEditsCardHtml(card1, 'chat');
ok(diffHtml.includes('chat-diff-line is-del') && diffHtml.includes('chat-diff-line is-add'), '修改卡有减/加两行');
ok(diffHtml.includes('1 处修改') && diffHtml.includes('修订留痕'), '修改卡头含处数与修订标签');
const escHtml = docEditsCardHtml(makeEditsCard({ doc_id: 'd', doc_name: '<x>', edits: [makeEdit({ before: '<b>&' })] }), 'chat');
ok(escHtml.includes('&lt;x&gt;') && escHtml.includes('&lt;b&gt;&amp;'), '修改卡转义 HTML');
ok(docEditsListHtml([], 'chat') === '' && docEditsListHtml([card1], 'chat').includes('chat-diffs'), '消息级列表渲染');

console.log(`workspace-smoke: ${passed} ok`);
