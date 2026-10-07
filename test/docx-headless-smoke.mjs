import JSZip from 'jszip';
import * as word from '../src/lib/doc-edit-word.js';

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const CT = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const assert = (await import('node:assert')).strict;

function docxWith(text) {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', CT + `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`);
  zip.file('_rels/.rels', CT + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
  zip.file('word/_rels/document.xml.rels', CT + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`);
  zip.file('word/document.xml', CT + `<w:document xmlns:w="${W}"><w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:body></w:document>`);
  return zip.generateAsync({ type: 'arraybuffer' });
}

const ab = await docxWith('hello world, this is the first paragraph.');
await word.initWordEditor(null, ab); // 无头模式（SW 同款）

// 1) 修订替换（track_changes 语义）：产生 w:ins/w:del + 批注
const r1 = await word.execReviewTool('suggest_replace', { find: 'hello', replacement: 'HELLO', note: '统一大小写' });
assert.ok(r1.ok, 'suggest_replace ok: ' + JSON.stringify(r1));
assert.equal(word.pendingReviewCount(), 1, '应有 1 条待处理修订');

// 2) settings.xml 注入 trackChanges（Word 打开修订模式直接开启）
const out1 = await word.exportWordDocx();
const zip1 = await JSZip.loadAsync(out1);
const settings = await zip1.file('word/settings.xml').async('string');
assert.ok(settings.includes('<w:trackChanges/>'), 'settings.xml 必须含 trackChanges: ' + settings);
const docXml = await zip1.file('word/document.xml').async('string');
assert.ok(docXml.includes('<w:ins '), 'document.xml 必须含 w:ins');
assert.ok(docXml.includes('<w:del '), 'document.xml 必须含 w:del');
const comments = await zip1.file('word/comments.xml').async('string');
assert.ok(comments.includes('统一大小写'), 'comments.xml 必须含批注 note');

// 3) 直接修改（track_changes=false 语义）：无修订痕迹
const r2 = await word.execWordTool('replace_text', { find: 'world', replace: 'WORLD' });
assert.ok(r2.ok, 'replace_text ok');
const out2 = await word.exportWordDocx();
const zip2 = await JSZip.loadAsync(out2);
const docXml2 = await zip2.file('word/document.xml').async('string');
assert.ok(docXml2.includes('WORLD'), '直接替换生效');

// 4) undo 回滚
const r3 = await word.execWordTool('undo', {});
assert.ok(r3.ok, 'undo ok');
const out3 = await word.exportWordDocx();
const zip3 = await JSZip.loadAsync(out3);
const docXml3 = await zip3.file('word/document.xml').async('string');
assert.ok(docXml3.includes('world') && !docXml3.includes('WORLD'), 'undo 后 world 还原');

// 5) accept 修订
const r4 = await word.execReviewTool('accept', { id: 'all' });
assert.ok(r4.ok, 'accept all ok');
assert.equal(word.pendingReviewCount(), 0, '接受后无待处理');
const out4 = await word.exportWordDocx();
const zip4 = await JSZip.loadAsync(out4);
const docXml4 = await zip4.file('word/document.xml').async('string');
assert.ok(docXml4.includes('HELLO') && !docXml4.includes('<w:del '), 'accept 后 HELLO 落定、无删除痕迹');

// 6) wordText 全文
const text = word.wordText();
assert.ok(text.includes('HELLO') && text.includes('first paragraph'), 'wordText 反映最终内容');

// 7) 修订编号稳定性（Bug 2 回归）：accept-all 后 0 条，+2 条插入，id 稳定互异
const zero = word.listReviewItems();
assert.equal(zero.length, 0, 'accept-all 后应无待处理修订');
await word.execReviewTool('suggest_insert', { text: '第二条补充条款', note: 'n2' });
await word.execReviewTool('suggest_insert', { text: '第三条补充条款', note: 'n3' });
const listA = word.listReviewItems();
assert.equal(listA.length, 2, '应有 2 条修订');
const idsA = listA.map((r) => r.id);
assert.equal(new Set(idsA).size, 2, 'id 必须互不相同: ' + JSON.stringify(idsA));
// 拒绝中间那条（用它的稳定 id）：只删它，其余 id 不变
const mid = listA.find((r) => r.replacement.includes('第二条'));
const rj = await word.execReviewTool('reject', { id: mid.id });
assert.ok(rj.ok && Array.isArray(rj.processed) && rj.processed.length === 1, 'reject 必须回显 processed: ' + JSON.stringify(rj));
assert.equal(rj.processed[0].id, mid.id, 'processed 回显 id 一致');
assert.ok(rj.processed[0].replacement.includes('第二条'), 'processed 回显内容一致');
const listB = word.listReviewItems();
assert.equal(listB.length, 1, '拒绝后剩 1 条');
const idsB = listB.map((r) => r.id);
assert.ok(!idsB.includes(mid.id), '被拒修订的 id 消失');
assert.ok(idsA.filter((id) => id !== mid.id).every((id) => idsB.includes(id)), '其余修订 id 不变: ' + JSON.stringify(idsB));

// 8) 待审修订内 find 守卫（建议 B）：对处于 pending 插入中的文本再次 replace 必须拒绝
const guard1 = await word.execWordTool('replace_text', { find: '第三条补充条款', replace: '不应成功' });
assert.ok(!guard1.ok && guard1.error.includes('待审修订'), '对 pending 插入文本 replace 必须拒绝: ' + JSON.stringify(guard1));
const guard2 = await word.execReviewTool('suggest_replace', { find: '第三条补充条款', replacement: 'X' });
assert.ok(!guard2.ok && guard2.error.includes('待审修订'), '对 pending 文本 suggest_replace 必须拒绝: ' + JSON.stringify(guard2));
// 而"first paragraph"（无修订）仍可正常直接替换
const guard3 = await word.execWordTool('replace_text', { find: 'first paragraph', replace: 'first PARAGRAPH' });
assert.ok(guard3.ok, '无修订文本直接替换应成功: ' + JSON.stringify(guard3));

// 9) 嵌套修订痕迹修复（Word 拒开修复）：del 内嵌 ins、ins 内嵌 del 必须被拍平
const nestedDoc = await (async () => {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', CT + `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`);
  zip.file('_rels/.rels', CT + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
  zip.file('word/_rels/document.xml.rels', CT + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`);
  // 非法结构：w:del 内嵌 w:ins（ins 里的 w:t 必须被转成 delText 提升）
  zip.file('word/document.xml', CT + `<w:document xmlns:w="${W}"><w:body><w:p><w:del w:id="1" w:author="Citecat AI"><w:r><w:ins w:id="2" w:author="Citecat AI"><w:t>坏</w:t></w:ins></w:r></w:del></w:p></w:body></w:document>`);
  return zip.generateAsync({ type: 'arraybuffer' });
})();
await word.initWordEditor(null, nestedDoc);
assert.ok(word.wasRevisionSanitized(), '嵌套痕迹必须被标记为已修复');
const fixedAb = await word.exportWordDocx();
const fixedZip = await JSZip.loadAsync(fixedAb);
const fixedXml = await fixedZip.file('word/document.xml').async('string');
assert.ok(!/<w:del[^>]*>[\s\S]*?<w:ins/.test(fixedXml) && !/<w:ins[^>]*>[\s\S]*?<w:del/.test(fixedXml), '导出后不得存在嵌套 ins/del');
assert.ok(!/<w:del[^>]*>[\s\S]*?<w:t>/.test(fixedXml), 'del 内不得残留 w:t（必须 delText）');
assert.ok(fixedXml.includes('<w:delText'), 'del 内文本应为 delText');

