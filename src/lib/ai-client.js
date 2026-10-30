const PROMPT_TEMPLATE = `你是新闻资料采集助手。请从网页正文和来源URL中提取结构化元数据。

只输出一个合法 JSON 对象，不要输出解释、Markdown 或代码块。

来源URL：
{{url}}

页面元数据候选发布日期：
{{candidateDate}}

内容：
{{fullText}}

输出格式（注意：所有引号必须是英文直引号 " ，不要用中文全角引号）：
{
  "title": "简洁标题（≤30字）",
  "source": "媒体或机构正式名称",
  "sourceTier": "high | medium | low",
  "sourceTierReason": "一句话说明信源等级判断依据",
  "summary": "200字左右摘要，原文较短时可酌情减少；只提炼核心事实，不虚构内容，涉及到公司、概念的，需要进行简短的解释",
  "tags": ["标签1", "标签2", "标签3"],
  "date": "YYYY-MM-DD 或 null",
  "tagMerges": [["待合并标签", "规范标签"]]
}

规则：
- title 和 summary 只基于正文内容，不虚构；summary 约200字，原文较短时可酌情减少；涉及公司、概念时需要简短解释。
- source 必须是媒体、机构或发布方的正式名称，不能输出 URL、完整域名、频道路径或站点缩写碎片。
- 如果正文没有明确来源名，必须根据来源URL的主域名推断站点品牌名：去掉 www、国家/通用顶级域名和频道路径，把主域名转成可读品牌名；例如 dronefirms.com 输出"Drone Firms"，uasweekly.com 输出"UAS Weekly"，armyrecognition.com 输出"Army Recognition"。
- source 示例：international.caixin.com 输出"财新国际"；caixin.com 输出"财新"；news.qq.com 输出"腾讯新闻"；xinhuanet.com 输出"新华网"；reuters.com 输出"Reuters"；apnews.com 输出"AP News"。
- 只有当正文和来源URL都无法判断正式来源时，source 才返回 null。
- sourceTier 表示信源可靠程度，只能是 high、medium、low：
  - high：政府/军方/监管机构/官方公告、上市公司或机构官网、一线通讯社、长期可信的主流媒体或高声誉专业防务媒体。
  - medium：有明确站点身份的行业媒体、区域媒体、垂直博客、企业新闻稿转载站，信息可参考但需交叉验证。
  - low：来源身份不清、聚合/搬运站、论坛/社媒、营销软文站、匿名站点，或 source 为 null。
- sourceTierReason 用一句话说明判断依据，不要超过30字。
- date 是该内容的网页发布日期，不是采集日期，也不是事件发生日期、图片拍摄日期、会议日期、报告数据日期或电文地点后的日期。
- 页面元数据候选发布日期通常来自网页 time/meta/结构化数据，优先视为网页发布日期；如果没有其它明确"发布时间/发布日期/Published/Updated"字段，date 应返回该候选日期。
- 正文中的"6月20日""20日发布""新华社某地6月20日电"、图片说明日期、机构报告日期，只能作为事件时间，不能覆盖页面元数据候选发布日期。
- 只有当正文或元数据中明确出现文章级发布时间/发布日期/更新时间（如"发布时间""发布日期""Published""Updated"）且与候选日期冲突时，才返回这个更明确的文章级日期。
- 如果没有页面元数据候选发布日期，也找不到明确文章级发布日期，date 返回 null。
- tags 1-3个，每标签≤6字。{{recommendedTags}}
- tagMerges 是可选字段，用于合并推荐标签列表中含义相同的标签。如果你发现推荐列表中同时存在含义相同但名称不同的标签（如"UAV"和"无人机"），请在此数组中列出需要合并的配对，格式为 [["待合并的标签名", "保留的规范标签名"], ...]。每对的前者将被合并到后者。如果不需要合并，可省略此字段或返回空数组 []。`;

import { chatComplete, chatStream } from './providers/index.js';
import { isRetryableNetworkError, withNetworkRetry } from './net-retry.js';

export { PROMPT_TEMPLATE };

