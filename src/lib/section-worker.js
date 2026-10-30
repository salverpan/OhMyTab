/**
 * 无状态章节 Worker。它不是可续传 Agent：运行时先回读指定来源片段，再让模型
 * 通过 submit_report 提交结构化抽取；不暴露浏览器、写入或委派工具。
 */

import { streamChatWithTools } from './ai-client.js';
import { getArtifact, readSection } from './artifact-store.js';
import { isCitationEligibleArtifact } from './source-model.js';
import { SUBMIT_REPORT_TOOL, validateTaskReport } from './task-report.js';
import {
  SECTION_WORKER_MAX_CHARS, SECTION_WORKER_MAX_ROUNDS, SECTION_WORKER_TIMEOUT_MS,
} from './limits.js';
import { emitUsage } from './usage.js';

export const SECTION_JOB_TOOL = {
  type: 'function',
  function: {
    name: 'section_job',
    description:
      '把已经进入来源库的长文档片段交给无状态章节 Worker 抽取。仅在单篇 PDF/长文超出当前上下文时使用；可在同一轮并行多个不同章节。返回带逐字引文的结构化 claims。'
      + `单次最多读 ${SECTION_WORKER_MAX_CHARS} 字。结果里 content_has_more=true 时，用相同 doc_id 与 goal，只传 offset=content_next_offset 再调，直到 content_has_more=false。这是分页，不是文件上限。`,
    parameters: {
      type: 'object',
      properties: {
        doc_id: { type: 'string' },
        chunk: { type: 'number', description: '块号，0 起。续拉时不要传。' },
        page: { type: 'number', description: 'PDF 页码，1 起。续拉时不要传。' },
        offset: { type: 'number', description: '字符偏移。续拉时传上一次的 content_next_offset。' },
        max_chars: { type: 'number', description: `单次分页大小，默认且不超过 ${SECTION_WORKER_MAX_CHARS}。` },
        goal: { type: 'string', description: '本章节要找什么；必须具体。续拉时保持不变。' },
      },
      required: ['doc_id', 'goal'],
    },
  },
};

/** 把 readSection 的分页字段收成与 read_tab 相同的续拉游标。 */
export function sectionJobCursor(section = {}) {
  const hasMore = !!section.has_more && section.next_offset != null;
  const cursor = {
    content_returned: Number(section.chars) || String(section.text || '').length,
    content_has_more: hasMore,
  };
  if (Number.isFinite(Number(section.offset))) cursor.content_offset = Number(section.offset);
  if (Number.isFinite(Number(section.total))) cursor.content_total = Number(section.total);
  if (hasMore) cursor.content_next_offset = section.next_offset;
  return cursor;
}

function withCursor(payload, section) {
  const cursor = sectionJobCursor(section);
  const body = { ...payload, ...cursor };
  if (cursor.content_has_more) {
    body.hint = '正文未读完。用相同 doc_id 和 goal，只传 offset=content_next_offset 再调用 section_job，直到 content_has_more=false。';
  }
  return JSON.stringify(body);
}

function assistantToolMessage(result) {
  return {
    role: 'assistant',
    content: result.content || null,
    tool_calls: (result.toolCalls || []).map((tc) => ({
      id: tc.id,
      type: 'function',
      function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
    })),
  };
}

export async function runSectionJob(args = {}, ctx = {}) {
  if (!ctx.subagentKind) return JSON.stringify({ ok: false, error: 'section_job 只能由 Sub 调用。' });
  const docId = String(args.doc_id || '').trim();
  const goal = String(args.goal || '').trim();
  if (!docId || !goal) return JSON.stringify({ ok: false, error: 'section_job 需要 doc_id 和具体 goal。' });

  const doc = await getArtifact(docId);
  const pid = String(ctx.projectId || 'default');
  if (!doc || String(doc.projectId || 'default') !== pid) {
    return JSON.stringify({ ok: false, error: `当前项目找不到来源 ${docId}。` });
  }
  if (!isCitationEligibleArtifact(doc)) {
    return JSON.stringify({ ok: false, error: `${docId} 不是可核验来源；AI 产出、自由文本和 derived 材料不能派章节作业。` });
  }

  const pageSize = Math.min(SECTION_WORKER_MAX_CHARS, Math.max(1000, Number(args.max_chars) || SECTION_WORKER_MAX_CHARS));
  // 续拉偏移优先：否则带着上一次的 page/chunk 会从该页开头重读，游标失效。
  const continuing = Number(args.offset) > 0;
  const section = await readSection(docId, continuing ? {
    offset: args.offset,
    maxChars: pageSize,
  } : {
    chunk: args.chunk,
    page: args.page,
    offset: args.offset,
    maxChars: pageSize,
  });
  if (section.error) return JSON.stringify({ ok: false, error: section.error });

  const apiCfg = ctx.apiConfig;
  if (!apiCfg || !apiCfg.apiKey) return JSON.stringify({ ok: false, error: '章节 Worker 没有可用 API。' });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SECTION_WORKER_TIMEOUT_MS);
  const parentSignal = ctx.subagentParentSignal;
  const onAbort = () => controller.abort();
  if (parentSignal) {
    if (parentSignal.aborted) controller.abort();
    else parentSignal.addEventListener('abort', onAbort, { once: true });
  }

  const messages = [
    {
      role: 'system',
      content:
        '你是 OhMyTab 的无状态章节抽取 Worker。只处理给定原文，不得使用外部知识。'
        + '完成时必须调用 submit_report：actions=[]；每条 claim 的 evidence 必须使用系统给定 doc_id、anchor，并从原文逐字复制 quote。'
        + '每条 claim 写 attribution（原文里最初说这话的主体）与 modality；当事方说法用 claimed、转述用 reported，不要写成 confirmed。'
        + '原文没有直接支持的内容放 unresolved。给你的原文可能只是文件中的一段，只抽取这一段，不要声称文件到此结束。不要输出长篇正文。',
    },
    {
      role: 'user',
      content: `目标：${goal}\n来源：${docId}\n锚点：${section.anchor}\n\n--- 原文 ---\n${section.text}`,
    },
  ];

  try {
    for (let round = 0; round < SECTION_WORKER_MAX_ROUNDS; round++) {
      const result = await streamChatWithTools(messages, [SUBMIT_REPORT_TOOL], apiCfg, () => {}, controller.signal);
      emitUsage(ctx, result.usage);
      const submit = (result.toolCalls || []).find((tc) => tc.name === 'submit_report');
      if (submit) {
        const checked = validateTaskReport(submit.arguments);
        if (!checked.error) {
          return withCursor({
            ok: true,
            doc_id: docId,
            anchor: section.anchor,
            report: checked.report,
          }, section);
        }
        messages.push(assistantToolMessage(result));
        messages.push({ role: 'tool', tool_call_id: submit.id, content: JSON.stringify({ ok: false, error: checked.error }) });
        continue;
      }
      messages.push({ role: 'assistant', content: result.content || '' });
      messages.push({ role: 'user', content: '[RUNTIME] 必须调用 submit_report 提交；不要输出自然语言报告。' });
    }
    return withCursor({ ok: false, error: '章节 Worker 未提交结构化结果。', doc_id: docId, anchor: section.anchor }, section);
  } catch (error) {
    const timeout = controller.signal.aborted && !(parentSignal && parentSignal.aborted);
    return withCursor({
      ok: false,
      error: timeout ? '章节 Worker 超时。' : (error.message || String(error)),
      doc_id: docId,
      anchor: section.anchor,
    }, section);
  } finally {
    clearTimeout(timer);
    if (parentSignal) parentSignal.removeEventListener('abort', onAbort);
  }
}
