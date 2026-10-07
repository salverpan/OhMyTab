/**
 * browser 子代理紧循环：把 content script 的结构化 snapshot 格式化给模型。
 * 无 chrome / 无 DOM，SW 与测试均可 import。
 */

export const BROWSER_ACT_OPS = [
  'observe', 'click', 'type', 'select', 'scroll_up', 'scroll_down', 'wait', 'navigate',
];

export function formatPageSnapshot(snap) {
  if (!snap || snap.ok === false) {
    return `观察失败: ${(snap && snap.error) || '未知错误'}`;
  }
  const lines = [];
  lines.push('[PAGE]');
  lines.push(`url: ${snap.url || ''}`);
  lines.push(`title: ${snap.title || ''}`);
  lines.push(`fingerprint: ${snap.fingerprint || ''}`);
  if (snap.text) {
    lines.push('visible_text:');
    lines.push(String(snap.text).slice(0, 2500));
  }
  lines.push('');
  lines.push('[CONTROLS]');
  const elements = Array.isArray(snap.elements) ? snap.elements : [];
  if (!elements.length) {
    lines.push('(当前视口没有可操作控件。可 scroll_down / wait / navigate。)');
  }
  for (const el of elements) {
    const bits = [`[${el.index}]`, el.role || 'generic', el.label || ''];
    if (el.value != null && String(el.value).trim() !== '') {
      bits.push(`value=${JSON.stringify(String(el.value).slice(0, 80))}`);
    }
    if (el.checked != null) bits.push(`checked=${el.checked}`);
    if (el.expanded != null) bits.push(`expanded=${el.expanded}`);
    if (el.operations && el.operations.length) bits.push(`ops=${el.operations.join(',')}`);
    lines.push(bits.filter((x) => x !== '').join('  '));
    for (const opt of el.options || []) {
      lines.push(`    ${opt.index}  ${opt.label}`);
    }
  }
  const extras = [];
  if (snap.can_scroll_down) extras.push('scroll_down');
  if (snap.can_scroll_up) extras.push('scroll_up');
  extras.push('wait');
  lines.push('');
  lines.push(`[OPS] click / type / select 必须用上表编号。其它：${extras.join(', ')}, navigate, observe`);
  if (snap.omitted) lines.push(`omitted_offscreen: ${snap.omitted}`);
  lines.push('执行后会自动返回新表。不要 number_elements，不要发明 CSS / 坐标 / JS。');
  return lines.join('\n');
}

export function formatLoopResult(resp, { acted } = {}) {
  if (!resp) return '页面循环失败：未收到响应。';
  if (resp.stale) {
    const table = formatPageSnapshot(resp.snapshot || resp);
    return `页面已变化，上次选择作废。已重新观察：\n${table}`;
  }
  if (resp.ok === false) {
    const extra = resp.snapshot ? `\n\n${formatPageSnapshot(resp.snapshot)}` : '';
    return `操作失败: ${resp.error || '未知错误'}${extra}`;
  }
  const prefix = acted ? `已执行 ${acted}。\n` : '';
  return prefix + formatPageSnapshot(resp.snapshot || resp);
}