function buildRecommendedTags(recommendedTags) {
  if (!recommendedTags || recommendedTags.length === 0) {
    return '优先从以下选取：无人机、UAV、反无人机、俄乌、乌克兰、俄罗斯、中东、伊朗、台海、南海、朝鲜、AI、人工智能、eVTOL、飞行汽车、低空经济、空域管理、适航审定、通航、政策法规、供应链、制裁、出口管制、雷达、电子战、侦察、打击、蜂群、自主导航、反制';
  }
  return `优先从以下标签中选取（避免使用同义变体）：${JSON.stringify(recommendedTags)}`;
}

export async function summarizeText(fullText, apiConfig, url = '', candidateDate = '', recommendedTags = []) {
  const template = PROMPT_TEMPLATE;
  let prompt = template.replace('{{fullText}}', fullText);
  prompt = prompt.replace('{{url}}', url || '未知');
  prompt = prompt.replace('{{candidateDate}}', candidateDate || '未提取到');
  prompt = prompt.replace('{{recommendedTags}}', buildRecommendedTags(recommendedTags));
  if (url && !template.includes('{{url}}')) {
    prompt = `来源URL：${url}\n` + prompt;
  }
  if (!/(source|来源)/i.test(template)) {
    prompt += '\n\n请在JSON中额外返回 "source" 字段，值必须是媒体或机构正式名称，不能是URL或域名；无法判断则为 null。';
  }
  // 部分兼容 OpenAI 的 API 要求 prompt 必须包含 "json" 才能启用 response_format
  if (!/json/i.test(prompt)) {
    prompt = 'Output JSON.\n' + prompt;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    console.debug('[OhMyTab] summarizeText ->', apiConfig.model,
      `fullText ${fullText.length} chars, prompt ${prompt.length} chars`);
    const { content, usage } = await chatComplete(apiConfig, [{ role: 'user', content: prompt }], {
      temperature: 0.3,
      // 严格 JSON 输出（OpenAI/DeepSeek/GLM 均支持；上面已确保 prompt 含 "json"）
      responseFormat: { type: 'json_object' },
      // 个别 OpenAI 兼容服务不支持 response_format 会报 400：去掉该字段重试一次
      retryWithoutResponseFormat: true,
      signal: controller.signal,
    });
    if (!content) {
      throw new Error('AI 返回内容为空');
    }
    const result = parseAiResponse(content);
    result.usage = usage;
    return result;
  } finally {
    clearTimeout(timeout);
  }
}

const TAG_BLACKLIST = /^(日期|时间|来源|作者|未知|无|不详|暂无|none|unknown|n\/a|tbd)$/i;

function cleanTags(tags) {
  return (tags || [])
    .map(t => String(t).trim())
    .filter(t => t.length > 0 && t.length <= 10 && !TAG_BLACKLIST.test(t) && !/[:：]/.test(t))
    .slice(0, 3);
}

function cleanTagMerges(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(pair => Array.isArray(pair) && pair.length === 2)
    .map(([from, to]) => [String(from || '').trim(), String(to || '').trim()])
    .filter(([from, to]) => from.length > 0 && to.length > 0 && from !== to);
}

