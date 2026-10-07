import assert from 'node:assert/strict';
import { initTextEditor, execTextTool, textOf, dropTextSession } from '../src/lib/doc-edit-text.js';
import { normalizeThemeMode, resolveTheme } from '../src/lib/theme.js';
import { isUploadDocName, UPLOAD_DOC_EXTS } from '../src/lib/doc-kind.js';

const id = 't1';
initTextEditor(id, 'hello world');
assert.equal(execTextTool(id, 'replace_text', { find: 'world', replace: 'txt' }).ok, true);
assert.equal(textOf(id), 'hello txt');
assert.equal(execTextTool(id, 'replace_text', { find: 'missing' }).ok, false);
assert.equal(execTextTool(id, 'insert_text', { text: 'line2' }).ok, true);
assert.equal(textOf(id), 'hello txt\nline2');
assert.equal(execTextTool(id, 'undo').ok, true);
assert.equal(textOf(id), 'hello txt');
assert.equal(execTextTool(id, 'set_range').ok, false);
dropTextSession(id);

assert.equal(normalizeThemeMode('dark'), 'dark');
assert.equal(normalizeThemeMode('nope'), 'auto');
assert.ok(resolveTheme('light') === 'light');
assert.ok(resolveTheme('dark') === 'dark');

for (const ext of ['xls', 'xlsx', 'txt', 'doc']) {
  assert.equal(isUploadDocName('a.' + ext), true, ext);
}
assert.ok(UPLOAD_DOC_EXTS.includes('xls'));

console.log('doc-text-smoke ok');
