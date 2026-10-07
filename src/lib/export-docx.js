import {
  Document, Packer, Paragraph, TextRun,
  AlignmentType, ExternalHyperlink, LineRuleType,
} from 'docx';
import JSZip from 'jszip';
import {
  collectParaElements, replaceTextInElement,
  base64ToBuffer,
} from './template-parser.js';

const WML_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

/* ---- Public API: template-aware export ---- */

export async function exportSingleDocx(entry) {
  const tmpl = await getTemplate();
  if (tmpl) {
    return exportWithTemplate([entry], tmpl);
  }
  return exportLegacy([entry]);
}

export async function exportMultipleDocx(entries) {
  const tmpl = await getTemplate();
  if (tmpl) {
    return exportWithTemplate(entries, tmpl);
  }
  return exportLegacy(entries);
}

async function getTemplate() {
  const { exportTemplate } = await chrome.storage.local.get('exportTemplate');
  if (exportTemplate && exportTemplate.docxBase64) return exportTemplate;
  return null;
}

/* ---- Template-based export ---- */

async function exportWithTemplate(entries, templateData) {
  const { docxBase64, structure } = templateData;
  const { docLevel, entryBlock, separator } = structure;

  const buffer = base64ToBuffer(docxBase64);
  const zip = await JSZip.loadAsync(buffer);

  let docXml = await zip.file('word/document.xml')?.async('string');
  if (!docXml) throw new Error('模板中缺少 document.xml');

  const parser = new DOMParser();
  const doc = parser.parseFromString(docXml, 'application/xml');
  const body = doc.getElementsByTagNameNS(WML_NS, 'body')[0];

  const paraElements = collectParaElements(body);
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;

  // Replace doc-level placeholders
  for (const idx of docLevel) {
    const el = paraElements[idx];
    if (!el) continue;
    replaceTextInElement(el, {
      '{{DOC_TITLE}}': `采集信息：${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`,
      '{{DOC_SUBTITLE}}': '',
      '{{DOC_DATE}}': `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`,
    });
  }

  // Get entry block elements
  const entryElements = entryBlock.map((i) => paraElements[i]).filter(Boolean);

  // Get separator element
  let separatorEl = null;
  if (separator >= 0 && separator < paraElements.length) {
    separatorEl = paraElements[separator];
  }

  // Remove original entry paragraphs from body
  const nodesToRemove = new Set([...entryBlock]);
  if (separator >= 0) nodesToRemove.add(separator);
  for (const idx of [...nodesToRemove].sort((a, b) => b - a)) {
    const el = paraElements[idx];
    if (el?.parentNode) el.parentNode.removeChild(el);
  }

  // Find insertion reference (after last doc-level paragraph)
  const lastDocIdx = docLevel.length > 0 ? Math.max(...docLevel) : -1;
  let insertRef = null;
  if (lastDocIdx >= 0 && paraElements[lastDocIdx]?.nextSibling) {
    insertRef = paraElements[lastDocIdx].nextSibling;
  } else {
    insertRef = body.firstChild;
  }

  // Clone entry block for each entry and replace placeholders
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const sourceLine = formatSourceLine(entry, now);

    for (const el of entryElements) {
      const clone = el.cloneNode(true);
      const bodyText = entry._useFullText
        ? (entry.fullText || entry.aiSummary || '')
        : (entry.aiSummary || entry.fullText?.slice(0, 500) || '');
      replaceTextInElement(clone, {
        '{{ENTRY_NUMBER}}': String(i + 1),
        '{{ENTRY_SUMMARY}}': bodyText,
        '{{ENTRY_SOURCE}}': sourceLine,
        '{{ENTRY_LINK}}': entry.url || '',
      });
      body.insertBefore(clone, insertRef);
    }

    // Insert separator between entries (not after last)
    if (separatorEl && i < entries.length - 1) {
      body.insertBefore(separatorEl.cloneNode(true), insertRef);
    }
  }

  // Serialize and pack
  const newDocXml = new XMLSerializer().serializeToString(doc);
  zip.file('word/document.xml', newDocXml);

  const blob = await zip.generateAsync({ type: 'blob' });
  const ts = `${now.getFullYear()}${now.getMonth() + 1}${now.getDate()}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
  downloadBlob(blob, `采集报告_${ts}.docx`);
}

/* ---- Legacy programmatic export (fallback when no template) ---- */

const FS = (pt) => Math.round(pt * 2);
const SP = (pt) => Math.round(pt * 20);
const FONT_XBS = '方正小标宋_GBK';
const FONT_FS = '方正仿宋_GBK';
const FONT_TNR = 'Times New Roman';

async function exportLegacy(entries) {
  const doc = await buildLegacyDocument(entries);
  const blob = await Packer.toBlob(doc);
  const now = new Date();
  const ts = `${now.getFullYear()}${now.getMonth() + 1}${now.getDate()}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  downloadBlob(blob, `采集报告_${ts}.docx`);
}

