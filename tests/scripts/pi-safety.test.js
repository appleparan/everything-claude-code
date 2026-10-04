#!/usr/bin/env node
/**
 * Tests for the pi ecc-safety extension policy (content/targets/pi/extensions/ecc-safety).
 */
const assert = require('assert');
const path = require('path');

const { classifyBash, isBlockedDocWrite, extractPrUrl, isPrCreate } = require(
  path.join(__dirname, '..', '..', 'content', 'targets', 'pi', 'extensions', 'ecc-safety', 'policy.cjs'));

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

const destructive = [
  'rm -rf node_modules', 'rm -r dir', 'rm -fr dir', 'rm -R dir', 'rm --recursive dir',
  'rm -f -r dir', 'cd x && rm -rf y',
  'sudo apt install x', 'chmod 777 file', 'chmod -R 777 .', 'chown 777 f',
  'git push --force', 'git push -f origin main', 'git push origin main --force', 'git push -fu origin x',
  'git reset --hard HEAD~1', 'git clean -fd', 'git clean -f', 'git clean --force',
  'git worktree remove --force wt', 'git worktree remove -f wt',
  'git branch -D feat', 'git commit --no-verify -m x', 'git push --no-verify',
  'echo "--no-verify"',
];
const allowed = [
  'rm file', 'rm -f file', 'ls -la', 'chmod 755 f', 'git status', 'git push --force-with-lease',
  'git push origin main', 'git reset --soft HEAD~1', 'git reset HEAD file', 'git clean -n',
  'git worktree remove wt', 'git branch -d feat', 'git branch', 'git log --oneline', '',
  'echo transform', 'git commit -m "fix: rm docs"',
];

for (const c of destructive) {
  test(`destructive: ${c}`, () => assert.strictEqual(classifyBash(c).kind, 'destructive'));
}
for (const c of allowed) {
  test(`not destructive: "${c}"`, () => assert.notStrictEqual(classifyBash(c).kind, 'destructive'));
}

test('plain push is a push reminder', () => {
  assert.strictEqual(classifyBash('git push origin main').kind, 'push');
  assert.strictEqual(classifyBash('git push --force-with-lease').kind, 'push');
});
test('non-push is ok', () => assert.strictEqual(classifyBash('git status').kind, 'ok'));
test('destructive verdict carries a reason', () => {
  assert.strictEqual(classifyBash('git reset --hard').reason, 'git reset --hard');
});
test('force push inside a chain is still caught', () => {
  assert.strictEqual(classifyBash('git add . && git push -f').kind, 'destructive');
});
test('push followed by unrelated -f flag is not force', () => {
  assert.notStrictEqual(classifyBash('git push origin main && ls -f').kind, 'destructive');
});

for (const f of ['README.md', 'CLAUDE.md', 'AGENTS.md', 'CONTRIBUTING.md', 'IMPLEMENTATION_PLAN.md',
  'SKILL.md', 'docs/sub/SKILL.md', '/abs/path/README.md']) {
  test(`doc allowed: ${f}`, () => assert.strictEqual(isBlockedDocWrite(f, false), false));
}
for (const f of ['notes.md', 'docs/summary.md', 'todo.txt', 'a/b/FINDINGS.md', 'README.md.txt', 'xREADME.md']) {
  test(`doc blocked when new: ${f}`, () => assert.strictEqual(isBlockedDocWrite(f, false), true));
}
test('doc not blocked when file already exists', () => assert.strictEqual(isBlockedDocWrite('notes.md', true), false));
test('non-doc files not blocked', () => {
  assert.strictEqual(isBlockedDocWrite('src/a.ts', false), false);
  assert.strictEqual(isBlockedDocWrite('', false), false);
});

test('extractPrUrl finds the URL in gh output', () => {
  assert.strictEqual(extractPrUrl('Creating pull request...\nhttps://github.com/acme/repo/pull/42\n'),
    'https://github.com/acme/repo/pull/42');
});
test('extractPrUrl returns null without a PR URL', () => {
  assert.strictEqual(extractPrUrl('https://github.com/acme/repo/issues/1'), null);
  assert.strictEqual(extractPrUrl(''), null);
  assert.strictEqual(extractPrUrl(undefined), null);
});
test('isPrCreate matches gh pr create only', () => {
  assert.ok(isPrCreate('gh pr create --title x'));
  assert.ok(!isPrCreate('gh pr view 1'));
  assert.ok(!isPrCreate('echo hi'));
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
