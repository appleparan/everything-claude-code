#!/usr/bin/env node
/**
 * Tests for the `-p` (prune orphans) option in targets/{claude,codex}/install.sh,
 * and the shared scripts/lib/prune.sh manifest/prune helpers.
 *
 * Fixtures are self-contained copies of scripts/ + targets/ plus a minimal
 * fabricated content/ tree, built fresh per test in a temp dir so the real
 * repo and content/ tree are never touched.
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawnSync } = require('child_process');

const repoRoot = path.join(__dirname, '..', '..');
const gitDir = path.dirname(spawnSync('which', ['git'], { encoding: 'utf8' }).stdout.trim() || '/usr/bin/git');
const PATH_WITH_GIT = `${gitDir}:/usr/bin:/bin`;

const GLOBAL_MD = '# Global\n\nGlobal instructions.\n';
const PLANNER_MD = '# Planner\n\nPlan things.\n';
const NODE_REVIEWER_MD = '# Node Reviewer\n\nReview node code.\n';
const CODING_STYLE_MD = '# Coding Style\n\nBe consistent.\n';
const NODE_STYLE_MD = '# Node Style\n\nUse node style.\n';
const EXAMPLE_SKILL_MD = '---\nname: example-skill\n---\n# Example\n';
const NODE_SKILL_MD = '---\nname: node-skill\n---\n# Node Skill\n';
const SERVERS_JSON = JSON.stringify({ mcpServers: {} }, null, 2) + '\n';

function writeFixtureContent(dir) {
  const w = (rel, content) => {
    const full = path.join(dir, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  };
  w('content/instructions/global.md', GLOBAL_MD);
  w('content/agents/common/planner.md', PLANNER_MD);
  w('content/agents/node/node-reviewer.md', NODE_REVIEWER_MD);
  w('content/rules/common/coding-style.md', CODING_STYLE_MD);
  w('content/rules/node/node-style.md', NODE_STYLE_MD);
  w('content/skills/common/example-skill/SKILL.md', EXAMPLE_SKILL_MD);
  w('content/skills/node/node-skill/SKILL.md', NODE_SKILL_MD);
  w('content/mcp/servers.json', SERVERS_JSON);
}

/** A plain (non-git) fixture repo copy: scripts/ + targets/ + minimal content/. */
function buildPlainRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ecc-prune-plain-'));
  fs.cpSync(path.join(repoRoot, 'scripts'), path.join(dir, 'scripts'), { recursive: true });
  fs.cpSync(path.join(repoRoot, 'targets'), path.join(dir, 'targets'), { recursive: true });
  writeFixtureContent(dir);
  return dir;
}

