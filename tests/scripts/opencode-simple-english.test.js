#!/usr/bin/env node
/**
 * Tests for the OpenCode simple-english plugin
 * (content/targets/opencode/plugins/simple-english.js).
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { pathToFileURL } = require('url');

const pluginSrc = path.join(__dirname, '..', '..', 'content', 'targets', 'opencode', 'plugins', 'simple-english.js');
const HEADER_START = 'SIMPLE ENGLISH SKILL ACTIVE AUTOMATICALLY\n\n';
const MAX = 9500;

let passed = 0;
let failed = 0;
async function test(name, fn) {
  try {
    await fn();
    console.log(`  PASS  ${name}`);
    passed += 1;
  } catch (err) {
    console.error(`  FAIL  ${name}: ${err.stack || err.message}`);
    failed += 1;
  }
}

// Builds <tmp>/plugins/simple-english.js (ESM) and, when skill is a string,
// <tmp>/skills/simple-english/SKILL.md. Returns the pushed system strings.
async function run(skill) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ecc-oc-plugin-'));
  fs.writeFileSync(path.join(tmp, 'package.json'), '{"type":"module"}');
  fs.mkdirSync(path.join(tmp, 'plugins'));
  const dest = path.join(tmp, 'plugins', 'simple-english.js');
  fs.copyFileSync(pluginSrc, dest);
  if (typeof skill === 'string') {
    fs.mkdirSync(path.join(tmp, 'skills', 'simple-english'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'skills', 'simple-english', 'SKILL.md'), skill);
  }
  const mod = await import(pathToFileURL(dest).href);
  assert.deepStrictEqual(Object.keys(mod), ['SimpleEnglish']);
  const hooks = await mod.SimpleEnglish({});
  const output = { system: [] };
  await hooks['experimental.chat.system.transform']({}, output);
  return output.system;
}

async function main() {
  await test('pushes one string with the header and the body, without frontmatter', async () => {
    const sys = await run('---\nname: simple-english\ndescription: X\n---\n# Rules\n\nUse short sentences.\n');
    assert.strictEqual(sys.length, 1);
    assert.ok(sys[0].startsWith(HEADER_START), sys[0]);
    assert.ok(sys[0].includes('Use short sentences.'));
    assert.ok(!sys[0].includes('name: simple-english'));
    assert.ok(!sys[0].includes('description: X'));
  });

  await test('strips CRLF frontmatter', async () => {
    const sys = await run('---\r\nname: a\r\n---\r\nBody text\r\n');
    assert.ok(sys[0].includes('Body text'));
    assert.ok(!sys[0].includes('name: a'));
  });

  await test('strips frontmatter after a UTF-8 BOM', async () => {
    const sys = await run('\uFEFF---\nname: a\n---\nBody text\n');
    assert.ok(sys[0].includes('Body text'));
    assert.ok(!sys[0].includes('name: a'));
  });

  await test('strips frontmatter whose closing fence has trailing spaces', async () => {
    const sys = await run('---\nname: a\n---  \nBody text\n');
    assert.ok(sys[0].includes('Body text'));
    assert.ok(!sys[0].includes('name: a'));
  });

  await test('caps a huge body', async () => {
    const sys = await run(`---\nname: a\n---\n${'x'.repeat(50000)}\n`);
    assert.strictEqual(sys.length, 1);
    assert.ok(sys[0].length <= MAX, `length ${sys[0].length}`);
  });

  await test('uses the fallback text when SKILL.md is absent', async () => {
    const sys = await run(null);
    assert.strictEqual(sys.length, 1);
    assert.ok(sys[0].startsWith(HEADER_START));
    assert.ok(sys[0].includes('ASD-STE100 Simplified Technical English'), sys[0]);
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exitCode = failed > 0 ? 1 : 0;
}

main();
