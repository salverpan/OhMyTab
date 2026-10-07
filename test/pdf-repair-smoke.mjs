/**
 * 文字识别层 PDF：xref/trailer 被增量更新写坏，流里又夹着假的 endobj/trailer。
 * pdf.js 应拒绝原文件；重建交叉引用表后能打开，并抽出文字层。
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { deflateSync } from 'node:zlib';
import { openPdfJsDocument, repairPdfStructure } from '../src/lib/pdf-repair.js';

const require = createRequire(import.meta.url);
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(
  require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs'),
).href;

const ascii = new TextEncoder();

function concat(chunks) {
  const list = chunks.map((c) => (typeof c === 'string' ? ascii.encode(c) : c));
  const len = list.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(len);
  let at = 0;
  for (const c of list) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

function buildPdf(objects, rootNum) {
  const chunks = ['%PDF-1.4\n'];
  let len = chunks[0].length;
  const offs = new Map();
  let max = 0;
  for (const obj of objects) {
    max = Math.max(max, obj.num);
    const gen = obj.gen || 0;
    const body = typeof obj.body === 'string' ? ascii.encode(obj.body) : obj.body;
    const head = ascii.encode(`${obj.num} ${gen} obj\n`);
    const tail = ascii.encode(body.length && body[body.length - 1] === 10 ? 'endobj\n' : '\nendobj\n');
    offs.set(obj.num, len);
    chunks.push(head, body, tail);
    len += head.length + body.length + tail.length;
  }
  const xrefAt = len;
  let xref = `xref\n0 ${max + 1}\n0000000000 65535 f \n`;
  for (let n = 1; n <= max; n++) {
    const off = offs.get(n);
    xref += off == null
      ? '0000000000 00000 f \n'
      : String(off).padStart(10, '0') + ' 00000 n \n';
  }
  chunks.push(xref);
  chunks.push(`trailer\n<< /Size ${max + 1} /Root ${rootNum} 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`);
  return concat(chunks);
}

/** 砍掉 xref/trailer，模拟增量更新写到一半。 */
function dropTrailer(bytes) {
  const s = new TextDecoder('latin1').decode(bytes);
  const at = s.lastIndexOf('\nxref\n');
  assert.ok(at > 0, 'fixture has xref');
  return concat([bytes.subarray(0, at + 1), 'startxref\n0\n%%EOF\n']);
}

function pageObjects(streamExtra = '') {
  const text = `BT /F1 12 Tf 36 100 Td (Hello OCR) Tj ET\n${streamExtra}`;
  return [
    { num: 1, body: '<< /Type /Catalog /Pages 2 0 R >>\n' },
    { num: 2, body: '<< /Type /Pages /Count 1 /Kids [3 0 R] >>\n' },
    { num: 3, body: '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\n' },
    { num: 4, body: `<< /Length ${ascii.encode(text).length} >>\nstream\n${text}endstream\n` },
    { num: 5, body: '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\n' },
  ];
}

function objStmObjects() {
  const body1 = '<< /Type /Catalog /Pages 2 0 R >>\n';
  const body2 = '<< /Type /Pages /Count 1 /Kids [3 0 R] >>\n';
  const off2 = ascii.encode(body1).length;
  const header = `1 0 2 ${off2}\n`;
  const payload = ascii.encode(header + body1 + body2);
  const compressed = deflateSync(payload);
  const text = 'BT /F1 12 Tf 36 100 Td (Hello OCR) Tj ET\n';
  const stm = `<< /Type /ObjStm /N 2 /First ${ascii.encode(header).length} /Filter /FlateDecode /Length ${compressed.length} >>\nstream\n`;
  return [
    {
      num: 10,
      body: concat([stm, compressed, 'endstream\n']),
    },
    { num: 3, body: '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\n' },
    { num: 4, body: `<< /Length ${ascii.encode(text).length} >>\nstream\n${text}endstream\n` },
    { num: 5, body: '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\n' },
  ];
}

async function readText(data) {
  const pdf = await pdfjs.getDocument({ data: data.slice(), verbosity: 0 }).promise;
  let text = '';
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const tc = await page.getTextContent();
    text += tc.items.map((item) => item.str || '').join('');
  }
  return { pages: pdf.numPages, text };
}

async function expectRejected(data) {
  await assert.rejects(
    () => pdfjs.getDocument({ data: data.slice(), verbosity: 0 }).promise,
    (err) => String(err?.message || '').includes('Invalid PDF structure'),
  );
}

const valid = buildPdf(pageObjects(), 1);
const opened = await readText(valid);
assert.equal(opened.pages, 1);
assert.ok(opened.text.includes('Hello OCR'), 'valid pdf text: ' + opened.text);

const quiet = { documentParams: { verbosity: 0 } };
const viaOpen = await openPdfJsDocument(pdfjs, valid, quiet);
assert.equal(viaOpen.repaired, false);
assert.equal(viaOpen.pdf.numPages, 1);

const rebuilt = await repairPdfStructure(valid);
assert.ok(rebuilt, 'healthy file can be rewritten');
const rebuiltText = await readText(rebuilt);
assert.equal(rebuiltText.pages, 1);
assert.ok(rebuiltText.text.includes('Hello OCR'), 'rewritten text: ' + rebuiltText.text);

const truncated = dropTrailer(valid);
await expectRejected(truncated);
const fixedTrunc = await openPdfJsDocument(pdfjs, truncated, quiet);
assert.equal(fixedTrunc.repaired, true);
assert.equal(fixedTrunc.pdf.numPages, 1);
{
  const page = await fixedTrunc.pdf.getPage(1);
  const tc = await page.getTextContent();
  const text = tc.items.map((item) => item.str || '').join('');
  assert.ok(text.includes('Hello OCR'), 'truncated repair text: ' + text);
}

const fake = 'endobj\n1 0 obj\n<< /Type /Catalog /Pages 9 0 R >>\nendobj\ntrailer\n<< /Root 9 0 R >>\n';
const layered = dropTrailer(buildPdf(pageObjects(fake), 1));
await expectRejected(layered);
const fixedLayer = await openPdfJsDocument(pdfjs, layered, quiet);
assert.equal(fixedLayer.repaired, true);
assert.equal(fixedLayer.pdf.numPages, 1);
{
  const page = await fixedLayer.pdf.getPage(1);
  const tc = await page.getTextContent();
  const text = tc.items.map((item) => item.str || '').join('');
  assert.ok(text.includes('Hello OCR'), 'text-layer repair text: ' + text);
}

const compressed = dropTrailer(buildPdf(objStmObjects(), 1));
await expectRejected(compressed);
const fixedStm = await openPdfJsDocument(pdfjs, compressed, quiet);
assert.equal(fixedStm.repaired, true);
assert.equal(fixedStm.pdf.numPages, 1);
{
  const page = await fixedStm.pdf.getPage(1);
  const tc = await page.getTextContent();
  const text = tc.items.map((item) => item.str || '').join('');
  assert.ok(text.includes('Hello OCR'), 'objstm repair text: ' + text);
}

assert.equal(await repairPdfStructure(ascii.encode('not a pdf')), null);
assert.equal(await repairPdfStructure(new Uint8Array(0)), null);

console.log('pdf-repair-smoke ok');
