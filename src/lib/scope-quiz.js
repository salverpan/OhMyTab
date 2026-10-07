/**
 * 调研范围确认卡（AskUserQuestion 风格：一问一窗）。
 * 纯逻辑 + HTML 字符串，侧栏 / 浮动窗 / 阅读器共用。
 */

export const OTHER_LABEL = '其他';

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function clipHeader(s) {
  const t = String(s || '').trim();
  return t ? t.slice(0, 12) : '范围';
}

function isOtherLabel(label) {
  const t = String(label || '').trim();
  return t === OTHER_LABEL || /^other$/i.test(t);
}

export function normalizeScopeQuiz(args) {
  const incoming = args && args.questions;
  const raw = Array.isArray(incoming) ? incoming : (incoming && typeof incoming === 'object' ? [incoming] : []);
  const questions = raw.slice(0, 4).map((q) => {
    const options = (Array.isArray(q && q.options) ? q.options : [])
      .slice(0, 4)
      .map((o) => {
        if (typeof o === 'string') return { label: o.trim(), description: '', recommended: false };
        return {
          label: String((o && (o.label || o.title || o.text)) || '').trim(),
          description: String((o && o.description) || '').trim(),
          recommended: !!(o && o.recommended),
        };
      })
      .filter((o) => o.label && !isOtherLabel(o.label));
    return {
      header: clipHeader(q && q.header),
      question: String((q && q.question) || '').trim(),
      multiSelect: !!(q && (q.multiSelect || q.multi_select)),
      options,
    };
  }).filter((q) => q.question && q.options.length >= 2);

  return {
    questions,
    answers: questions.map(() => null),
    current: 0,
    locked: false,
    skipped: false,
    draft: null,
  };
}

export function answerText(answer) {
  if (!answer) return '';
  const labels = (answer.labels || []).filter((l) => !isOtherLabel(l));
  const custom = String(answer.custom || '').trim();
  const parts = [...labels];
  if (custom) parts.push(custom);
  return parts.join('、');
}

export function formatScopeBrief(quiz) {
  const lines = ['【调研简报】请严格按此范围执行，不要扩大对象或切片。'];
  for (let i = 0; i < quiz.questions.length; i++) {
    const q = quiz.questions[i];
    const text = answerText(quiz.answers[i]);
    if (!text) continue;
    lines.push(`${q.header}：${text}`);
  }
  return lines.join('\n');
}

export function formatScopeLockLine(quiz) {
  if (quiz.skipped) return '已跳过范围确认';
  const bits = quiz.questions
    .map((q, i) => answerText(quiz.answers[i]))
    .filter(Boolean);
  return bits.length ? `已锁定 · ${bits.join(' · ')}` : '已锁定范围';
}

export function ensureDraft(quiz) {
  if (quiz.locked) return quiz.draft;
  const i = quiz.current;
  if (quiz.draft && quiz.draft.index === i) return quiz.draft;
  const q = quiz.questions[i];
  const prev = quiz.answers[i];
  const labels = prev
    ? [...(prev.labels || [])]
    : (q.multiSelect ? q.options.filter((o) => o.recommended).map((o) => o.label) : []);
  quiz.draft = {
    index: i,
    labels,
    custom: prev ? String(prev.custom || '') : '',
    otherOpen: labels.some(isOtherLabel) || !!(prev && prev.custom),
  };
  return quiz.draft;
}

function commitDraft(quiz) {
  const draft = ensureDraft(quiz);
  const q = quiz.questions[quiz.current];
  const labels = [...new Set(draft.labels.filter(Boolean))];
  const custom = labels.some(isOtherLabel) ? String(draft.custom || '').trim() : '';
  if (q.multiSelect && labels.length === 0 && !custom) return false;
  if (!q.multiSelect && labels.length === 0 && !custom) return false;
  quiz.answers[quiz.current] = { labels, custom };
  quiz.draft = null;
  return true;
}

