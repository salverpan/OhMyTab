import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const panel = readFileSync(resolve(root, 'src/sidepanel/panel.js'), 'utf8');
const executor = readFileSync(resolve(root, 'src/lib/chat-executor.js'), 'utf8');

function functionBody(source, name) {
  const match = new RegExp(`(?:async\\s+)?function\\s+${name}\\([^)]*\\)\\s*\\{`).exec(source);
  assert.ok(match, `missing function ${name}`);
  const open = match.index + match[0].lastIndexOf('{');
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === '{') depth++;
    if (source[i] === '}' && --depth === 0) return source.slice(open + 1, i);
  }
  assert.fail(`unterminated function ${name}`);
}

const switchBody = functionBody(panel, 'applyProjectNow');
assert.doesNotMatch(switchBody, /stopChat\s*\(/, 'switching projects must not stop the active run');
assert.doesNotMatch(switchBody, /\.abort\s*\(/, 'switching projects must not abort the active run');
assert.doesNotMatch(switchBody, /resetChatRuntimeState\s*\(/, 'switching projects must preserve per-project runtime state');
assert.match(switchBody, /adoptVisible\(oldRun\)/, 'switch must snapshot the project being left');
assert.match(switchBody, /loadChatSession\(id\)/, 'switch must bind the destination project session');

const sendBody = functionBody(panel, 'sendChatMessage');
assert.match(sendBody, /const run = opts\.run \|\| ensureRun\(currentProject\)/);
assert.match(sendBody, /getProjectConfig\(run\.pid\)/, 'API config must be fixed to the originating project');
assert.match(sendBody, /buildMessagesForApi\(text, turnAttachments, run\)/);
assert.match(sendBody, /ctx,\s*signal,/, 'tool execution must receive the per-project context');
assert.doesNotMatch(sendBody, /ctx:\s*toolCtx/, 'tool execution must not use the visible project global context');

assert.match(panel, /tabOwner:\s*`chat:\$\{run\.pid\}`/, 'AI-opened tabs must be owned per project');
assert.match(executor, /ctx\.subagentOwner \|\| ctx\.tabOwner \|\| 'chat'/);
assert.match(panel, /let projectSwitchChain = Promise\.resolve\(\)/, 'rapid project switches must be serialized');
assert.match(panel, /function runIsBusy\(run\)/, 'project list must expose background activity');

console.log('project-concurrency-smoke: 13 ok');