async function buildLegacyDocument(entries) {
  const children = [];
  const now = new Date();
  const titleText = `采集信息：${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { line: SP(28), lineRule: LineRuleType.EXACTLY },
      children: [
        new TextRun({
          text: titleText,
          font: { ascii: FONT_TNR, hAnsi: FONT_TNR, eastAsia: FONT_XBS, cs: FONT_TNR },
          size: FS(20),
          bold: false,
        }),
      ],
    })
  );

  children.push(
    new Paragraph({
      spacing: { line: SP(28), lineRule: LineRuleType.EXACTLY },
      children: [],
    })
  );

  entries.forEach((entry, idx) => {
    const num = idx + 1;
    const sourceLine = formatSourceLine(entry, now);
    children.push(
      new Paragraph({
        spacing: { line: 360, lineRule: LineRuleType.AUTO },
        indent: { firstLine: SP(30) },
        alignment: AlignmentType.JUSTIFIED,
        children: [
          new TextRun({ text: `【${num}】`, font: { ascii: FONT_TNR, hAnsi: FONT_TNR, eastAsia: FONT_FS, cs: FONT_TNR }, size: FS(15), color: '0000FF', bold: false }),
          new TextRun({ text: (entry.aiTitle ? `${entry.aiTitle}。` : ''), font: { ascii: FONT_TNR, hAnsi: FONT_TNR, eastAsia: FONT_FS, cs: FONT_TNR }, size: FS(15), bold: true }),
          new TextRun({ text: entry._useFullText ? (entry.fullText || '') : (entry.aiSummary || ''), font: { ascii: FONT_TNR, hAnsi: FONT_TNR, eastAsia: FONT_FS, cs: FONT_TNR }, size: FS(15), bold: false }),
          new TextRun({
            text: `（${sourceLine}）`,
            font: { ascii: FONT_TNR, hAnsi: FONT_TNR, eastAsia: FONT_FS, cs: FONT_TNR },
            size: FS(15), bold: true,
          }),
        ],
      })
    );

    const linkText = entry.originalTitle || entry.aiTitle || entry.url;
    children.push(
      new Paragraph({
        spacing: { line: 360, lineRule: LineRuleType.AUTO },
        indent: { firstLine: SP(30) },
        children: [
          new TextRun({ text: '【链接】：', font: { ascii: FONT_TNR, hAnsi: FONT_TNR, eastAsia: FONT_FS, cs: FONT_TNR }, size: FS(15), bold: false }),
          new ExternalHyperlink({
            link: entry.url || '',
            children: [
              new TextRun({ text: linkText, font: { ascii: FONT_TNR, hAnsi: FONT_TNR, eastAsia: FONT_FS, cs: FONT_TNR }, size: FS(15), style: 'Hyperlink' }),
            ],
          }),
        ],
      })
    );

    if (idx < entries.length - 1) {
      children.push(
        new Paragraph({
          spacing: { line: 360, lineRule: LineRuleType.AUTO },
          children: [],
        })
      );
    }
  });

  return new Document({
    styles: {
      default: {
        document: {
          run: {
            font: { ascii: FONT_TNR, hAnsi: FONT_TNR, eastAsia: FONT_FS, cs: FONT_TNR },
            size: FS(15),
          },
        },
      },
    },
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1440, bottom: 1440, left: 1800, right: 1800 },
        },
      },
      children,
    }],
  });
}

/* ---- Shared utilities ---- */

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function formatSourceLine(entry, fallbackDate = new Date()) {
  const sourceDate = formatSourceDate(entry.publishedAt, fallbackDate);
  const sourceName = normalizeSourceName(entry.source) || '未知来源';
  return `${sourceDate} ${sourceName} 消息`.trim();
}

function formatSourceDate(raw, fallbackDate) {
  const d = parseDate(raw) || fallbackDate;
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

function parseDate(raw) {
  if (!raw) return null;
  const match = String(raw).match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (match) {
    const d = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function normalizeSourceName(source) {
  const s = String(source || '').trim();
  if (!s || /^(未知|无|不详|暂无|null|none|n\/a|tbd|unknown)$/i.test(s)) return '';
  return s.replace(/\s*(消息|报道|来源)\s*$/u, '');
}

function pad(n) { return String(n).padStart(2, '0'); }