function git(args, cwd) {
  const res = spawnSync('git', args, { cwd, encoding: 'utf8', env: { ...process.env, PATH: PATH_WITH_GIT } });
  if (res.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${res.stderr}`);
  }
  return res.stdout.trim();
}

/**
 * A git-history fixture: same content as buildPlainRepo, committed, then a
 * second commit that deletes content/agents/node/node-reviewer.md and
 * content/skills/node/node-skill/ (so their deletion is real git history).
 * HEAD ends on the post-deletion commit.
 */
function buildGitRepo() {
  const dir = buildPlainRepo();
  git(['init', '-b', 'main'], dir);
  git(['config', 'user.email', 'test@example.com'], dir);
  git(['config', 'user.name', 'Test User'], dir);
  git(['add', '-A'], dir);
  git(['commit', '-m', 'initial content'], dir);
  git(['rm', '-r', '--quiet', 'content/agents/node/node-reviewer.md', 'content/skills/node/node-skill'], dir);
  git(['commit', '-m', 'remove node-reviewer agent and node-skill'], dir);
  return dir;
}

function mkHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ecc-prune-home-'));
}

function runInstall(repoDir, args, home, extraEnv = {}) {
  const installSh = path.join(repoDir, 'scripts', 'install.sh');
  const env = {
    ...process.env,
    HOME: home,
    PATH: PATH_WITH_GIT,
    ...extraEnv
  };
  delete env.CODEX_HOME;
  Object.assign(env, extraEnv);
  return spawnSync('bash', [installSh, ...args], { env, encoding: 'utf8' });
}

function runInstallWithStdin(repoDir, args, home, stdin, extraEnv = {}) {
  const installSh = path.join(repoDir, 'scripts', 'install.sh');
  const env = {
    ...process.env,
    HOME: home,
    PATH: PATH_WITH_GIT,
    ...extraEnv
  };
  delete env.CODEX_HOME;
  Object.assign(env, extraEnv);
  return spawnSync('bash', [installSh, ...args], { env, encoding: 'utf8', input: stdin });
}

function manifestPath(home, sub) {
  return path.join(home, sub, '.ecc-manifest');
}

function readManifestLines(p) {
  return fs.readFileSync(p, 'utf8').split('\n').filter((l) => l.length > 0);
}

function writeManifest(p, entries) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const body = ['# everything-claude-code manifest v1', ...entries.map((e) => `${e[0]}\t${e[1]}`)];
  fs.writeFileSync(p, body.join('\n') + '\n');
}

let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`  PASS  ${name}`);
    passed += 1;
  } catch (err) {
    console.error(`  FAIL  ${name}: ${err.stack || err.message}`);
    failed += 1;
  }
}

// ---------------------------------------------------------------------------
// 1. Manifest is written with expected entries; CLAUDE.md/settings.json absent
// ---------------------------------------------------------------------------
test('install writes .ecc-manifest with expected lang\\tpath entries', () => {
  const repo = buildPlainRepo();
  const home = mkHome();
  const res = runInstall(repo, ['--target', 'claude', '-f', 'common', 'node'], home);
  assert.strictEqual(res.status, 0, res.stderr);

  const mp = manifestPath(home, '.claude');
  assert.ok(fs.existsSync(mp), '.ecc-manifest was not written');
  const lines = readManifestLines(mp);
  assert.strictEqual(lines[0], '# everything-claude-code manifest v1');

  const expected = [
    'common\tagents/planner.md',
    'node\tagents/node-reviewer.md',
    'common\trules/coding-style.md',
    'node\trules/node-style.md',
    'common\tskills/example-skill',
    'node\tskills/node-skill'
  ];
  for (const e of expected) {
    assert.ok(lines.includes(e), `missing manifest entry: ${e}`);
  }
  assert.ok(!lines.some((l) => l.includes('CLAUDE.md')), 'CLAUDE.md must never be recorded');
  assert.ok(!lines.some((l) => l.includes('settings.json')), 'settings.json must never be recorded');
});

// ---------------------------------------------------------------------------
// 2. Removing a content file: -p prunes it, without -p it survives with a hint
// ---------------------------------------------------------------------------
test('reinstall with -f -p removes an orphaned dest and its manifest entry', () => {
  const repo = buildPlainRepo();
  const home1 = mkHome();
  let res = runInstall(repo, ['--target', 'claude', '-f', 'common', 'node'], home1);
  assert.strictEqual(res.status, 0, res.stderr);
  assert.ok(fs.existsSync(path.join(home1, '.claude', 'agents', 'node-reviewer.md')));

  const home2 = mkHome();
  fs.cpSync(home1, home2, { recursive: true });

  fs.rmSync(path.join(repo, 'content', 'agents', 'node', 'node-reviewer.md'));

  res = runInstall(repo, ['--target', 'claude', '-f', '-p', 'common', 'node'], home2);
  assert.strictEqual(res.status, 0, res.stderr);
  assert.ok(!fs.existsSync(path.join(home2, '.claude', 'agents', 'node-reviewer.md')),
    'orphaned dest should have been removed');

  const lines = readManifestLines(manifestPath(home2, '.claude'));
  assert.ok(!lines.some((l) => l === 'node\tagents/node-reviewer.md'),
    'pruned entry must not survive in the new manifest');
});

test('reinstall without -p keeps the orphan and prints an INFO hint', () => {
  const repo = buildPlainRepo();
  const home1 = mkHome();
  let res = runInstall(repo, ['--target', 'claude', '-f', 'common', 'node'], home1);
  assert.strictEqual(res.status, 0, res.stderr);

  const home3 = mkHome();
  fs.cpSync(home1, home3, { recursive: true });

  fs.rmSync(path.join(repo, 'content', 'agents', 'node', 'node-reviewer.md'));

  res = runInstall(repo, ['--target', 'claude', '-f', 'common', 'node'], home3);
  assert.strictEqual(res.status, 0, res.stderr);
  assert.ok(fs.existsSync(path.join(home3, '.claude', 'agents', 'node-reviewer.md')),
    'orphaned dest must survive without -p');
  assert.ok(/orphaned file\(s\) from previous installs detected/.test(res.stdout),
    'expected INFO hint about orphans');
  assert.ok(/re-run with -p/.test(res.stdout), 'expected hint to mention -p');
});

test('an orphan reported without -p stays in the manifest and is prunable by a later -p run', () => {
  const repo = buildPlainRepo();
  const home = mkHome();
  let res = runInstall(repo, ['--target', 'claude', '-f', 'common', 'node'], home);
  assert.strictEqual(res.status, 0, res.stderr);

  fs.rmSync(path.join(repo, 'content', 'agents', 'node', 'node-reviewer.md'));

  // First reinstall without -p: hint only, but the orphan's manifest entry
  // must survive so a later -p run can still find it.
  res = runInstall(repo, ['--target', 'claude', '-f', 'common', 'node'], home);
  assert.strictEqual(res.status, 0, res.stderr);
  const lines = readManifestLines(manifestPath(home, '.claude'));
  assert.ok(lines.includes('node\tagents/node-reviewer.md'),
    'unpruned orphan entry must survive a run without -p');

  res = runInstall(repo, ['--target', 'claude', '-f', '-p', 'common', 'node'], home);
  assert.strictEqual(res.status, 0, res.stderr);
  assert.ok(!fs.existsSync(path.join(home, '.claude', 'agents', 'node-reviewer.md')),
    'later -p run must still prune the orphan');
  const lines2 = readManifestLines(manifestPath(home, '.claude'));
  assert.ok(!lines2.includes('node\tagents/node-reviewer.md'),
    'pruned entry must not survive in the new manifest');
});

// ---------------------------------------------------------------------------
// 3. -p -n lists but never deletes, and leaves the manifest untouched
// ---------------------------------------------------------------------------
test('-p -n lists the orphan (dry run) but deletes nothing and leaves manifest unchanged', () => {
  const repo = buildPlainRepo();
  const home = mkHome();
  const claudeDir = path.join(home, '.claude');
  fs.mkdirSync(path.join(claudeDir, 'agents'), { recursive: true });
  fs.writeFileSync(path.join(claudeDir, 'agents', 'ghost.md'), '# Ghost\n');
  const mp = manifestPath(home, '.claude');
  writeManifest(mp, [['common', 'agents/ghost.md'], ['common', 'agents/planner.md']]);
  const before = fs.readFileSync(mp, 'utf8');

  const res = runInstall(repo, ['--target', 'claude', '-n', '-p', 'common'], home);
  assert.strictEqual(res.status, 0, res.stderr);
  assert.ok(res.stdout.includes('ghost.md'), 'expected ghost.md to be listed as an orphan candidate');
  assert.ok(fs.existsSync(path.join(claudeDir, 'agents', 'ghost.md')), 'dry run must not delete the file');
  assert.strictEqual(fs.readFileSync(mp, 'utf8'), before, 'manifest must be untouched on dry run');
});

// ---------------------------------------------------------------------------
// 4. A user's own untracked file survives -p
// ---------------------------------------------------------------------------
test("a user's own file (not in the manifest) survives -p", () => {
  const repo = buildPlainRepo();
  const home = mkHome();
  const claudeDir = path.join(home, '.claude');
  fs.mkdirSync(path.join(claudeDir, 'agents'), { recursive: true });
  fs.writeFileSync(path.join(claudeDir, 'agents', 'my-own-notes.md'), '# My notes\n');
  writeManifest(manifestPath(home, '.claude'), [['common', 'agents/planner.md']]);

  const res = runInstall(repo, ['--target', 'claude', '-f', '-p', 'common'], home);
  assert.strictEqual(res.status, 0, res.stderr);
  assert.ok(fs.existsSync(path.join(claudeDir, 'agents', 'my-own-notes.md')),
    "a file absent from the manifest must never be pruned");
});

// ---------------------------------------------------------------------------
// 5. Entries for a language not passed this run survive (carried over)
// ---------------------------------------------------------------------------
test('manifest entries for an unselected language are carried over, not pruned', () => {
  const repo = buildPlainRepo();
  const home = mkHome();
  writeManifest(manifestPath(home, '.claude'), [['python', 'agents/py-agent.md']]);

  const res = runInstall(repo, ['--target', 'claude', '-f', '-p', 'common'], home);
  assert.strictEqual(res.status, 0, res.stderr);
  const lines = readManifestLines(manifestPath(home, '.claude'));
  assert.ok(lines.includes('python\tagents/py-agent.md'),
    'entry for a language not installed this run must be carried over');
});

// ---------------------------------------------------------------------------
// 6. A dest that moved between languages is not pruned
// ---------------------------------------------------------------------------
test('a dest that moved from one language to another is not pruned', () => {
  const repo = buildPlainRepo();
  const home = mkHome();
  const claudeDir = path.join(home, '.claude');
  fs.mkdirSync(path.join(claudeDir, 'agents'), { recursive: true });
  fs.writeFileSync(path.join(claudeDir, 'agents', 'shared-tool.md'), '# old content\n');
  writeManifest(manifestPath(home, '.claude'), [
    ['node', 'agents/shared-tool.md'],
    ['common', 'agents/planner.md']
  ]);

  fs.writeFileSync(path.join(repo, 'content', 'agents', 'common', 'shared-tool.md'), '# now common\n');

  const res = runInstall(repo, ['--target', 'claude', '-f', '-p', 'common', 'node'], home);
  assert.strictEqual(res.status, 0, res.stderr);
  assert.ok(fs.existsSync(path.join(claudeDir, 'agents', 'shared-tool.md')),
    'dest must survive because it is still installed this run (now via common)');
  assert.strictEqual(
    fs.readFileSync(path.join(claudeDir, 'agents', 'shared-tool.md'), 'utf8'),
    '# now common\n',
    'dest should have been overwritten by the common source'
  );
  const lines = readManifestLines(manifestPath(home, '.claude'));
  assert.ok(lines.includes('common\tagents/shared-tool.md'), 'new manifest must record it under common');
});

// ---------------------------------------------------------------------------
// 7. Git-history fallback: no manifest + -p
// ---------------------------------------------------------------------------
test('fallback: verified historical file is listed and deleted on y; modified copy is kept', () => {
  const repo = buildGitRepo();
  const home = mkHome();
  const claudeDir = path.join(home, '.claude');
  fs.mkdirSync(path.join(claudeDir, 'agents'), { recursive: true });
  fs.mkdirSync(path.join(claudeDir, 'skills', 'node-skill'), { recursive: true });

  // Byte-identical to the historical content/agents/node/node-reviewer.md -> verified.
  fs.writeFileSync(path.join(claudeDir, 'agents', 'node-reviewer.md'), NODE_REVIEWER_MD);
  // Locally modified relative to the historical content/skills/node/node-skill/ -> not verified.
  fs.writeFileSync(path.join(claudeDir, 'skills', 'node-skill', 'SKILL.md'), NODE_SKILL_MD + '\nlocal edits\n');
  // No manifest present: exercises the git-history fallback path.
  assert.ok(!fs.existsSync(manifestPath(home, '.claude')));

  const res = runInstallWithStdin(repo, ['--target', 'claude', '-f', '-p', 'common', 'node'], home, 'y\n');
  assert.strictEqual(res.status, 0, res.stderr);
  assert.ok(res.stdout.includes('node-reviewer.md'), 'expected verified candidate to be listed');
  assert.ok(!fs.existsSync(path.join(claudeDir, 'agents', 'node-reviewer.md')),
    'verified candidate should be deleted after confirming with y');

  assert.ok(/not verified/i.test(res.stdout), 'expected the modified skill dir to be reported as not verified');
  assert.ok(fs.existsSync(path.join(claudeDir, 'skills', 'node-skill', 'SKILL.md')),
    'locally modified directory must never be deleted by the fallback');
});

test('fallback with git unavailable/non-git REPO_ROOT: warns and skips, no crash', () => {
  const repo = buildPlainRepo(); // not a git repo
  const home = mkHome();
  const res = runInstall(repo, ['--target', 'claude', '-f', '-p', 'common'], home);
  assert.strictEqual(res.status, 0, res.stderr);
  assert.ok(fs.existsSync(manifestPath(home, '.claude')), 'manifest should still be written after fallback skip');
});

// ---------------------------------------------------------------------------
// 8. Codex target manifest + prune
// ---------------------------------------------------------------------------
test('codex target writes a manifest and prunes an orphaned skill with -f -p', () => {
  const repo = buildPlainRepo();
  const codexHome1 = fs.mkdtempSync(path.join(os.tmpdir(), 'ecc-prune-codex-'));
  const home1 = mkHome();
  let res = runInstall(repo, ['--target', 'codex', '-f', 'common', 'node'], home1, { CODEX_HOME: codexHome1 });
  assert.strictEqual(res.status, 0, res.stderr);

  const mp = manifestPath(codexHome1, '');
  assert.ok(fs.existsSync(mp), '.ecc-manifest not written for codex target');
  const lines = readManifestLines(mp);
  assert.ok(lines.includes('common\tinstructions/coding-style.md'));
  assert.ok(lines.includes('node\tinstructions/node-style.md'));
  assert.ok(lines.includes('node\tskills/node-skill'));
  assert.ok(!lines.some((l) => l.includes('AGENTS.md')), 'AGENTS.md must never be recorded');
  assert.ok(!lines.some((l) => l.includes('config.toml')), 'config.toml must never be recorded');

  fs.rmSync(path.join(repo, 'content', 'skills', 'node', 'node-skill'), { recursive: true });

  res = runInstall(repo, ['--target', 'codex', '-f', '-p', 'common', 'node'], home1, { CODEX_HOME: codexHome1 });
  assert.strictEqual(res.status, 0, res.stderr);
  assert.ok(!fs.existsSync(path.join(codexHome1, 'skills', 'node-skill')), 'orphaned skill dir should be pruned');
  const lines2 = readManifestLines(mp);
  assert.ok(!lines2.some((l) => l === 'node\tskills/node-skill'), 'pruned skill entry must not survive');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
