#!/usr/bin/env node
/**
 * Tests for the pi simple-english extension logic (content/targets/pi/extensions/simple-english).
 */
const assert = require('assert');
const path = require('path');

const { stripFrontmatter, capText, buildSection, HEADER, FALLBACK } = require(
  path.join(__dirname, '..', '..', 'content', 'targets', 'pi', 'extensions', 'simple-english', 'prompt.cjs'));

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

const skill = (name, filePath) => ({ name, description: 'd', filePath, baseDir: '/x' });
const files = { '/a/SKILL.md': '---\nname: simple-english\n---\nBody A\n', '/b/SKILL.md': 'Body B' };
const read = (p) => files[p];

test('strips LF frontmatter', () => {
  assert.strictEqual(stripFrontmatter('---\nname: x\n---\nBody\n'), 'Body\n');
});
test('strips CRLF frontmatter', () => {
  assert.strictEqual(stripFrontmatter('---\r\nname: x\r\n---\r\nBody\r\n'), 'Body\r\n');
});
test('no frontmatter is unchanged', () => {
  assert.strictEqual(stripFrontmatter('# Title\n---\nmore\n'), '# Title\n---\nmore\n');
});
test('capText cuts to the limit and leaves short text alone', () => {
  assert.strictEqual(capText('abcdef', 3), 'abc');
  assert.strictEqual(capText('abc', 3), 'abc');
  assert.strictEqual(capText('a'.repeat(10000)).length, 9500);
});
test('section starts with the header and has no frontmatter', () => {
  const out = buildSection([skill('simple-english', '/a/SKILL.md')], read);
  assert.ok(out.startsWith(HEADER));
  assert.ok(out.includes('Body A'));
  assert.ok(!out.includes('name: simple-english'));
});
test('long skill is capped at 9500 and keeps the header', () => {
  const out = buildSection([skill('simple-english', '/c')], () => 'x'.repeat(20000));
  assert.strictEqual(out.length, 9500);
  assert.ok(out.startsWith(HEADER));
});
test('missing skill gives the fallback', () => {
  assert.strictEqual(buildSection([skill('other', '/b/SKILL.md')], read), FALLBACK);
  assert.strictEqual(buildSection([], read), FALLBACK);
  assert.strictEqual(buildSection(undefined, read), FALLBACK);
});
test('readFile throwing gives the fallback', () => {
  const boom = () => { throw new Error('ENOENT'); };
  assert.strictEqual(buildSection([skill('simple-english', '/a/SKILL.md')], boom), FALLBACK);
});
test('fallback has the header', () => {
  assert.ok(FALLBACK.startsWith(HEADER));
  assert.ok(FALLBACK.includes('ASD-STE100'));
});
test('picks the right skill among several', () => {
  const skills = [skill('other', '/b/SKILL.md'), skill('simple-english', '/a/SKILL.md')];
  const out = buildSection(skills, read);
  assert.ok(out.includes('Body A'));
  assert.ok(!out.includes('Body B'));
});

console.log(`\nPassed: ${passed}`);
console.log(`Failed: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
