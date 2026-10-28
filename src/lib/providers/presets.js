/* 常用厂商预设：设置页「接入预设」下拉的数据源。
 * 选中即填充 Base URL / 协议 / 模型列表，均可手改；只做便利填充不做校验。
 * 聚合服务（OpenRouter/SiliconFlow）一个端点几百个模型，是覆盖率的兜底路径。 */

import { GENERATED_PRESETS, POPULAR_PRESET_IDS } from './presets.generated.js';

export const LOCAL_PRESETS = [
  { id: 'custom', label: '自定义（手动填写）', protocol: 'openai', baseUrl: '', model: '', models: [] },
  {
    id: 'deepseek', label: 'DeepSeek 深度求索', protocol: 'openai',
    baseUrl: 'https://api.deepseek.com/chat/completions',
    model: 'deepseek-v4-flash',
    models: ['deepseek-v4-flash', 'deepseek-chat', 'deepseek-reasoner'],
  },
  {
    id: 'zhipu', label: '智谱 GLM（bigmodel.cn）', protocol: 'openai',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    model: 'glm-4.6',
    models: ['glm-4.6', 'glm-4.5-air', 'glm-4v-flash'],
  },
  {
    id: 'qwen', label: '阿里通义 Qwen（DashScope 兼容模式）', protocol: 'openai',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    model: 'qwen-max',
    models: ['qwen-max', 'qwen-plus', 'qwen-turbo'],
  },
  {
    id: 'kimi', label: 'Moonshot Kimi', protocol: 'openai',
    baseUrl: 'https://api.moonshot.cn/v1/chat/completions',
    model: 'kimi-k2',
    models: ['kimi-k2', 'moonshot-v1-auto'],
  },
  {
    id: 'doubao', label: '字节豆包（火山方舟）', protocol: 'openai',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
    model: 'doubao-seed-1-6',
    models: ['doubao-seed-1-6'],
  },
  {
    id: 'siliconflow', label: 'SiliconFlow 硅基流动（聚合）', protocol: 'openai',
    baseUrl: 'https://api.siliconflow.cn/v1/chat/completions',
    model: 'Qwen/Qwen3-72B',
    models: ['Qwen/Qwen3-72B', 'deepseek-ai/DeepSeek-V3'],
  },
  {
    id: 'openrouter', label: 'OpenRouter（聚合，数百模型）', protocol: 'openai',
    baseUrl: 'https://openrouter.ai/api/v1/chat/completions',
    model: 'anthropic/claude-sonnet-4.5',
    models: ['anthropic/claude-sonnet-4.5', 'openai/gpt-4o', 'google/gemini-2.5-flash'],
  },
  {
    id: 'openai', label: 'OpenAI 官方', protocol: 'openai',
    baseUrl: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4o',
    models: ['gpt-4o', 'gpt-4.1', 'o3'],
  },
  {
    id: 'anthropic', label: 'Anthropic Claude 官方（原生协议）', protocol: 'anthropic',
    baseUrl: 'https://api.anthropic.com',
    model: 'claude-sonnet-4-5',
    models: ['claude-sonnet-4-5', 'claude-opus-4-1', 'claude-haiku-4-5'],
  },
  {
    id: 'gemini', label: 'Google Gemini 官方（原生协议）', protocol: 'gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    model: 'gemini-2.5-flash',
    models: ['gemini-2.5-flash', 'gemini-2.5-pro'],
  },
  {
    id: 'grok', label: 'xAI Grok', protocol: 'openai',
    baseUrl: 'https://api.x.ai/v1/chat/completions',
    model: 'grok-4',
    models: ['grok-4', 'grok-3'],
  },
  {
    id: 'opencode-go', label: 'OpenCode Go（订阅套餐网关）', protocol: 'openai',
    baseUrl: 'https://opencode.ai/zen/go/v1/chat/completions',
    model: 'deepseek-v4.1-flash',
    // 只列 chat/completions 系的模型；minimax-m3、qwen3.8-flash 走 /messages，
    // grok-4.7、gpt-5.6-luna、muse-spark 走 /responses，需要另配 protocol。
    models: [
      'deepseek-v4.1-flash', 'deepseek-v4-pro', 'deepseek-v4-flash',
      'glm-5.3', 'glm-5.3-flash', 'glm-5.2', 'glm-5.1',
      'kimi-k3', 'kimi-k2.7-code', 'kimi-k2.6',
      'qwen3.8-max', 'qwen3.7-max', 'qwen3.6-plus',
      'mimo-v2.6-flash', 'mimo-v2.6-pro', 'minimax-m2.7',
      'longcat-2.0',
    ],
  },
  { id: 'ollama', label: '本地 Ollama', protocol: 'openai', baseUrl: 'http://localhost:11434/v1/chat/completions', model: '', models: [] },
];

/* ---- 目录合并：手写预设优先，生成目录补长尾 ---- */
const LOCAL_IDS = new Set(LOCAL_PRESETS.map((p) => p.id));
const GENERATED_BY_ID = new Map(GENERATED_PRESETS.map((p) => [p.id, p]));

/** 快速填充芯片用：手写 + 精选厂商（约 24 个，避免几百个芯片刷屏） */
export const PROVIDER_PRESETS = [
  ...LOCAL_PRESETS,
  ...POPULAR_PRESET_IDS.filter((id) => !LOCAL_IDS.has(id))
    .map((id) => GENERATED_BY_ID.get(id))
    .filter(Boolean)
    .map((p) => ({ ...p, label: p.label + '（目录）' })),
];

/** 搜索框用：手写 + 全部厂商目录（同 id 以手写为准） */
export const PROVIDER_CATALOG = [
  ...LOCAL_PRESETS,
  ...GENERATED_PRESETS.filter((p) => !LOCAL_IDS.has(p.id)),
];

/** 国产模型的 Anthropic 兼容层（Claude Code 生态带火的第二接法，备用路线） */
export const ANTHROPIC_COMPAT_ENDPOINTS = [
  { label: 'DeepSeek（Anthropic 兼容层）', baseUrl: 'https://api.deepseek.com/anthropic' },
  { label: '智谱 GLM（Anthropic 兼容层）', baseUrl: 'https://open.bigmodel.cn/api/anthropic' },
];