function advanceOrFinish(quiz) {
  const nextUnanswered = quiz.questions.findIndex((q, i) => i > quiz.current && !quiz.answers[i]);
  if (quiz.current < quiz.questions.length - 1) {
    quiz.current = nextUnanswered >= 0 ? nextUnanswered : quiz.current + 1;
    ensureDraft(quiz);
    return 'ok';
  }
  const allIn = quiz.questions.every((_, i) => answerText(quiz.answers[i]));
  if (!allIn) {
    const first = quiz.answers.findIndex((a, i) => !answerText(a) && i !== quiz.current);
    if (first >= 0) {
      quiz.current = first;
      ensureDraft(quiz);
      return 'ok';
    }
  }
  quiz.locked = true;
  quiz.skipped = false;
  quiz.current = quiz.questions.length;
  return 'complete';
}

/**
 * @returns {'ok'|'complete'|'noop'}
 */
export function applyScopeQuizAction(quiz, action) {
  if (!quiz || quiz.locked || !action) return 'noop';
  const q = quiz.questions[quiz.current];
  if (!q) return 'noop';
  const draft = ensureDraft(quiz);

  if (action.type === 'goto') {
    const idx = Number(action.index);
    if (idx < 0 || idx >= quiz.questions.length || idx === quiz.current) return 'noop';
    commitDraft(quiz);
    quiz.current = idx;
    quiz.draft = null;
    ensureDraft(quiz);
    return 'ok';
  }

  if (action.type === 'toggle') {
    if (!q.multiSelect) return 'noop';
    const label = String(action.label || '');
    const i = draft.labels.indexOf(label);
    if (i >= 0) draft.labels.splice(i, 1);
    else draft.labels.push(label);
    if (isOtherLabel(label)) draft.otherOpen = draft.labels.some(isOtherLabel);
    return 'ok';
  }

  if (action.type === 'select') {
    if (q.multiSelect) return 'noop';
    const label = String(action.label || '');
    if (isOtherLabel(label)) {
      draft.labels = [OTHER_LABEL];
      draft.otherOpen = true;
      return 'ok';
    }
    draft.labels = [label];
    draft.custom = '';
    draft.otherOpen = false;
    if (!commitDraft(quiz)) return 'noop';
    return advanceOrFinish(quiz);
  }

  if (action.type === 'other-submit') {
    const text = String(action.text || draft.custom || '').trim();
    if (!text) return 'noop';
    draft.custom = text;
    if (!draft.labels.some(isOtherLabel)) draft.labels.push(OTHER_LABEL);
    if (!commitDraft(quiz)) return 'noop';
    return advanceOrFinish(quiz);
  }

  if (action.type === 'confirm-multi') {
    if (!q.multiSelect) return 'noop';
    if (draft.labels.some(isOtherLabel) && !String(draft.custom || '').trim()) return 'noop';
    if (!commitDraft(quiz)) return 'noop';
    return advanceOrFinish(quiz);
  }

  return 'noop';
}

export function scopeQuizActionFromEvent(e) {
  const recap = e.target.closest('.scope-quiz-recap-row');
  if (recap) return { type: 'goto', index: Number(recap.dataset.idx) };

  const otherOk = e.target.closest('.scope-quiz-other-ok');
  if (otherOk) {
    const input = otherOk.closest('.scope-quiz')?.querySelector('.scope-quiz-other-input');
    return { type: 'other-submit', text: input ? input.value : '' };
  }

  const confirm = e.target.closest('.scope-quiz-confirm');
  if (confirm) return { type: 'confirm-multi' };

  const opt = e.target.closest('.scope-quiz-opt');
  if (opt) {
    const label = opt.dataset.label || '';
    return opt.classList.contains('multi')
      ? { type: 'toggle', label }
      : { type: 'select', label };
  }
  return null;
}

