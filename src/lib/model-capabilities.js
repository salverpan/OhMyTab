/* 模型能力注册表（静态模式表 + 运行时探测缓存）。
 *
 * 设计参考 opencode 的 models.dev：视觉/工具等不是"另一种模型角色"，
 * 而是模型记录上的输入模态标志（modalities.input 含 image）。这里只内置
 * 常见家族的模式表（数据对齐 models.dev 的 modality 字段），不追求全量：
 *  - 未命中的模型按不支持处理（乐观提示：已知家族可立刻当视觉用；未知家族先走外挂）
 *  - 真实能力以 vision-client 的探测缓存为准：后台红块探测看见红色写 ok；
 *    只有接口 400/422 拒图才写 no。含糊回答和小图「看不到」都不写缓存。
 */

const VISION_TRUE = [
  /^gpt-4o/, /^chatgpt-4o/, /^gpt-4\.1/, /^gpt-4-turbo/, /^gpt-4-vision/,
  /^gpt-5/,
  /^o[134](-|$)/, // o1 / o3 / o4-mini 接受图像输入
  /^claude-3/, /^claude-4/, /^claude-\d+/, /^claude-(sonnet|opus|haiku)/,
  /^gemini-/, /^gemma-3/,
  /glm-\d+(\.\d+)?v/i, // glm-4v-flash / glm-4.5v …
  /qwen.*vl/i, /^qvq/i, // qwen-vl / qwen2.5-vl / QVQ
  /doubao.*vision|vision.*doubao/i,
  /grok-[234]-vision|^grok-[34]$/i,
  /pixtral|mistral-(small|large|medium).*(2411|latest)|mistral-ocr/i,
  /llama-?3\.2-vision|llama-?4/i,
  /^step-1v|^step-1o/i,
  /yi-vision/i,
  /internvl|minicpm-v|deepseek-vl/i,
  /kimi-vl|moonshot.*vision/i,
  /ernie.*vl|ernie.*vision/i,
];

/** 静态表判定。返回 true/false；未知模型返回 false（保守，不自动当视觉模型用）。 */
export function modelSupportsVision(modelId) {
  const m = String(modelId || '').toLowerCase();
  if (!m) return false;
  return VISION_TRUE.some((re) => re.test(m));
}
