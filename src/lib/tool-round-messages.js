/**
 * 一轮 assistant(tool_calls) + tool 结果落账。
 * 子代理把 apiMessages 与 historyMessages 指到同一数组；若各 push 一次，
 * Anthropic 会看到连续两条 tool_use、中间没有 tool_result，下一轮 400。
 */
export function commitRoundToolTranscript(apiMessages, historyMessages, assistantMsg, toolPairs) {
  const same = apiMessages === historyMessages;
  apiMessages.push(assistantMsg);
  if (!same) historyMessages.push(assistantMsg);
  for (const pair of toolPairs || []) {
    apiMessages.push(pair.api);
    if (!same) historyMessages.push(pair.history);
  }
}
