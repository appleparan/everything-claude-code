#!/usr/bin/env node
/**
 * Tests for the omp simple-english extension logic
 * (content/targets/omp/extensions/simple-english/handler.cjs). The section text
 * itself comes from the pi prompt.cjs, which pi-simple-english.test.js covers.
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');

const extSrc = path.join(__dirname, '..', '..', 'content', 'targets', 'omp', 'extensions', 'simple-english');
const piSrc = path.join(__dirname, '..', '..', 'content', 'targets', 'pi', 'extensions', 'simple-english');

let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`  PASS  ${name}`);
    passed += 1;
  } catch (err) {
    console.error(`  FAIL  ${name}: ${err.message}`);
    failed += 1;
  }
}

// Lay the files out the way the installer does, so require('./prompt.cjs') resolves.
function makeAgentDir(withSkill) {
  const agent = fs.mkdtempSync(path.join(os.tmpdir(), 'ecc-omp-se-'));
  const ext = path.join(agent, 'extensions', 'simple-english');
  fs.mkdirSync(ext, { recursive: true });
  for (const f of ['handler.cjs', 'index.ts']) fs.copyFileSync(path.join(extSrc, f), path.join(ext, f));
  fs.copyFileSync(path.join(piSrc, 'prompt.cjs'), path.join(ext, 'prompt.cjs'));
  if (withSkill) {
    fs.mkdirSync(path.join(agent, 'skills', 'simple-english'), { recursive: true });
    fs.writeFileSync(path.join(agent, 'skills', 'simple-english', 'SKILL.md'), '---\nname: simple-english\n---\nSKILL BODY\n');
  }
  return { agent, ext };
}

test('index.ts uses the omp package type import and the shared handler', () => {
  const src = fs.readFileSync(path.join(extSrc, 'index.ts'), 'utf8');
  assert.ok(src.includes('import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";'));
  assert.ok(src.includes('before_agent_start'));
  assert.ok(!src.includes('systemPromptOptions'));
});

test('appends one section to the system prompt array without changing the input', () => {
  const { ext } = makeAgentDir(true);
  const { handleBeforeAgentStart } = require(path.join(ext, 'handler.cjs'));
  const input = ['base one', 'base two'];
  const res = handleBeforeAgentStart({ type: 'before_agent_start', prompt: 'x', systemPrompt: input }, ext);
  assert.strictEqual(res.systemPrompt.length, 3);
  assert.deepStrictEqual(res.systemPrompt.slice(0, 2), ['base one', 'base two']);
  assert.ok(res.systemPrompt[2].includes('SKILL BODY'));
  assert.ok(!res.systemPrompt[2].includes('name: simple-english'));
  assert.strictEqual(input.length, 2);
});

test('resolves the skill from <ext>/../../skills/simple-english/SKILL.md', () => {
  const { agent, ext } = makeAgentDir(true);
  const { skillFilePath } = require(path.join(ext, 'handler.cjs'));
  assert.strictEqual(skillFilePath(ext), path.join(agent, 'skills', 'simple-english', 'SKILL.md'));
});

test('does not add the section twice', () => {
  const { ext } = makeAgentDir(true);
  const { handleBeforeAgentStart } = require(path.join(ext, 'handler.cjs'));
  const first = handleBeforeAgentStart({ systemPrompt: ['base'] }, ext);
  assert.strictEqual(handleBeforeAgentStart({ systemPrompt: first.systemPrompt }, ext), undefined);
});

test('missing skill gives the fallback section', () => {
  const { ext } = makeAgentDir(false);
  const { handleBeforeAgentStart } = require(path.join(ext, 'handler.cjs'));
  const res = handleBeforeAgentStart({ systemPrompt: [] }, ext);
  assert.ok(res.systemPrompt[0].includes('ASD-STE100'));
});

test('never throws on a bad event or a failing builder', () => {
  const { ext } = makeAgentDir(true);
  const { handleBeforeAgentStart } = require(path.join(ext, 'handler.cjs'));
  assert.doesNotThrow(() => handleBeforeAgentStart(undefined, ext));
  assert.doesNotThrow(() => handleBeforeAgentStart(null, ext));
  const res = handleBeforeAgentStart({}, ext);
  assert.strictEqual(res.systemPrompt.length, 1);
  const boom = () => { throw new Error('boom'); };
  assert.strictEqual(handleBeforeAgentStart({ systemPrompt: [] }, ext, boom), undefined);
});

console.log(`\nPassed: ${passed}`);
console.log(`Failed: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
