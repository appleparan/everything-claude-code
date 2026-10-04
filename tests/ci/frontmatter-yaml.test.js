#!/usr/bin/env node
/**
 * Frontmatter in shipped markdown must parse as strict YAML. Claude Code
 * tolerates an unquoted value containing ": ", but pi (and other harnesses
 * using a strict YAML parser) rejects the whole file, so e.g. a broken agent
 * file makes the pi subagent tool fail.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const contentRoot = path.join(__dirname, '..', '..', 'content');

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

function markdownFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return markdownFiles(full);
    return entry.name.endsWith('.md') ? [full] : [];
  });
}

// A top-level `key: value` line whose plain (unquoted, non-flow, non-block)
// scalar contains ": " or " #" is invalid or silently truncated in YAML.
function badLines(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return [];
  return match[1].split(/\r?\n/).filter((line) => {
    const kv = line.match(/^[A-Za-z][\w-]*:\s+(.*)$/);
    if (!kv) return false;
    const value = kv[1];
    if (/^["'[{|>]/.test(value)) return false;
    return value.includes(': ') || value.includes(' #');
  });
}

test('badLines flags an unquoted ": " and accepts a quoted one', () => {
  assert.strictEqual(badLines('---\ndescription: a: b\n---\n').length, 1);
  assert.strictEqual(badLines('---\ndescription: "a: b"\n---\n').length, 0);
  assert.strictEqual(badLines('---\ntools: ["Read", "Grep"]\n---\n').length, 0);
});

for (const category of ['agents', 'commands', 'skills', 'targets']) {
  test(`content/${category} frontmatter values are valid YAML scalars`, () => {
    const offenders = markdownFiles(path.join(contentRoot, category)).flatMap((file) =>
      badLines(fs.readFileSync(file, 'utf8')).map(
        (line) => `${path.relative(contentRoot, file)}: ${line.slice(0, 80)}`));
    assert.deepStrictEqual(offenders, [], `quote these values:\n${offenders.join('\n')}`);
  });
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
