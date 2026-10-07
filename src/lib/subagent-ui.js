/**
 * 子代理卡片 HTML + 就地更新。
 * 侧栏 / 浮动窗 / 阅读器各自插入 DOM；SW 只传 card 对象。
 * 子代理卡片只用 shimmer 状态行，不用 ThinkingOrb。
 */

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const STATE_LABEL = {
  running: '进行中',
  completed: '完成',
  incomplete: '未提交',
  error: '失败',
  idle: '待命',
};

function emptySpan(prefix, text) {
  return '<span class="' + prefix + '-subagent-empty">' + esc(text) + '</span>';
}

function setBlock(el, text, emptyText, prefix) {
  if (!el) return;
  const t = String(text || '');
  if (t) el.textContent = t;
  else el.innerHTML = emptySpan(prefix, emptyText);
}

function structuredInner(card, prefix) {
  const report = card.structuredReport;
  if (!report) return '';
  const claims = (report.claims || []).map((c) => {
    const refs = (c.evidence || []).map((e) => `${e.doc_id}#${e.anchor}`).join(' · ');
    return `<li><span>${esc(c.claim)}</span>${refs ? `<small>${esc(refs)}</small>` : ''}</li>`;
  }).join('');
  const actions = (report.actions || []).map((a) =>
    `<li><span>${esc(a.description)}</span>${a.result_ref ? `<small>${esc(a.result_ref)}</small>` : ''}</li>`).join('');
  return `<div class="${prefix}-subagent-label">结构化交回</div>
    <p>${esc(report.summary || '')}</p>
    ${claims ? `<ul>${claims}</ul>` : ''}
    ${actions ? `<ul>${actions}</ul>` : ''}`;
}

function verificationInner(card, prefix) {
  const verification = card.verification;
  if (!verification) return '';
  const rows = (verification.claims || []).map((claim) => {
    const passed = claim.verdict === 'entailment-pass' || claim.verdict === 'cross-source-pass';
    const badge = `<strong>${esc(claim.verdict)}</strong>`;
    if (passed) return `<li>${badge} ${esc(claim.claim)}</li>`;
    const evidence = (claim.evidence || []).filter((e) => e.status !== 'citation-pass').map((e) =>
      `<p>${esc(e.reason || '')}${e.excerpt ? `：${esc(e.excerpt)}` : ''}</p>`).join('');
    return `<li><details open><summary>${badge} ${esc(claim.claim)}</summary>${evidence || `<p>${esc(claim.reason || '')}</p>`}</details></li>`;
  }).join('');
  return `<div class="${prefix}-subagent-label">运行时核验 · ${esc(verification.checkRunId || '')}</div>
    <ul>${rows || '<li>无事实 claims</li>'}</ul>`;
}

/** 滚动窗口内容：主代理给的任务书 + 模型返回的正文。 */
function bodyHtml(card, prefix) {
  const status = card.status || 'running';
  const liveHidden = status === 'running' ? '' : ' hidden';
  const shimmer = esc(card.currentLabel ? `${card.currentLabel}…` : 'Thinking');
  const err = card.error ? `<div class="${prefix}-subagent-error">${esc(card.error)}</div>` : '';
  const prompt = String(card.prompt || '').trim();
  const report = String(card.report || '');
  const promptInner = prompt ? esc(prompt) : emptySpan(prefix, '（无）');
  const reportInner = report ? esc(report) : emptySpan(prefix, '等待返回…');
  return `<div class="${prefix}-subagent-scroll">
    <div class="${prefix}-subagent-label">任务书</div>
    <div class="${prefix}-subagent-prompt-text">${promptInner}</div>
    <div class="${prefix}-subagent-label">返回内容</div>
    <div class="${prefix}-subagent-stream">${reportInner}</div>
    <div class="${prefix}-subagent-structured">${structuredInner(card, prefix)}</div>
    <div class="${prefix}-subagent-verification">${verificationInner(card, prefix)}</div>
  </div>
  <div class="${prefix}-subagent-live"${liveHidden}>
    <span class="${prefix}-subagent-shimmer">${shimmer}</span>
  </div>
  ${err}`;
}

