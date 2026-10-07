import JSZip from 'jszip';
import { aoaToXlsxBuffer } from '../src/lib/create-xlsx.js';
import * as xlsx from '../src/lib/doc-edit-xlsx.js';

const assert = (await import('node:assert')).strict;

const ab = await aoaToXlsxBuffer([['h1', 'h2'], ['v1', 3], ['', '=A2']], '数据');
await xlsx.initXlsxEditor(ab);

assert.deepEqual(xlsx.xlsxSheetNames(), ['数据']);
assert.ok(xlsx.xlsxText().includes('h1'), 'xlsxText has header');

const r1 = await xlsx.execXlsxTool('set_range', { range: 'A2', values: [['HELLO']] });
assert.ok(r1.ok, 'set_range: ' + JSON.stringify(r1));
assert.ok(xlsx.xlsxText().includes('HELLO'), 'set_range wrote');

const r2 = await xlsx.execXlsxTool('set_bold', { range: 'A1', bold: true });
assert.ok(r2.ok, 'set_bold');

const r3 = await xlsx.execXlsxTool('set_range', { range: 'C1', values: [['=SUM(B2)']] });
assert.ok(r3.ok, 'formula write');
assert.ok(xlsx.xlsxText().includes('=SUM(B2)'), 'formula stored as text');

const r4 = await xlsx.execXlsxTool('clear_range', { range: 'A2' });
assert.ok(r4.ok, 'clear_range');
assert.ok(!xlsx.xlsxText().includes('HELLO'), 'cleared');

const r5 = await xlsx.execXlsxTool('undo', {});
assert.ok(r5.ok, 'undo');
assert.ok(xlsx.xlsxText().includes('HELLO'), 'undo restored');

const out = await xlsx.exportXlsx();
const zip = await JSZip.loadAsync(out);
const sheet = await zip.file('xl/worksheets/sheet1.xml').async('string');
assert.ok(sheet.includes('HELLO'), 'exported sheet has cell');
assert.ok(sheet.includes('<f>SUM(B2)</f>') || sheet.includes('<f>SUM(B2)'), 'exported formula');

const r6 = await xlsx.execXlsxTool('append_row', {});
assert.ok(r6.ok, 'append_row');
const r7 = await xlsx.execXlsxTool('switch_sheet', { sheet: '不存在' });
assert.equal(r7.ok, false, 'missing sheet errors');

console.log('xlsx-headless-smoke passed');
