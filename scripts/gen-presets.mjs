/* 从 models.dev 生成"厂商目录"预设（presets.generated.js）。
 *
 * 为什么用 models.dev：项目已把它当作模型元数据源（见 src/lib/model-limits.js），
 * 一次覆盖 200+ 厂商，不必每次遇到新厂商再手抄预设。
 *
 * 用法：
 *   node scripts/gen-presets.mjs             # 在线拉取并写入
 *   node scripts/gen-presets.mjs --offline   # 用 .cache/models-dev.json（若存在）
 *   node scripts/gen-presets.mjs --check     # 只报告，不写文件
 *
 * 产物：src/lib/providers/presets.generated.js（勿手改）
 * 手写预设请放 src/lib/providers/presets.js 的 LOCAL_PRESETS，本脚本不会覆盖。
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_FILE = path.join(ROOT, 'src/lib/providers/presets.generated.js');
const CACHE_FILE = path.join(ROOT, '.cache/models-dev.json');
const SOURCE = process.env.PRESETS_SOURCE || 'https://models.dev/api.json';

/* 每个厂商最多保留多少个模型（按发布日倒序）。控制 bundle 体积。 */
const MAX_MODELS_PER_PROVIDER = 40;

/* models.dev 的 npm 字段 → 本项目 protocol。未列出的（bedrock/azure/mistral/
 * vertex/codex 等）需要专属适配器，直接跳过，避免生成"选了必报错"的预设。 */
const NPM_TO_PROTOCOL = {
  '@ai-sdk/openai-compatible': 'openai',
  '@ai-sdk/openai': 'openai',
  '@ai-sdk/anthropic': 'anthropic',
  '@ai-sdk/google': 'gemini',
};

/* models.dev 对一线厂商的 api 字段常为空（SDK 内置默认地址），这里兜底。 */
const DEFAULT_BASE = {
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com',
  gemini: 'https://generativelanguage.googleapis.com',
};

/* 精选：进"快速填充"芯片区的厂商（顺序即展示顺序）。其余走搜索框。 */
const POPULAR = [
  'openai', 'anthropic', 'google', 'deepseek', 'xai', 'mistral', 'moonshotai',
  'zai', 'alibaba', 'minimax', 'bytedance', 'groq', 'openrouter', 'siliconflow',
  'togetherai', 'fireworks-ai', 'perplexity', 'cerebras', 'deepinfra', 'nvidia',
];

const args = new Set(process.argv.slice(2));
const offline = args.has('--offline');
const checkOnly = args.has('--check');

async function loadSource() {
  if (offline) {
    const raw = await fs.readFile(CACHE_FILE, 'utf8');
    return JSON.parse(raw);
  }
  const res = await fetch(SOURCE);
  if (!res.ok) throw new Error(`拉取 ${SOURCE} 失败: HTTP ${res.status}`);
  const text = await res.text();
  await fs.mkdir(path.dirname(CACHE_FILE), { recursive: true });
  await fs.writeFile(CACHE_FILE, text);
  return JSON.parse(text);
}

function pickBase(provider, protocol) {
  const api = String(provider.api || '').trim().replace(/\/+$/, '');
  return api || DEFAULT_BASE[protocol];
}

function modelSortKey(m) {
  return String(m.release_date || m.last_updated || '');
}

function buildPresets(data) {
  const presets = [];
  let skippedProviders = 0;
  let skippedModels = 0;

  for (const [id, provider] of Object.entries(data)) {
    if (!provider || typeof provider !== 'object') continue;
    const protocol = NPM_TO_PROTOCOL[provider.npm];
    if (!protocol) { skippedProviders += 1; continue; }

    const all = Object.values(provider.models || {}).filter((m) => m && m.id);
    const usable = all
      .filter((m) => m.status !== 'deprecated')
      .sort((a, b) => modelSortKey(b).localeCompare(modelSortKey(a)));
    skippedModels += all.length - Math.min(usable.length, MAX_MODELS_PER_PROVIDER);

    const modelIds = usable.slice(0, MAX_MODELS_PER_PROVIDER).map((m) => String(m.id));
    if (!modelIds.length) { skippedProviders += 1; continue; }

    presets.push({
      id,
      label: String(provider.name || id).trim() || id,
      protocol,
      baseUrl: pickBase(provider, protocol),
      model: modelIds[0],
      models: modelIds,
      doc: provider.doc || '',
      env: Array.isArray(provider.env) ? provider.env : [],
    });
  }

  presets.sort((a, b) => a.label.localeCompare(b.label));
  return { presets, skippedProviders, skippedModels };
}

function render(presets, stats) {
  const stamp = new Date().toISOString();
  const body = presets
    .map((p) => {
      const models = p.models.map((m) => JSON.stringify(m)).join(',');
      const env = p.env.length ? `, env: ${JSON.stringify(p.env)}` : '';
      const doc = p.doc ? `, doc: ${JSON.stringify(p.doc)}` : '';
      return (
        '  { id: ' + JSON.stringify(p.id) +
        ', label: ' + JSON.stringify(p.label) +
        ', protocol: ' + JSON.stringify(p.protocol) +
        ', baseUrl: ' + JSON.stringify(p.baseUrl) +
        ', model: ' + JSON.stringify(p.model) +
        ', models: [' + models + ']' + env + doc + ' },'
      );
    })
    .join('\n');

  const popular = POPULAR.filter((id) => presets.some((p) => p.id === id));

  return `/* 自动生成，请勿手改 —— 由 scripts/gen-presets.mjs 从 models.dev 生成。
 * 生成时间: ${stamp}
 * 来源: ${SOURCE}
 * 厂商: ${presets.length} 个  跳过(len > ${MAX_MODELS_PER_PROVIDER} 截断): ${stats.skippedModels} 条模型
 *
 * 手写/私有网关预设请加到 presets.js 的 LOCAL_PRESETS（优先级更高，不会被覆盖）。 */

export const GENERATED_AT = ${JSON.stringify(stamp)};

/** 精选厂商 id，按展示顺序 —— 用于"快速填充"芯片区，避免几百个芯片刷屏。 */
export const POPULAR_PRESET_IDS = ${JSON.stringify(popular)};

export const GENERATED_PRESETS = [
${body}
];
`;
}

const data = await loadSource();
const { presets, skippedProviders, skippedModels } = buildPresets(data);

const byProtocol = presets.reduce((acc, p) => { acc[p.protocol] = (acc[p.protocol] || 0) + 1; return acc; }, {});
const totalModels = presets.reduce((n, p) => n + p.models.length, 0);
console.log(`[gen-presets] 厂商 ${presets.length} 个（跳过 ${skippedProviders}）· 模型 ${totalModels} 条（截断 ${skippedModels}）`);
console.log('[gen-presets] 协议分布:', JSON.stringify(byProtocol));

if (checkOnly) {
  console.log('[gen-presets] --check 模式，未写入文件');
} else {
  const out = render(presets, { skippedModels });
  await fs.writeFile(OUT_FILE, out, 'utf8');
  console.log(`[gen-presets] 已写入 ${path.relative(ROOT, OUT_FILE)} (${(out.length / 1024).toFixed(0)}KB)`);
}