export function subagentCardHtml(card, prefix = 'chat') {
  const c = card || {};
  const status = c.status || 'running';
  // 默认任务开始展开、结束收起（用户口径）
  const open = status === 'running' ? ' open' : '';
  const bg = c.background ? `<span class="${prefix}-subagent-bg">后台</span>` : '';
  return `<details class="${prefix}-subagent" data-subagent-id="${esc(c.id)}" data-status="${esc(status)}"${open}>
  <summary>
    <span class="${prefix}-subagent-type">${esc(c.type || 'agent')}</span>
    <span class="${prefix}-subagent-desc">${esc(c.description || '')}</span>
    ${bg}
    <span class="${prefix}-subagent-state">${STATE_LABEL[status] || status}</span>
  </summary>
  ${bodyHtml(c, prefix)}
</details>`;
}

export function subagentListHtml(cards, prefix = 'chat') {
  const list = Array.isArray(cards) ? cards.filter(Boolean) : [];
  if (!list.length) return '';
  return `<div class="${prefix}-subagents">${list.map((c) => subagentCardHtml(c, prefix)).join('')}</div>`;
}

function patchCardEl(el, card, prefix) {
  const status = card.status || 'running';
  const wasRunning = el.dataset.status === 'running';
  el.dataset.status = status;
  if (status === 'running') el.open = true;
  else if (wasRunning) el.open = false; // 结束即收起
  const typeEl = el.querySelector(`.${prefix}-subagent-type`);
  const descEl = el.querySelector(`.${prefix}-subagent-desc`);
  const stateEl = el.querySelector(`.${prefix}-subagent-state`);
  if (typeEl) typeEl.textContent = card.type || 'agent';
  if (descEl) descEl.textContent = card.description || '';
  if (stateEl) stateEl.textContent = STATE_LABEL[status] || status;

  let live = el.querySelector(`.${prefix}-subagent-live`);
  let streamEl = el.querySelector(`.${prefix}-subagent-stream`);
  if (!live || !streamEl) {
    const tmp = el.ownerDocument.createElement('div');
    tmp.innerHTML = bodyHtml(card, prefix);
    [...el.querySelectorAll(`:scope > :not(summary)`)].forEach((n) => n.remove());
    while (tmp.firstChild) el.appendChild(tmp.firstChild);
    live = el.querySelector(`.${prefix}-subagent-live`);
    streamEl = el.querySelector(`.${prefix}-subagent-stream`);
  } else {
    live.hidden = status !== 'running';
    const shimmer = live.querySelector(`.${prefix}-subagent-shimmer`);
    if (shimmer) {
      shimmer.textContent = card.currentLabel ? `${card.currentLabel}…` : 'Thinking';
      shimmer.classList.toggle('error', status === 'error');
    }
    setBlock(el.querySelector(`.${prefix}-subagent-prompt-text`), card.prompt, '（无）', prefix);
    setBlock(streamEl, card.report, '等待返回…', prefix);
    const structured = el.querySelector(`.${prefix}-subagent-structured`);
    const verification = el.querySelector(`.${prefix}-subagent-verification`);
    if (structured) structured.innerHTML = structuredInner(card, prefix);
    if (verification) verification.innerHTML = verificationInner(card, prefix);
    let errEl = el.querySelector(`.${prefix}-subagent-error`);
    if (card.error) {
      if (!errEl) {
        errEl = el.ownerDocument.createElement('div');
        errEl.className = `${prefix}-subagent-error`;
        el.appendChild(errEl);
      }
      errEl.textContent = card.error;
    } else if (errEl) {
      errEl.remove();
    }
    // 流式期间跟随到底；用户手动上翻后不再抢滚动
    const scroll = el.querySelector(`.${prefix}-subagent-scroll`);
    if (scroll && status === 'running') {
      const nearBottom = scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight < 32;
      if (nearBottom) scroll.scrollTop = scroll.scrollHeight;
    }
  }
}

/**
 * Thinking 行始终钉在气泡底。其余块按出现时间排列。
 */