export function renderScopeQuizHtml(quiz, { compact = false } = {}) {
  if (!quiz || !quiz.questions || !quiz.questions.length) return '';
  const cls = `scope-quiz${compact ? ' compact' : ''}${quiz.locked ? ' is-locked' : ''}`;

  if (quiz.locked) {
    const skipped = quiz.skipped ? ' skipped' : '';
    return `<div class="${cls}"><div class="scope-quiz-locked${skipped}">${esc(formatScopeLockLine(quiz))}</div></div>`;
  }

  const recap = quiz.questions.map((q, i) => {
    if (i === quiz.current) return '';
    const text = answerText(quiz.answers[i]);
    if (!text && i > quiz.current) return '';
    const val = text || '未答';
    return `<button type="button" class="scope-quiz-recap-row" data-idx="${i}"><span class="scope-quiz-recap-h">${esc(q.header)}</span><span class="scope-quiz-recap-v">${esc(val)}</span></button>`;
  }).join('');

  const q = quiz.questions[quiz.current];
  const draft = ensureDraft(quiz);
  const total = quiz.questions.length;
  const opts = [...q.options, { label: OTHER_LABEL, description: compact ? '' : '自己注明' }];
  const optHtml = opts.map((o) => {
    const selected = draft.labels.includes(o.label);
    const multi = q.multiSelect ? ' multi' : '';
    const on = selected ? ' selected' : '';
    const desc = compact ? '' : (o.description ? `<span class="scope-quiz-opt-desc">${esc(o.description)}</span>` : '');
    return `<button type="button" class="scope-quiz-opt${multi}${on}" data-label="${esc(o.label)}"><span class="scope-quiz-opt-label">${esc(o.label)}</span>${desc}</button>`;
  }).join('');

  const otherOpen = draft.otherOpen;
  const otherHtml = otherOpen
    ? `<div class="scope-quiz-other"><input class="scope-quiz-other-input" type="text" maxlength="80" placeholder="请注明全称或补充约束" value="${esc(draft.custom)}"><button type="button" class="suggestion-confirm scope-quiz-other-ok">确认</button></div>`
    : '';

  const selectedCount = draft.labels.filter((l) => !isOtherLabel(l)).length
    + (draft.labels.some(isOtherLabel) && String(draft.custom || '').trim() ? 1 : 0);
  const confirmDisabled = selectedCount === 0 || (draft.labels.some(isOtherLabel) && !String(draft.custom || '').trim());
  const foot = q.multiSelect
    ? `<div class="scope-quiz-foot"><button type="button" class="suggestion-confirm scope-quiz-confirm"${confirmDisabled ? ' disabled' : ''}>${selectedCount > 0 ? `确认 ${selectedCount} 项` : '确认所选'}</button></div>`
    : '';

  return `<div class="${cls}">`
    + (recap ? `<div class="scope-quiz-recap">${recap}</div>` : '')
    + `<div class="scope-quiz-card">`
    + `<div class="scope-quiz-head"><span class="scope-quiz-header">${esc(q.header)}</span><span class="scope-quiz-progress">${quiz.current + 1}/${total}</span></div>`
    + `<div class="scope-quiz-q">${esc(q.question)}</div>`
    + `<div class="scope-quiz-opts">${optHtml}</div>`
    + otherHtml
    + foot
    + `</div></div>`;
}

export function attachScopeQuiz(host, quiz, { compact = false, onComplete, onUpdate } = {}) {
  if (!host) return;
  const paint = () => {
    host.innerHTML = renderScopeQuizHtml(quiz, { compact });
    const root = host.querySelector('.scope-quiz');
    if (!root || quiz.locked) return;
    const onEvent = (e) => {
      if (e.type === 'keydown' && e.key !== 'Enter') return;
      if (e.type === 'keydown') {
        const input = e.target.closest('.scope-quiz-other-input');
        if (!input) return;
        e.preventDefault();
        const result = applyScopeQuizAction(quiz, { type: 'other-submit', text: input.value });
        after(result);
        return;
      }
      const input = root.querySelector('.scope-quiz-other-input');
      if (input) ensureDraft(quiz).custom = input.value;
      const action = scopeQuizActionFromEvent(e);
      if (!action) return;
      e.preventDefault();
      const result = applyScopeQuizAction(quiz, action);
      after(result);
    };
    const after = (result) => {
      if (result === 'noop') return;
      onUpdate?.(quiz);
      if (result === 'complete') {
        host.innerHTML = renderScopeQuizHtml(quiz, { compact });
        onComplete?.(formatScopeBrief(quiz));
        return;
      }
      paint();
    };
    root.addEventListener('click', onEvent);
    root.addEventListener('keydown', onEvent);
    const input = root.querySelector('.scope-quiz-other-input');
    if (input) {
      input.addEventListener('input', () => {
        const draft = ensureDraft(quiz);
        draft.custom = input.value;
      });
      input.focus();
    }
  };
  paint();
}
