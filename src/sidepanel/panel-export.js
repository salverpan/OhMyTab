/** 工作区原件导出。JSON/Markdown/CSV 汇编统一由 workspace-view 负责。 */

import { getDocFile } from '../lib/doc-store.js';

const ORIGINAL_MIME = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  doc: 'application/msword',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv;charset=utf-8',
  md: 'text/markdown;charset=utf-8',
  txt: 'text/plain;charset=utf-8',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
};

function safeFilename(name, fallback = '未命名') {
  return String(name || fallback).replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').trim() || fallback;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function exportOriginalEntry(entry) {
  const format = String(entry?.format || '').toLowerCase();
  const docId = entry?.docId || entry?.id;
  const bytes = format && docId ? await getDocFile(docId).catch(() => null) : null;
  if (bytes) {
    let name = safeFilename(entry.fileName || entry.aiTitle || entry.originalTitle || '文档');
    if (!name.toLowerCase().endsWith(`.${format}`)) name += `.${format}`;
    downloadBlob(new Blob([bytes], { type: ORIGINAL_MIME[format] || 'application/octet-stream' }), name);
    return;
  }
  const title = entry?.aiTitle || entry?.originalTitle || entry?.fileName || '来源';
  const meta = [
    entry?.source && `来源: ${entry.source}`,
    entry?.url && `链接: ${entry.url}`,
    entry?.publishedAt && `日期: ${entry.publishedAt}`,
  ].filter(Boolean).join('\n');
  const body = `# ${title}\n\n${meta}${meta ? '\n\n' : ''}${entry?.fullText || entry?.aiSummary || ''}`;
  downloadBlob(new Blob([body], { type: 'text/markdown;charset=utf-8' }), `${safeFilename(title, '来源')}.md`);
}

export function createExportApi() {
  return {
    exportOriginalEntry,
    async exportOriginalEntries(entries) {
      for (const entry of (entries || []).filter((item) => item?.status === 'completed')) {
        await exportOriginalEntry(entry);
      }
    },
  };
}