function thinkingEl(root, prefix) {
  return root.querySelector(`:scope > .${prefix}-ai-row`)
    || root.querySelector(`:scope > .${prefix}-thinking-row`);
}

function streamEl(root, prefix) {
  return root.querySelector(`:scope > .${prefix}-stream-body`)
    || root.querySelector(`:scope > .${prefix}-stream`);
}

function hasStreamText(el) {
  return !!(el && String(el.textContent || '').trim());
}

/**
 * 时间线：Thinking 在底；空正文挪到子代理卡片后面，避免主 agent 一流式就把卡片顶下去。
 * 正文已经有内容时，新卡片跟在正文后面（真正的时间顺序），回合结束不再整段重排。
 */
export function syncLiveTurnOrder(root, prefix = 'chat') {
  if (!root) return;
  const think = thinkingEl(root, prefix);
  if (think && think.parentNode === root && root.lastElementChild !== think) {
    root.appendChild(think);
  }
  const wrap = root.querySelector(`:scope > .${prefix}-subagents`);
  const stream = streamEl(root, prefix);
  if (!wrap || wrap.parentNode !== root || !stream || stream.parentNode !== root) return;
  const wrapHas = wrap.childElementCount > 0;
  const streamHas = hasStreamText(stream);
  if (!wrapHas) return;
  if (!streamHas) {
    // 还没出正文：卡片在前，随后的流式写在后面
    if (wrap.nextElementSibling !== stream) stream.before(wrap);
    if (think && stream.nextElementSibling !== think) think.before(stream);
    return;
  }
  // 正文已在流：若卡片还在正文前面，是「先派子代理再回答」，保持；
  // 若卡片是正文之后才出现的，placeWrapInTimeline 会把它放到 stream 后面，这里不动。
}

function placeWrapInTimeline(root, wrap, prefix) {
  const stream = streamEl(root, prefix);
  const think = thinkingEl(root, prefix);
  const streamHas = hasStreamText(stream);

  if (wrap.parentNode === root && wrap.childElementCount > 0) {
    if (think && think.parentNode === root && root.lastElementChild !== think) {
      root.appendChild(think);
    }
    return;
  }

  if (wrap.parentNode !== root) {
    if (stream && stream.parentNode === root && streamHas) {
      stream.after(wrap);
    } else if (stream && stream.parentNode === root) {
      stream.before(wrap);
    } else if (think && think.parentNode === root) {
      root.insertBefore(wrap, think);
    } else {
      const label = root.querySelector(`:scope > .${prefix}-msg-label`);
      if (label && label.parentNode === root) root.insertBefore(wrap, label.nextSibling);
      else root.appendChild(wrap);
    }
  } else if (stream && stream.parentNode === root) {
    if (streamHas && wrap.nextElementSibling === stream) {
      // 主 agent 已经开始说话，再派子代理 → 卡片跟在这段正文后面
      stream.after(wrap);
    } else if (!streamHas && stream.nextElementSibling === wrap) {
      // 空正文在卡片前，一流式就会把卡片顶下去 → 对调
      stream.before(wrap);
    }
  }

  if (think && think.parentNode === root && root.lastElementChild !== think) {
    root.appendChild(think);
  }
}

/** 在已有根节点上插入或就地更新一张卡片。 */
export function upsertSubagentCardEl(root, card, prefix = 'chat') {
  if (!root || !card || !card.id) return;
  const existing = root.querySelector(`[data-subagent-id="${CSS.escape(card.id)}"]`);
  if (existing) {
    const el = existing.closest('details') || existing;
    patchCardEl(el, card, prefix);
    return;
  }
  let wrap = root.querySelector(`:scope > .${prefix}-subagents`);
  if (!wrap) {
    wrap = root.ownerDocument.createElement('div');
    wrap.className = `${prefix}-subagents`;
  }
  placeWrapInTimeline(root, wrap, prefix);
  const tmp = root.ownerDocument.createElement('div');
  tmp.innerHTML = subagentCardHtml(card, prefix);
  const next = tmp.firstElementChild;
  if (!next) return;
  wrap.appendChild(next);
  syncLiveTurnOrder(root, prefix);
}
