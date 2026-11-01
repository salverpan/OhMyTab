import assert from 'node:assert/strict';
import {
  inferUiLocale,
  inferTargetLanguage,
  resolveTargetLanguage,
  isAutoTargetLanguage,
} from '../src/lib/locale.js';

assert.equal(inferUiLocale('zh-CN'), 'zh');
assert.equal(inferUiLocale('zh-TW'), 'zh');
assert.equal(inferUiLocale('en-US'), 'en');
assert.equal(inferUiLocale('ja-JP'), 'en');

assert.equal(inferTargetLanguage('zh-CN'), 'zh-Hans');
assert.equal(inferTargetLanguage('zh-TW'), 'zh-Hant');
assert.equal(inferTargetLanguage('zh-HK'), 'zh-Hant');
assert.equal(inferTargetLanguage('en-GB'), 'en');
assert.equal(inferTargetLanguage('ja'), 'ja');
assert.equal(inferTargetLanguage('pt-BR'), 'pt');
assert.equal(inferTargetLanguage('uk-UA'), 'en');

assert.equal(resolveTargetLanguage('auto', 'en-US'), 'en');
assert.equal(resolveTargetLanguage('', 'zh-CN'), 'zh-Hans');
assert.equal(resolveTargetLanguage('ja', 'en-US'), 'ja');
assert.equal(isAutoTargetLanguage('auto'), true);
assert.equal(isAutoTargetLanguage('zh-Hans'), false);

console.log('locale-smoke ok');