// 10) 修改痕迹（对话里的修改卡）：写操作必须回带 {op, location, before, after}
await word.initWordEditor(null, await docxWith('第一段正文。第二段正文。'));
const e1 = await word.execWordTool('replace_text', { find: '第一段正文', replace: '首段正文' });
assert.ok(e1.ok && Array.isArray(e1.edits) && e1.edits.length === 1, 'replace_text 必须回带 edits: ' + JSON.stringify(e1));
assert.equal(e1.edits[0].op, 'replace', 'op=replace');
assert.equal(e1.edits[0].before, '第一段正文', 'before=改前原文');
assert.equal(e1.edits[0].after, '首段正文', 'after=改后文本');
assert.ok(/^第 \d+ 段$/.test(e1.edits[0].location), 'location 为段落定位: ' + e1.edits[0].location);

const e2 = await word.execWordTool('set_bold', { find: '首段正文', bold: true });
assert.ok(e2.ok && e2.edits && e2.edits[0].op === 'format' && e2.edits[0].note === '加粗', 'set_bold 记为格式痕迹: ' + JSON.stringify(e2));

const e3 = await word.execWordTool('insert_text', { text: '新增段落' });
assert.ok(e3.ok && e3.edits && e3.edits[0].op === 'insert' && e3.edits[0].after === '新增段落' && e3.edits[0].location === '文末', 'insert_text 记为新增: ' + JSON.stringify(e3));

const e4 = await word.execWordTool('add_table', { rows: 2, cols: 3 });
assert.ok(e4.ok && e4.edits && e4.edits[0].op === 'table' && e4.edits[0].after === '2×3 表格', 'add_table 记为表格: ' + JSON.stringify(e4));

const e5 = await word.execReviewTool('suggest_replace', { find: '新增段落', replacement: '补充段落', note: '改写' });
assert.ok(e5.ok && e5.edits && e5.edits[0].op === 'replace' && e5.edits[0].before === '新增段落' && e5.edits[0].after === '补充段落', 'suggest_replace 带痕迹: ' + JSON.stringify(e5));

const eBad = await word.execWordTool('replace_text', { find: '不存在的文本xyz', replace: 'x' });
assert.ok(!eBad.ok && !eBad.edits, '失败操作不得带 edits');
// 痕迹缓冲按次清空：失败操作后紧接的成功操作只带自己那一条
const e6 = await word.execWordTool('replace_text', { find: '第二段正文', replace: '次段正文' });
assert.ok(e6.ok && e6.edits && e6.edits.length === 1 && e6.edits[0].before === '第二段正文', '每次操作痕迹独立: ' + JSON.stringify(e6.edits));

console.log('docx 无头引擎链路（修订/直接改/undo/accept/设置注入/稳定 id/reject 回显/待审守卫/嵌套修复/修改痕迹）: ALL PASS');
