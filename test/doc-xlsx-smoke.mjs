import { aoaToXlsxBuffer, structuredDataToAoa, parseTableContent, colName, colFromName, parseA1Range, rowsFromCreateDocumentArgs } from '../src/lib/create-xlsx.js';
import { markdownToDocxBuffer, markdownToBodyXml } from '../src/lib/create-docx.js';
import { extractRtfText, extractLegacyDocText } from '../src/lib/legacy-doc.js';
import { kindOfName, sniffOfficeBuffer, resolveKind, isUploadDocName } from '../src/lib/doc-kind.js';
import JSZip from 'jszip';

const assert = (cond, msg) => {
  if (!cond) { console.error('FAIL: ' + msg); process.exitCode = 1; }
  else console.log('ok: ' + msg);
};

assert(kindOfName('a.doc') === 'doc', 'kindOfName .doc');
assert(kindOfName('a.docx') === 'docx', 'kindOfName .docx');
assert(kindOfName('a.XLS') === 'xlsx', 'kindOfName .xls -> xlsx');
assert(kindOfName('notes.MD') === 'md', 'kindOfName .md');
assert(kindOfName('readme.markdown') === 'md', 'kindOfName .markdown');
assert(kindOfName('a.txt') === 'txt', 'kindOfName .txt');
assert(isUploadDocName('a.pdf') && isUploadDocName('a.docx') && isUploadDocName('a.xlsx'), 'upload allows pdf/docx/xlsx');
assert(isUploadDocName('a.csv') && isUploadDocName('a.md'), 'upload allows csv/md');
assert(!isUploadDocName('a.doc') && !isUploadDocName('a.xls') && !isUploadDocName('a.txt'), 'upload rejects doc/xls/txt');
assert(!isUploadDocName('readme.markdown') && !isUploadDocName('a.gif'), 'upload rejects markdown/gif');
assert(colName(0) === 'A' && colName(25) === 'Z' && colName(26) === 'AA', 'colName');
assert(colFromName('A') === 0 && colFromName('Z') === 25 && colFromName('AA') === 26, 'colFromName');
assert(parseA1Range('B2:C5').r1 === 1 && parseA1Range('B2:C5').c2 === 2, 'parseA1Range');

const zipMagic = new Uint8Array([0x50, 0x4B, 0x03, 0x04, 0, 0, 0, 0]);
assert(sniffOfficeBuffer(zipMagic.buffer) === 'zip', 'sniff zip');
assert(resolveKind('report.doc', zipMagic.buffer) === 'docx', '.doc that is zip -> docx');

const rtf = "{\\rtf1\\ansi Hello \\u19990\\'3f\\u30028\\'3f world}";
const rtfText = extractRtfText(rtf);
assert(rtfText.includes('Hello') && rtfText.includes('world'), 'rtf ascii');
assert(rtfText.includes('世') && rtfText.includes('界'), 'rtf unicode');

const hello = 'Citecat 旧版 Word 文档提取测试句子一二三';
const utf16 = new Uint8Array(hello.length * 2);
for (let i = 0; i < hello.length; i++) {
  utf16[i * 2] = hello.charCodeAt(i) & 0xFF;
  utf16[i * 2 + 1] = hello.charCodeAt(i) >> 8;
}
const heur = extractLegacyDocText(utf16.buffer);
assert(heur.includes('Citecat') && heur.includes('测试'), 'heuristic utf16 from non-OLE');

const md = parseTableContent('| a | b |\n| --- | --- |\n| 1 | 2 |');
assert(md.length === 2 && md[0][0] === 'a' && md[1][1] === '2', 'parse markdown table');

const aoa = structuredDataToAoa([{ name: '甲', n: 2 }, { name: '乙', n: 3 }]);
assert(aoa[0].join(',') === 'name,n' && aoa[1][0] === '甲', 'structured_data to aoa');

const built = rowsFromCreateDocumentArgs({ structured_data: [{ x: 1, y: 2 }], content: '' });
assert(built.aoa.length === 2 && built.fullText.includes('x,y'), 'rowsFromCreateDocumentArgs');

const ab = await aoaToXlsxBuffer([['h1', 'h2'], ['v1', 3], ['', '=A2']], '数据');
const zip = await JSZip.loadAsync(ab);
const sheet = await zip.file('xl/worksheets/sheet1.xml').async('string');
const book = await zip.file('xl/workbook.xml').async('string');
assert(sheet.includes('inlineStr') && sheet.includes('h1'), 'xlsx has header cell');
assert(sheet.includes('<v>3</v>'), 'xlsx number cell');
assert(sheet.includes('<f>A2</f>'), 'xlsx formula cell');
assert(book.includes('数据'), 'xlsx sheet name');

const body = markdownToBodyXml('# 标题\n\n**粗体** 与表格\n\n| a | b |\n| --- | --- |\n| 1 | 2 |\n');
assert(body.includes('Heading1') && body.includes('<w:b/>') && body.includes('<w:tbl>'), 'markdown body xml');
const docxAb = await markdownToDocxBuffer('# Hello\n\nworld', { title: '' });
const docxZip = await JSZip.loadAsync(docxAb);
assert(!!docxZip.file('word/document.xml'), 'docx has document part');
const docXml = await docxZip.file('word/document.xml').async('string');
assert(docXml.includes('Hello') && docXml.includes('world'), 'docx body text');

if (process.exitCode) console.error('doc-xlsx-smoke failed');
else console.log('doc-xlsx-smoke passed');
