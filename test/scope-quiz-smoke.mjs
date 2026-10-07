/* 调研范围确认卡纯逻辑冒烟（node test/scope-quiz-smoke.mjs）。不碰 chrome.*。 */

import assert from 'node:assert';
import {
  normalizeScopeQuiz, applyScopeQuizAction, formatScopeBrief, formatScopeLockLine,
  answerText, OTHER_LABEL,
} from '../src/lib/scope-quiz.js';
import { CHAT_TOOLS } from '../src/lib/tools.js';
import { PARENT_ONLY_TOOLS } from '../src/lib/subagent-policy.js';

let passed = 0;
function ok(cond, label) {
  assert.ok(cond, label);
  passed += 1;
}

ok(CHAT_TOOLS.some((t) => t.function.name === 'ask_research_scope'), 'CHAT_TOOLS 含 ask_research_scope');
ok(PARENT_ONLY_TOOLS.has('ask_research_scope'), '父级专属含 ask_research_scope');

const quiz = normalizeScopeQuiz({
  questions: [
    {
      header: '对象',
      question: '航升是哪一个？',
      options: [
        { label: '深圳航升航空科技', description: '无人机' },
        { label: '另一家同名公司', description: '非航空' },
        { label: '其他' },
      ],
    },
    {
      header: '覆盖面',
      question: '查哪些面？',
      multiSelect: true,
      options: [
        { label: '产品与型号', recommended: true },
        { label: '股权融资', recommended: true },
        { label: '竞品对照' },
      ],
    },
  ],
});
ok(quiz.questions.length === 2, '两题');
ok(quiz.questions[0].options.every((o) => o.label !== OTHER_LABEL), '其他不进 options');
ok(quiz.questions[1].options.filter((o) => o.recommended).length === 2, '多选预勾');

ok(applyScopeQuizAction(quiz, { type: 'select', label: OTHER_LABEL }) === 'ok', '点其他不翻页');
ok(quiz.current === 0 && quiz.draft.otherOpen, '其他展开输入');
ok(applyScopeQuizAction(quiz, { type: 'other-submit', text: '  ' }) === 'noop', '空其他不提交');
ok(applyScopeQuizAction(quiz, { type: 'select', label: '深圳航升航空科技' }) === 'ok', '单选翻到下一题');
ok(quiz.current === 1, '当前第 2 题');
ok(answerText(quiz.answers[0]) === '深圳航升航空科技', '第 1 题已记');

ok(quiz.draft.labels.includes('产品与型号') && quiz.draft.labels.includes('股权融资'), '推荐项预勾');
ok(applyScopeQuizAction(quiz, { type: 'toggle', label: '竞品对照' }) === 'ok', '多选追加');
ok(applyScopeQuizAction(quiz, { type: 'confirm-multi' }) === 'complete', '最后一题确认完成');
ok(quiz.locked && !quiz.skipped, '已锁定');
ok(formatScopeBrief(quiz).includes('【调研简报】') && formatScopeBrief(quiz).includes('深圳航升航空科技'), '简报含对象');
ok(formatScopeLockLine(quiz).startsWith('已锁定 · '), '锁定条');

const q2 = normalizeScopeQuiz({ questions: [{ question: '只有一题？', options: ['A'] }] });
ok(q2.questions.length === 0, '少于 2 选项丢弃');

const q3 = normalizeScopeQuiz({
  questions: { question: '航升是哪一个？', options: [{ label: '深圳航升' }, { label: '其他公司' }] },
});
ok(q3.questions.length === 1 && q3.questions[0].options.length === 2, '单题对象也归一化');

console.log(`scope-quiz-smoke: ${passed} ok`);
