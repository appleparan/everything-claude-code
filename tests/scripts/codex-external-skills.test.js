#!/usr/bin/env node
/**
 * Tests for external Codex skills: targets/codex/install.sh must clone the
 * repos listed in content/plugins/codex-skills.json and copy each tracked
 * skill directory into $CODEX_DIR/skills/<name>/, and uninstall.sh must
 * remove only the tracked entries.
 *
 * Fixtures are self-contained copies of scripts/ + targets/ plus a minimal
 * fabricated content/ tree; the "external" repos are local git repos created
 * per test in a temp dir, so no network access is needed.
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawnSync } = require('child_process');

const repoRoot = path.join(__dirname, '..', '..');

function sh(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, { encoding: 'utf8', ...opts });
  assert.strictEqual(res.status, 0, `${cmd} ${args.join(' ')} failed: ${res.stderr}`);
  return res;
}

// Create a local git repo holding one Codex skill at codex/skills/<name>/.
function makeSkillRepo(skillName, { withSkillMd = true } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ecc-ext-skill-repo-'));
  const skillDir = path.join(dir, 'codex', 'skills', skillName);
  fs.mkdirSync(skillDir, { recursive: true });
  if (withSkillMd) {
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), `# ${skillName}\n`);
    fs.mkdirSync(path.join(skillDir, 'references'));
    fs.writeFileSync(path.join(skillDir, 'references', 'notes.md'), 'notes\n');
  } else {
    // git does not track empty directories — keep the commit non-empty
    fs.writeFileSync(path.join(skillDir, 'README.md'), 'no SKILL.md here\n');
  }
  const env = { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null' };
  sh('git', ['init', '-q'], { cwd: dir, env });
  sh('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'add', '-A'], { cwd: dir, env });
  sh('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '-m', 'init'], {
    cwd: dir,
    env
  });
  return dir;
}

function writeFixtureContent(dir, skillsJson) {
  const w = (rel, content) => {
    const full = path.join(dir, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  };
  w('content/instructions/global.md', '# Global\n');
  w('content/rules/common/coding-style.md', '# Coding Style\n');
  w('content/mcp/servers.json', JSON.stringify({ mcpServers: {} }, null, 2) + '\n');
  if (skillsJson !== null) {
    w('content/plugins/codex-skills.json', JSON.stringify(skillsJson, null, 2) + '\n');
  }
}

function buildRepo(skillsJson) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ecc-ext-skill-fixture-'));
  fs.cpSync(path.join(repoRoot, 'scripts'), path.join(dir, 'scripts'), { recursive: true });
  fs.cpSync(path.join(repoRoot, 'targets'), path.join(dir, 'targets'), { recursive: true });
  writeFixtureContent(dir, skillsJson);
  return dir;
}

function mkCodexHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ecc-ext-skill-codex-'));
}

function runScript(repoDir, script, args, codexHome, extraEnv = {}) {
  const shPath = path.join(repoDir, 'targets', 'codex', script);
  const env = { ...process.env, CODEX_HOME: codexHome, ...extraEnv };
  return spawnSync('bash', [shPath, ...args], { env, encoding: 'utf8' });
}

function skillsJsonFor(entries) {
  return {
    skills: entries,
    _comments: { usage: 'test fixture — must never be installed literally' }
  };
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
// 1. Fresh install copies the tracked skill into skills/<name>/, without .git
// ---------------------------------------------------------------------------
test('install copies tracked external skill into skills/<name>/', () => {
  const skillRepo = makeSkillRepo('test-skill');
  const repo = buildRepo(
    skillsJsonFor([
      { name: 'test-skill', repo: skillRepo, path: 'codex/skills/test-skill' }
    ])
  );
  const codexHome = mkCodexHome();
  const res = runScript(repo, 'install.sh', ['common'], codexHome);
  assert.strictEqual(res.status, 0, res.stderr + res.stdout);

  const dest = path.join(codexHome, 'skills', 'test-skill');
  assert.ok(fs.existsSync(path.join(dest, 'SKILL.md')), 'SKILL.md must be installed');
  assert.ok(
    fs.existsSync(path.join(dest, 'references', 'notes.md')),
    'skill subdirectories must be installed'
  );
  assert.ok(!fs.existsSync(path.join(dest, '.git')), '.git must not be copied');
});

// ---------------------------------------------------------------------------
// 2. path: "." installs from the repo root (humanizer layout)
// ---------------------------------------------------------------------------
test('install supports path "." for a repo-root SKILL.md', () => {
  const skillRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'ecc-ext-skill-root-'));
  fs.writeFileSync(path.join(skillRepo, 'SKILL.md'), '# root skill\n');
  const env = { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null' };
  sh('git', ['init', '-q'], { cwd: skillRepo, env });
  sh('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'add', '-A'], { cwd: skillRepo, env });
  sh('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '-m', 'init'], {
    cwd: skillRepo,
    env
  });

  const repo = buildRepo(skillsJsonFor([{ name: 'root-skill', repo: skillRepo, path: '.' }]));
  const codexHome = mkCodexHome();
  const res = runScript(repo, 'install.sh', ['common'], codexHome);
  assert.strictEqual(res.status, 0, res.stderr + res.stdout);

  const dest = path.join(codexHome, 'skills', 'root-skill');
  assert.ok(fs.existsSync(path.join(dest, 'SKILL.md')), 'root SKILL.md must be installed');
  assert.ok(!fs.existsSync(path.join(dest, '.git')), '.git must not be copied');
});

// ---------------------------------------------------------------------------
// 3. Existing skill dir without -f is skipped; with -f it is refreshed
// ---------------------------------------------------------------------------
test('existing external skill is skipped without -f and refreshed with -f', () => {
  const skillRepo = makeSkillRepo('test-skill');
  const repo = buildRepo(
    skillsJsonFor([
      { name: 'test-skill', repo: skillRepo, path: 'codex/skills/test-skill' }
    ])
  );
  const codexHome = mkCodexHome();
  const dest = path.join(codexHome, 'skills', 'test-skill');
  fs.mkdirSync(dest, { recursive: true });
  fs.writeFileSync(path.join(dest, 'SKILL.md'), 'user-modified\n');

  let res = runScript(repo, 'install.sh', ['common'], codexHome);
  assert.strictEqual(res.status, 0, res.stderr + res.stdout);
  assert.strictEqual(
    fs.readFileSync(path.join(dest, 'SKILL.md'), 'utf8'),
    'user-modified\n',
    'existing skill must not be overwritten without -f'
  );

  res = runScript(repo, 'install.sh', ['-f', 'common'], codexHome);
  assert.strictEqual(res.status, 0, res.stderr + res.stdout);
  assert.strictEqual(
    fs.readFileSync(path.join(dest, 'SKILL.md'), 'utf8'),
    '# test-skill\n',
    '-f must refresh the skill from the repo'
  );
});

// ---------------------------------------------------------------------------
// 4. Missing SKILL.md at path: entry is skipped with a warning, install passes
// ---------------------------------------------------------------------------
test('entry without SKILL.md is skipped with a warning', () => {
  const skillRepo = makeSkillRepo('bad-skill', { withSkillMd: false });
  const repo = buildRepo(
    skillsJsonFor([{ name: 'bad-skill', repo: skillRepo, path: 'codex/skills/bad-skill' }])
  );
  const codexHome = mkCodexHome();
  const res = runScript(repo, 'install.sh', ['common'], codexHome);
  assert.strictEqual(res.status, 0, res.stderr + res.stdout);
  assert.ok(!fs.existsSync(path.join(codexHome, 'skills', 'bad-skill')));
  assert.ok(/SKILL\.md/.test(res.stdout + res.stderr), 'expected a SKILL.md warning');
});

// ---------------------------------------------------------------------------
// 5. Unclonable repo: entry is skipped with a warning, install still passes
// ---------------------------------------------------------------------------
test('unclonable repo is skipped with a warning and does not fail install', () => {
  const repo = buildRepo(
    skillsJsonFor([
      { name: 'gone-skill', repo: '/nonexistent/ecc-no-such-repo.git', path: '.' }
    ])
  );
  const codexHome = mkCodexHome();
  const res = runScript(repo, 'install.sh', ['common'], codexHome);
  assert.strictEqual(res.status, 0, res.stderr + res.stdout);
  assert.ok(!fs.existsSync(path.join(codexHome, 'skills', 'gone-skill')));
  assert.ok(/gone-skill/.test(res.stdout + res.stderr), 'expected a clone warning');
});

// ---------------------------------------------------------------------------
// 6. No codex-skills.json: install succeeds without an external skills step
// ---------------------------------------------------------------------------
test('install without codex-skills.json still succeeds', () => {
  const repo = buildRepo(null);
  const codexHome = mkCodexHome();
  const res = runScript(repo, 'install.sh', ['common'], codexHome);
  assert.strictEqual(res.status, 0, res.stderr + res.stdout);
});

// ---------------------------------------------------------------------------
// 7. Dry run: nothing is cloned or copied
// ---------------------------------------------------------------------------
test('dry run does not install external skills', () => {
  const skillRepo = makeSkillRepo('test-skill');
  const repo = buildRepo(
    skillsJsonFor([
      { name: 'test-skill', repo: skillRepo, path: 'codex/skills/test-skill' }
    ])
  );
  const codexHome = mkCodexHome();
  const res = runScript(repo, 'install.sh', ['-n', 'common'], codexHome);
  assert.strictEqual(res.status, 0, res.stderr + res.stdout);
  assert.ok(!fs.existsSync(path.join(codexHome, 'skills', 'test-skill')));
});

// ---------------------------------------------------------------------------
// 8. Uninstall removes tracked external skills and leaves others alone
// ---------------------------------------------------------------------------
test('uninstall removes tracked external skills only', () => {
  const skillRepo = makeSkillRepo('test-skill');
  const repo = buildRepo(
    skillsJsonFor([
      { name: 'test-skill', repo: skillRepo, path: 'codex/skills/test-skill' }
    ])
  );
  const codexHome = mkCodexHome();
  let res = runScript(repo, 'install.sh', ['common'], codexHome);
  assert.strictEqual(res.status, 0, res.stderr + res.stdout);

  const userSkill = path.join(codexHome, 'skills', 'my-own-skill');
  fs.mkdirSync(userSkill, { recursive: true });
  fs.writeFileSync(path.join(userSkill, 'SKILL.md'), '# mine\n');

  res = runScript(repo, 'uninstall.sh', ['common'], codexHome);
  assert.strictEqual(res.status, 0, res.stderr + res.stdout);
  assert.ok(
    !fs.existsSync(path.join(codexHome, 'skills', 'test-skill')),
    'tracked external skill must be removed'
  );
  assert.ok(fs.existsSync(path.join(userSkill, 'SKILL.md')), 'untracked skill must survive');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