function parseAiResponse(text) {
  // Strip markdown code fences if present
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, '');
  cleaned = cleaned.replace(/\n?```\s*$/i, '');

  // Try JSON first (both English and Chinese keys)
  try {
    const json = JSON.parse(cleaned);
    const aiTitle = json.title || json.标题 || '';
    const aiSummary = json.summary || json.摘要 || '';
    const source = cleanSource(json.source || json.来源 || '');
    const sourceTier = cleanSourceTier(json.sourceTier || json.信源等级 || json.来源等级);
    const sourceTierReason = cleanSourceTierReason(json.sourceTierReason || json.信源等级原因 || json.来源等级原因);
    const tagMerges = cleanTagMerges(json.tagMerges || json.标签合并);
    if (aiTitle || aiSummary) {
      return {
        aiTitle,
        aiSummary,
        source,
        sourceTier,
        sourceTierReason,
        tags: cleanTags(json.tags || json.标签),
        tagMerges,
        publishedAt: normalizeDate(json.date || json.日期),
      };
    }
    // JSON parsed but fields empty — fall through
  } catch (_) {
    // fall through to regex
  }

  // Regex fallback: match both "key": "value" JSON lines and key: value text lines
  const titleMatch = text.match(/(?:["']?(?:title|标题)["']?\s*[：:=]\s*["']?)(.+?)(?:["']?\s*[,}]|$)/im);
  const summaryMatch = text.match(/(?:["']?(?:summary|摘要)["']?\s*[：:=]\s*["']?)(.+?)(?:["']?\s*[,}]|$)/im);
  const sourceMatch = text.match(/(?:["']?(?:source|来源)["']?\s*[：:=]\s*["']?)(.+?)(?:["']?\s*[,}]|$)/im);
  const sourceTierMatch = text.match(/(?:["']?(?:sourceTier|信源等级|来源等级)["']?\s*[：:=]\s*["']?)(.+?)(?:["']?\s*[,}]|$)/im);
  const sourceTierReasonMatch = text.match(/(?:["']?(?:sourceTierReason|信源等级原因|来源等级原因)["']?\s*[：:=]\s*["']?)(.+?)(?:["']?\s*[,}]|$)/im);
  const tagsMatch = text.match(/(?:["']?(?:tags|标签)["']?\s*[：:=]\s*)\[?([^\]]*)\]?/i);
  const dateMatch = text.match(/(?:["']?(?:date|日期)["']?\s*[：:=]\s*["']?)(.+?)(?:["']?\s*[,}]|$)/im);

  let aiTitle = titleMatch?.[1]?.trim() || '';
  let aiSummary = summaryMatch?.[1]?.trim() || '';
  let source = cleanSource(sourceMatch?.[1] || '');
  let sourceTier = cleanSourceTier(sourceTierMatch?.[1] || '');
  let sourceTierReason = cleanSourceTierReason(sourceTierReasonMatch?.[1] || '');
  let tags = [];
  let publishedAt = null;

  if (tagsMatch?.[1]) {
    const rawTags = tagsMatch[1]
      .replace(/["'\[\]]/g, '')
      .split(/[,，、]/)
      .map((t) => t.trim());
    tags = cleanTags(rawTags);
  }

  if (dateMatch?.[1]) {
    publishedAt = normalizeDate(dateMatch[1].replace(/["',]/g, '').trim());
  }

  // Last resort: scan lines for meaningful content, skip obvious noise
  if (!aiTitle && !aiSummary) {
    const lines = text.split('\n')
      .map(l => l.replace(/^["'{}\[\],\s]+|["'{}\[\],\s]+$/g, '').trim())
      .filter(l => l && !/^[{}\[\]]$/.test(l) && l.length > 2);
    if (lines.length >= 2) {
      aiTitle = lines[0].slice(0, 60);
      aiSummary = lines.slice(1).join(' ').slice(0, 200);
    } else {
      aiTitle = text.replace(/[{}"']/g, '').slice(0, 60);
      aiSummary = text.replace(/[{}"']/g, '').slice(0, 200);
    }
  }

  return { aiTitle, aiSummary, source, sourceTier, sourceTierReason, tags, tagMerges: [], publishedAt };
}

function cleanSource(source) {
  const s = String(source || '').trim().replace(/^["']|["']$/g, '');
  if (!s || /^(未知|无|不详|暂无|null|none|n\/a|tbd|unknown)$/i.test(s)) return '';
  return s.replace(/\s*(消息|报道|来源)\s*$/u, '').slice(0, 40);
}

function cleanSourceTier(tier) {
  const s = String(tier || '').trim().replace(/^["']|["']$/g, '').toLowerCase();
  if (['high', 'medium', 'low'].includes(s)) return s;
  if (/^(高|权威|官方|可靠)$/.test(s)) return 'high';
  if (/^(中|一般|普通)$/.test(s)) return 'medium';
  if (/^(低|未知|较差|差|不明)$/.test(s)) return 'low';
  return 'low';
}

function cleanSourceTierReason(reason) {
  return String(reason || '').trim().replace(/^["']|["']$/g, '').slice(0, 60);
}

function normalizeDate(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s || /^(未知|未知日期|无|不详|暂无|null|none|n\/a|tbd|unknown)$/i.test(s)) return null;

  // YYYY-MM-DD
  let m = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;

  // Chinese: 2024年1月15日
  m = s.match(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;

  // YYYY/MM/DD or YYYY.MM.DD
  m = s.match(/(\d{4})[\/.](\d{1,2})[\/.](\d{1,2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;

  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  }
  return null;
}

/**
 * Streaming chat with tool calling.
 * Yields content chunks in real-time via onChunk, and returns accumulated result.
 * 兼容别名：实现已收口到 providers/（按 cfg.protocol 分发 openai/anthropic/gemini），
 * SSE 跨 chunk 行缓冲、tool arguments parseError 回喂等行为不变。
 *
 * Returns: { content: string, toolCalls: Array<{id, name, arguments}>, usage: object }
 */
export async function streamChatWithTools(messages, tools, apiConfig, onChunk, signal, opts = {}) {
  return chatStream(apiConfig, messages, tools, onChunk, signal, opts);
}

/* ============ DeepSeek Search API（首选） ============
 * 官方文档: https://api-docs.deepseek.com/zh-cn/guides/search
 * POST {base}/v1/tools/search，直接返回 results[]，不经过模型。
 * need_content=true 时每条带正文；summary 约 600-800 字，rerank_score 用于排序。
 * 计费只算 HTTP 200 且 results 非空，失败/空结果不计费；账号限速 5 QPS。
 */

/** 由 chat/completions / responses / anthropic 地址推导 Search API 地址（官方: https://api.deepseek.com/v1/tools/search） */
export function deriveSearchToolsUrl(baseUrl) {
  let u = (baseUrl || '').trim().replace(/\/+$/, '');
  if (!u) u = 'https://api.deepseek.com';
  u = u.replace(/\/(chat\/completions|responses|anthropic)$/i, '');
  u = u.replace(/\/v1$/i, '');
  return u + '/v1/tools/search';
}

/** 构造 Search API 请求体。count 1-50（默认 10），need_content 默认 true。 */
export function buildDeepseekSearchBody(query, { count = 10, needContent = true } = {}) {
  const n = Math.floor(Number(count));
  return {
    query: String(query || '').trim(),
    count: Number.isFinite(n) ? Math.max(1, Math.min(50, n)) : 10,
    need_content: !!needContent,
  };
}

function toFiniteNumber(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * 归一化 Search API 的 results[]。
 * 只留 http(s) URL、按 rerank_score 降序；authority -1 表示未知，>=3 为高权威。
 * 不按 authority 硬过滤，避免把有用但未知权威的来源直接丢掉。
 */
export function parseDeepseekSearchResults(data, maxResults = 10) {
  const rows = Array.isArray(data && data.results) ? data.results : [];
  const byUrl = new Map();
  for (const raw of rows) {
    if (!raw || typeof raw !== 'object') continue;
    const url = String(raw.url || '').trim();
    if (!/^https?:\/\//i.test(url)) continue;
    const hit = {
      title: String(raw.title || '').trim() || url,
      url,
      snippet: String(raw.snippet || '').replace(/\s+/g, ' ').trim(),
      summary: String(raw.summary || '').replace(/\s+/g, ' ').trim(),
      content: String(raw.content || '').replace(/\r\n?/g, '\n').trim(),
      date: String(raw.date || '').trim(),
      authority: toFiniteNumber(raw.authority, -1),
      rerankScore: toFiniteNumber(raw.rerank_score, 0),
      siteName: String(raw.site_name || '').trim(),
    };
    const prev = byUrl.get(url);
    if (!prev || hit.rerankScore > prev.rerankScore) byUrl.set(url, hit);
  }
  const hits = [...byUrl.values()].sort((a, b) => b.rerankScore - a.rerankScore);
  const limit = Math.max(1, Math.min(50, Math.floor(Number(maxResults)) || 10));
  return hits.slice(0, limit);
}

function formatSearchDate(value) {
  const s = String(value || '').trim();
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(s);
  return m ? m[1] : s;
}

/** 正文每行缩进两格：条数仍可用 /^- /gm 统计，正文里自己的列表不会被误计。 */
function indentBlock(text) {
  return String(text || '').split('\n').map((line) => '  ' + line).join('\n');
}

/** 搜索结果 → 模型可读文本。格式与旧的 "- 标题 / 摘要 / URL" 契约兼容。 */
export function formatDeepseekSearchResults(hits) {
  return (Array.isArray(hits) ? hits : []).map((r) => {
    const lines = [`- ${r.title || r.url}`];
    const overview = r.summary || r.snippet;
    if (overview) lines.push(`  摘要：${overview}`);
    lines.push(`  URL：${r.url}`);
    const meta = [];
    const date = formatSearchDate(r.date);
    if (date) meta.push(date);
    if (Number.isFinite(r.authority) && r.authority >= 0) meta.push(`权威度 ${r.authority}/4`);
    if (r.siteName) meta.push(r.siteName);
    if (meta.length) lines.push(`  ${meta.join(' · ')}`);
    if (r.content) {
      lines.push('  正文：');
      lines.push(indentBlock(r.content));
    } else if (!overview) {
      lines.push('  （未返回摘要或正文）');
    }
    return lines.join('\n');
  }).join('\n\n');
}

function deepseekApiError(data, status) {
  const detail = data && data.error
    ? (data.error.message || data.error.code || '')
    : '';
  return {
    message: `搜索 API ${status}${detail ? ': ' + detail : ''}`,
    detail: String(detail || ''),
  };
}

async function postDeepseekSearch(endpoint, apiConfig, body, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiConfig.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    let data = null;
    try { data = await response.json(); } catch (_) {}
    if (!response.ok) {
      const e = deepseekApiError(data, response.status);
      const err = new Error(e.message);
      err.status = response.status;
      err.detail = e.detail;
      throw err;
    }
    if (!data || typeof data !== 'object') {
      const err = new Error('搜索 API 返回的不是 JSON');
      err.status = response.status;
      throw err;
    }
    return data;
  } catch (err) {
    if (err && err.name === 'AbortError') {
      const e = new Error(`搜索超时（${Math.round(timeoutMs / 1000)}s）`);
      e.timeout = true;
      throw e;
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}


/**
 * 调 DeepSeek Search API。返回格式化文本；无结果返回 null。
 * 网络错误 / 408 / 429 / 5xx 自动重试 5 次（指数退避）；401/402/429 给出可操作的中文错误。
 */
export async function deepseekSearch(query, apiConfig, {
  count = 10, needContent = true, timeoutMs = 20000,
} = {}) {
  const q = String(query || '').trim();
  if (!q) throw new Error('需要搜索关键词');

  const cfg = apiConfig || {};
  const endpoint = deriveSearchToolsUrl(cfg.baseUrl);
  const body = buildDeepseekSearchBody(q, { count, needContent });
  let retries = 0;

  for (;;) {
    try {
      const data = await postDeepseekSearch(endpoint, cfg, body, timeoutMs);
      const hits = parseDeepseekSearchResults(data, body.count);
      return hits.length ? formatDeepseekSearchResults(hits) : null;
    } catch (err) {
      const status = err && err.status;
      if (isRetryableNetworkError(err) && retries < 5) {
        retries += 1;
        const delay = Math.min(8000, 500 * 2 ** (retries - 1));
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      const suffix = err && err.detail ? `：${err.detail}` : '';
      if (status === 401) {
        const e = new Error(`DeepSeek API Key 无效或已过期（HTTP 401）${suffix}`);
        e.status = 401;
        e.detail = err.detail || '';
        throw e;
      }
      if (status === 402) {
        const e = new Error(`DeepSeek 搜索额度不足（HTTP 402），请先充值${suffix}`);
        e.status = 402;
        e.detail = err.detail || '';
        throw e;
      }
      if (status === 429) {
        const e = new Error(`DeepSeek 搜索限流（5 QPS），请稍后重试${suffix}`);
        e.status = 429;
        e.detail = err.detail || '';
        throw e;
      }
      throw err;
    }
  }
}

/* ============ DeepSeek 原生联网搜索（Responses API web_search，旧接口兜底） ============
 * 官方文档: https://api-docs.deepseek.com/zh-cn/guides/responses_api/
 * POST {base}/responses，tools: [{type:'web_search'}] 由服务端执行搜索。
 * web_search_call 只有 action，没有 results 数组；命中从 message.url_citation / 正文提取。
 * 思考模式默认开，max_output_tokens 含 reasoning，过小会 incomplete 后看起来像「搜不到」。
 * 仅当 Search API 返回 404/405（端点未覆盖）时调用；正常路径不再走这里。
 */

/** 由 chat/completions 地址推导 Responses API 地址（官方: https://api.deepseek.com/responses） */
export function deriveResponsesUrl(baseUrl) {
  let u = (baseUrl || '').trim().replace(/\/+$/, '');
  if (!u) u = 'https://api.deepseek.com';
  if (/\/chat\/completions$/i.test(u)) return u.replace(/\/chat\/completions$/i, '/responses');
  if (/\/v1$/i.test(u)) return u + '/responses';
  return u + '/responses';
}

function pushSearchHit(hits, seen, raw) {
  const url = String((raw && raw.url) || '').trim();
  if (!url) return;
  const title = String((raw && (raw.title || raw.url)) || url).trim() || url;
  const text = String((raw && (raw.text || raw.content || raw.snippet)) || '').replace(/\s+/g, ' ').trim();
  if (seen.has(url)) {
    const prev = hits.find((h) => h.url === url);
    if (!prev) return;
    if (title && title !== url && (!prev.title || prev.title === prev.url)) prev.title = title;
    if (text && !prev.text) prev.text = text;
    return;
  }
  seen.add(url);
  hits.push({ title, url, text });
}

export function extractOutputText(data) {
  const out = Array.isArray(data && data.output) ? data.output : [];
  const parts = [];
  for (const item of out) {
    if (item.type !== 'message' || !Array.isArray(item.content)) continue;
    for (const part of item.content) {
      if ((part.type === 'output_text' || part.text) && part.text) parts.push(part.text);
    }
  }
  return parts.join('\n').trim();
}

/**
 * 从 Responses API 非流式响应中提取搜索命中。
 * DeepSeek / OpenAI 的 web_search_call **没有** results 数组，只有 action
 * （search / open_page / find_in_page）；条目在 message 的 url_citation 或正文里。
 */
export function extractWebSearchResults(data) {
  const out = Array.isArray(data && data.output) ? data.output : [];
  const hits = [];
  const seen = new Set();

  for (const item of out) {
    if (item.type === 'web_search_call') {
      if (Array.isArray(item.results)) item.results.forEach((r) => pushSearchHit(hits, seen, r));
      if (Array.isArray(item.sources)) item.sources.forEach((r) => pushSearchHit(hits, seen, r));
      const act = item.action;
      if (act && Array.isArray(act.sources)) act.sources.forEach((r) => pushSearchHit(hits, seen, r));
      if (act && act.url) pushSearchHit(hits, seen, { title: act.title || act.url, url: act.url, text: '' });
    }
    if (item.type !== 'message' || !Array.isArray(item.content)) continue;
    for (const part of item.content) {
      if (Array.isArray(part.annotations)) {
        for (const ann of part.annotations) {
          const c = ann.type === 'url_citation' ? ann : (ann.url_citation || null);
          const url = (c && c.url) || ann.url;
          const title = (c && c.title) || ann.title || url;
          if (url) pushSearchHit(hits, seen, { title, url, text: '' });
        }
      }
      const text = part.type === 'output_text' ? part.text : part.text;
      if (!text) continue;
      const md = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g;
      let m;
      while ((m = md.exec(text))) pushSearchHit(hits, seen, { title: m[1], url: m[2], text: '' });
      const raw = /https?:\/\/[^\s)\]>'"]+/g;
      while ((m = raw.exec(text))) {
        const url = m[0].replace(/[.,;:]+$/, '');
        pushSearchHit(hits, seen, { title: url, url, text: '' });
      }
    }
  }
  return hits.length > 0 ? hits : null;
}

/**
 * 调用 DeepSeek Responses API 做一次服务端联网搜索。
 * @param {string} query 搜索关键词
 * @param {object} apiConfig { apiKey, baseUrl, model }
 * @returns {Promise<string|null>} 格式化结果（"- 标题\n  摘要\n  URL" 多行文本）；无结果返回 null
 * @throws {Error} 网络/鉴权/参数错误
 */
async function postResponsesSearch(endpoint, apiConfig, query, timeoutMs, extraBody) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiConfig.apiKey}`,
      },
      body: JSON.stringify({
        model: apiConfig.model,
        input: [
          'Search the web for the following query and list up to 10 results.',
          'Each result: title on one line, one-sentence snippet, then the source URL.',
          'No preamble.',
          '',
          `Query: ${query}`,
        ].join('\n'),
        tools: [{ type: 'web_search' }],
        tool_choice: { type: 'web_search' },
        max_output_tokens: 4000,
        stream: false,
        ...extraBody,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      let detail = '';
      try {
        const errData = await response.json();
        detail = errData.error?.message || '';
      } catch (_) {}
      const err = new Error(`搜索 API ${response.status}${detail ? ': ' + detail : ''}`);
      err.status = response.status;
      err.detail = detail;
      throw err;
    }
    return await response.json();
  } catch (err) {
    if (err && err.name === 'AbortError') {
      const e = new Error(`搜索超时（${Math.round(timeoutMs / 1000)}s）`);
      e.code = 'ETIMEDOUT';
      e.timeout = true;
      throw e;
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

function formatNativeHits(results, maxResults) {
  return results.slice(0, maxResults).map((r) => {
    const url = String(r.url || '').trim();
    const title = String(r.title || '').trim() || url;
    let text = String(r.text || r.content || r.snippet || '').replace(/\s+/g, ' ').trim();
    if (text.length > 220) text = text.slice(0, 220) + '…';
    return `- ${title}\n  ${text || '(无摘要)'}\n  ${url}`;
  }).join('\n\n');
}

export async function nativeWebSearch(query, apiConfig, { timeoutMs = 30000, maxResults = 10 } = {}) {
  const endpoint = deriveResponsesUrl(apiConfig.baseUrl);
  let data;
  try {
    data = await withNetworkRetry(
      () => postResponsesSearch(endpoint, apiConfig, query, timeoutMs, { reasoning: { effort: 'none' } }),
      { maxRetries: 5 },
    );
  } catch (err) {
    const msg = (err && (err.detail || err.message)) || '';
    if (err && err.status === 400 && /reason/i.test(msg)) {
      data = await withNetworkRetry(
        () => postResponsesSearch(endpoint, apiConfig, query, timeoutMs, {}),
        { maxRetries: 5 },
      );
    } else {
      throw err;
    }
  }

  const results = extractWebSearchResults(data);
  if (results) return formatNativeHits(results, maxResults);

  const text = extractOutputText(data);
  if (text) return text;

  if (data && data.status === 'incomplete') {
    const reason = (data.incomplete_details && data.incomplete_details.reason) || 'incomplete';
    throw new Error(`搜索响应被截断（${reason}）`);
  }
  return null;
}

export async function testApiConnection(apiConfig) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    await chatComplete(apiConfig, [{ role: 'user', content: '回复"连接成功"' }], {
      maxTokens: 10,
      signal: controller.signal,
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  } finally {
    clearTimeout(timeout);
  }
}



