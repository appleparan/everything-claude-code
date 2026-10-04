#!/usr/bin/env node
/**
 * Tests for the pi target: targets/pi/{install,uninstall}.sh and the helpers
 * in scripts/lib/{pi-agents,upstream-extensions}.sh.
 *
 * Fixtures are self-contained copies of scripts/ + targets/ plus a minimal
 * fabricated content/ tree, with a temp HOME and PI_CODING_AGENT_DIR so the
 * real ~/.pi is never touched. Upstream extension fetching is skipped
 * (ECC_SKIP_UPSTREAM=1) except in the tests that use a local git repo as the
 * "upstream", so nothing needs network access.
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawnSync } = require('child_process');

const repoRoot = path.join(__dirname, '..', '..');
const hasJq = spawnSync('jq', ['--version'], { encoding: 'utf8' }).status === 0;
const hasGit = spawnSync('git', ['--version'], { encoding: 'utf8' }).status === 0;

const PLANNER_MD = [
  '---',
  'name: planner',
  'description: Plans things.',
  'tools: ["Read", "Grep", "Glob", "Bash", "Edit", "Write", "WebSearch"]',
  'model: opus',
  '---',
  '',
  'tools: ["Read"] stays in the body.',
  'Plan things.',
  ''
].join('\n');
const NOTOOLS_MD = '---\nname: notools\ndescription: No tools line.\nmodel: sonnet\n---\n\nBody.\n';
const WORKER_MD = '---\nname: worker\ndescription: w\ntools: read, bash\nmodel: sonnet\n---\n\nWork.\n';
const SCOUT_MD = '---\nname: scout\ndescription: s\ntools: read, grep\nmodel: haiku\n---\n\nScout.\n';
const SAFETY_TS = 'export default function () {}\n';

function writeFixtureContent(dir, { commands = ['plan', 'extra'] } = {}) {
  const w = (rel, content) => {
    const full = path.join(dir, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  };
  w('content/instructions/global.md', '# Global\n');
  w('content/rules/common/coding-style.md', '# Coding Style\n');
  w('content/skills/common/example-skill/SKILL.md', '---\nname: example-skill\n---\n# Example\n');
  for (const c of commands) {
    w(`content/commands/common/${c}.md`, `---\ndescription: ${c}\n---\nRun ${c} $ARGUMENTS\n`);
  }
  w('content/agents/common/planner.md', PLANNER_MD);
  w('content/agents/common/notools.md', NOTOOLS_MD);
  w('content/targets/pi/instructions.md', '## Harness: pi\n\nPi addendum.\n');
  w('content/targets/pi/agents/worker.md', WORKER_MD);
  w('content/targets/pi/agents/scout.md', SCOUT_MD);
  w('content/targets/pi/extensions/ecc-safety/index.ts', SAFETY_TS);
}

function buildRepo(opts) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ecc-pi-fixture-'));
  fs.cpSync(path.join(repoRoot, 'scripts'), path.join(dir, 'scripts'), { recursive: true });
  fs.cpSync(path.join(repoRoot, 'targets'), path.join(dir, 'targets'), { recursive: true });
  writeFixtureContent(dir, opts);
  return dir;
}

function mkDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function runScript(repoDir, script, args, piDir, extraEnv = {}) {
  const env = {
    ...process.env,
    HOME: mkDir('ecc-pi-home-'),
    PI_CODING_AGENT_DIR: piDir,
    ECC_SKIP_UPSTREAM: '1',
    ...extraEnv
  };
  const shPath = path.join(repoDir, 'targets', 'pi', script);
  return spawnSync('bash', [shPath, ...args], { env, encoding: 'utf8' });
}

function sh(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, { encoding: 'utf8', ...opts });
  assert.strictEqual(res.status, 0, `${cmd} ${args.join(' ')} failed: ${res.stderr}`);
  return res;
}

// A bare local git repo holding the subagent example files; returns its path
// and the commit SHA, standing in for the pinned upstream.
function makeUpstreamRepo(files) {
  const work = mkDir('ecc-pi-upstream-work-');
  const base = 'packages/coding-agent/examples/extensions/subagent';
  fs.mkdirSync(path.join(work, base), { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(work, base, name), content);
  }
  const env = { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null' };
  const id = ['-c', 'user.email=t@t', '-c', 'user.name=t'];
  sh('git', ['init', '-q'], { cwd: work, env });
  sh('git', [...id, 'add', '-A'], { cwd: work, env });
  sh('git', [...id, 'commit', '-q', '-m', 'init'], { cwd: work, env });
  const sha = sh('git', ['rev-parse', 'HEAD'], { cwd: work, env }).stdout.trim();
  const bare = path.join(mkDir('ecc-pi-upstream-'), 'upstream.git');
  sh('git', ['clone', '-q', '--bare', work, bare], { env });
  return { bare, sha, base };
}

function writeUpstreamJson(repoDir, entry) {
  const full = path.join(repoDir, 'content', 'targets', 'pi', 'upstream-extensions.json');
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, JSON.stringify({ extensions: [entry] }, null, 2) + '\n');
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
// Dry run and install
// ---------------------------------------------------------------------------
test('dry-run lists every section and writes nothing', () => {
  const repo = buildRepo();
  const piDir = path.join(mkDir('ecc-pi-dest-'), 'agent');
  const res = runScript(repo, 'install.sh', ['-n', 'common'], piDir);
  assert.strictEqual(res.status, 0, res.stderr + res.stdout);
  for (const section of ['[instructions]', '[global]', '[skills]', '[prompts]', '[agents]', '[extensions]']) {
    assert.ok(res.stdout.includes(section), `missing ${section}: ${res.stdout}`);
  }
  assert.ok(res.stdout.includes('prompts/plan.md'), res.stdout);
  assert.ok(res.stdout.includes('agents/worker.md'), res.stdout);
  assert.ok(res.stdout.includes('extensions/ecc-safety/'), res.stdout);
  assert.ok(!fs.existsSync(piDir), 'dry run must not create the pi dir');
});

test('dry-run on the real repo plans the pinned subagent extension without network', () => {
  const piDir = path.join(mkDir('ecc-pi-dest-'), 'agent');
  const res = runScript(repoRoot, 'install.sh', ['-n', 'common'], piDir, { ECC_SKIP_UPSTREAM: '' });
  assert.strictEqual(res.status, 0, res.stderr + res.stdout);
  assert.ok(res.stdout.includes('extensions/subagent/'), res.stdout);
  assert.ok(res.stdout.includes('@2003871'), res.stdout);
  assert.ok(!fs.existsSync(piDir));
});

test('install creates AGENTS.md, rules, skills, prompts, agents, and extensions', () => {
  const repo = buildRepo();
  const piDir = mkDir('ecc-pi-dest-');
  const res = runScript(repo, 'install.sh', ['common'], piDir);
  assert.strictEqual(res.status, 0, res.stderr + res.stdout);

  const agentsMd = fs.readFileSync(path.join(piDir, 'AGENTS.md'), 'utf8');
  assert.ok(agentsMd.includes('## Harness: pi'), 'pi addendum missing');
  assert.ok(agentsMd.includes(`\`${piDir}/instructions/coding-style.md\``), `index label wrong: ${agentsMd}`);

  assert.ok(fs.existsSync(path.join(piDir, 'instructions', 'coding-style.md')));
  assert.ok(fs.existsSync(path.join(piDir, 'skills', 'example-skill', 'SKILL.md')));
  assert.strictEqual(
    fs.readFileSync(path.join(piDir, 'prompts', 'plan.md'), 'utf8'),
    fs.readFileSync(path.join(repo, 'content/commands/common/plan.md'), 'utf8')
  );
  assert.strictEqual(
    fs.readFileSync(path.join(piDir, 'extensions', 'ecc-safety', 'index.ts'), 'utf8'),
    SAFETY_TS
  );
  assert.strictEqual(fs.readFileSync(path.join(piDir, 'agents', 'worker.md'), 'utf8'), WORKER_MD);
  assert.strictEqual(fs.readFileSync(path.join(piDir, 'agents', 'scout.md'), 'utf8'), SCOUT_MD);
  assert.ok(!fs.existsSync(path.join(piDir, 'extensions', 'subagent')), 'upstream skipped by env');
});

test('install without PI_CODING_AGENT_DIR labels the index ~/.pi/agent', () => {
  const repo = buildRepo();
  const home = mkDir('ecc-pi-home-');
  fs.mkdirSync(path.join(home, '.pi'));
  const env = { ...process.env, HOME: home, ECC_SKIP_UPSTREAM: '1' };
  delete env.PI_CODING_AGENT_DIR;
  const res = spawnSync('bash', [path.join(repo, 'targets', 'pi', 'install.sh'), 'common'], {
    env,
    encoding: 'utf8'
  });
  assert.strictEqual(res.status, 0, res.stderr + res.stdout);
  const agentsMd = fs.readFileSync(path.join(home, '.pi', 'agent', 'AGENTS.md'), 'utf8');
  assert.ok(agentsMd.includes('`~/.pi/agent/instructions/coding-style.md`'), agentsMd);
});

test('install fails when pi is not detected', () => {
  const repo = buildRepo();
  const env = { ...process.env, HOME: mkDir('ecc-pi-home-'), PATH: '/usr/bin:/bin' };
  delete env.PI_CODING_AGENT_DIR;
  const res = spawnSync('bash', [path.join(repo, 'targets', 'pi', 'install.sh'), '-n', 'common'], {
    env,
    encoding: 'utf8'
  });
  assert.notStrictEqual(res.status, 0);
  assert.ok((res.stdout + res.stderr).includes('pi not detected'));
});

// ---------------------------------------------------------------------------
// Agent conversion
// ---------------------------------------------------------------------------
test('agent conversion maps tools, drops unknown with WARN, keeps model and body', () => {
  const repo = buildRepo();
  const piDir = mkDir('ecc-pi-dest-');
  const res = runScript(repo, 'install.sh', ['common'], piDir);
  assert.strictEqual(res.status, 0, res.stderr + res.stdout);
  assert.ok(/WARN.*planner.*WebSearch/.test(res.stdout), `expected WARN naming agent and tool: ${res.stdout}`);

  const out = fs.readFileSync(path.join(piDir, 'agents', 'planner.md'), 'utf8');
  assert.strictEqual(
    out,
    PLANNER_MD.replace(
      'tools: ["Read", "Grep", "Glob", "Bash", "Edit", "Write", "WebSearch"]',
      'tools: read, grep, find, bash, edit, write'
    )
  );
  // The body line that looks like a tools line is untouched.
  assert.ok(out.includes('tools: ["Read"] stays in the body.'));
  // An agent without a tools line stays byte-identical.
  assert.strictEqual(fs.readFileSync(path.join(piDir, 'agents', 'notools.md'), 'utf8'), NOTOOLS_MD);
});

test('pi_convert_agent works when called directly', () => {
  const tmp = mkDir('ecc-pi-conv-');
  const src = path.join(tmp, 'a.md');
  const dest = path.join(tmp, 'out.md');
  fs.writeFileSync(src, '---\nname: a\ntools: ["Glob", "Task"]\n---\nBody\n');
  const script = [
    `REPO_ROOT=${JSON.stringify(repoRoot)}`,
    'source "$REPO_ROOT/scripts/lib/common.sh"',
    'source "$REPO_ROOT/scripts/lib/pi-agents.sh"',
    'DRY_RUN=false',
    `pi_convert_agent ${JSON.stringify(src)} ${JSON.stringify(dest)} a`
  ].join('\n');
  const res = spawnSync('bash', ['-c', script], { encoding: 'utf8', env: { ...process.env, HOME: tmp } });
  assert.strictEqual(res.status, 0, res.stderr);
  assert.strictEqual(fs.readFileSync(dest, 'utf8'), '---\nname: a\ntools: find\n---\nBody\n');
  assert.ok(/WARN.*a\.md.*Task/.test(res.stdout), res.stdout);
});

// ---------------------------------------------------------------------------
// Skip / force
// ---------------------------------------------------------------------------
test('existing files are skipped without -f and refreshed with -f', () => {
  const repo = buildRepo();
  const piDir = mkDir('ecc-pi-dest-');
  assert.strictEqual(runScript(repo, 'install.sh', ['common'], piDir).status, 0);

  const targets = ['prompts/plan.md', 'agents/planner.md', 'agents/worker.md', 'extensions/ecc-safety/index.ts'];
  for (const t of targets) fs.writeFileSync(path.join(piDir, t), 'USER EDIT\n');

  const second = runScript(repo, 'install.sh', ['common'], piDir);
  assert.strictEqual(second.status, 0, second.stderr + second.stdout);
  assert.ok(second.stdout.includes('SKIP'), second.stdout);
  for (const t of targets) {
    assert.strictEqual(fs.readFileSync(path.join(piDir, t), 'utf8'), 'USER EDIT\n', `${t} was overwritten`);
  }

  const forced = runScript(repo, 'install.sh', ['-f', 'common'], piDir);
  assert.strictEqual(forced.status, 0, forced.stderr + forced.stdout);
  for (const t of targets) {
    assert.notStrictEqual(fs.readFileSync(path.join(piDir, t), 'utf8'), 'USER EDIT\n', `${t} not refreshed`);
  }
});

// ---------------------------------------------------------------------------
// Uninstall
// ---------------------------------------------------------------------------
test('uninstall removes installed items and leaves unrelated user files', () => {
  const repo = buildRepo();
  const piDir = mkDir('ecc-pi-dest-');
  assert.strictEqual(runScript(repo, 'install.sh', ['common'], piDir).status, 0);
  fs.writeFileSync(path.join(piDir, 'agents', 'mine.md'), 'mine\n');
  fs.writeFileSync(path.join(piDir, 'settings.json'), '{}\n');
  fs.mkdirSync(path.join(piDir, 'extensions', 'my-ext'));
  fs.writeFileSync(path.join(piDir, 'extensions', 'my-ext', 'index.ts'), '// mine\n');

  const dry = runScript(repo, 'uninstall.sh', ['-n', 'common'], piDir);
  assert.strictEqual(dry.status, 0, dry.stderr + dry.stdout);
  assert.ok(fs.existsSync(path.join(piDir, 'AGENTS.md')), 'dry run must not remove');

  const res = runScript(repo, 'uninstall.sh', ['common'], piDir);
  assert.strictEqual(res.status, 0, res.stderr + res.stdout);
  for (const gone of [
    'AGENTS.md',
    'instructions',
    'skills',
    'prompts',
    'agents/planner.md',
    'agents/notools.md',
    'agents/worker.md',
    'agents/scout.md',
    'extensions/ecc-safety'
  ]) {
    assert.ok(!fs.existsSync(path.join(piDir, gone)), `${gone} should be removed`);
  }
  assert.strictEqual(fs.readFileSync(path.join(piDir, 'agents', 'mine.md'), 'utf8'), 'mine\n');
  assert.strictEqual(fs.readFileSync(path.join(piDir, 'settings.json'), 'utf8'), '{}\n');
  assert.ok(fs.existsSync(path.join(piDir, 'extensions', 'my-ext', 'index.ts')));
});

// ---------------------------------------------------------------------------
// Upstream extensions (local git repo as the pinned upstream)
// ---------------------------------------------------------------------------
const hasFetchTools = hasJq && hasGit;
const fetchTest = hasFetchTools ? test : (name) => console.log(`  SKIP  ${name} (needs jq and git)`);

fetchTest('upstream extension is fetched at the pinned commit; only listed files are copied', () => {
  const up = makeUpstreamRepo({ 'index.ts': 'INDEX\n', 'agents.ts': 'AGENTS\n', 'README.md': 'readme\n' });
  const repo = buildRepo();
  writeUpstreamJson(repo, {
    name: 'subagent',
    repo: up.bare,
    ref: up.sha,
    path: up.base,
    files: ['index.ts', 'agents.ts']
  });
  const piDir = mkDir('ecc-pi-dest-');
  const res = runScript(repo, 'install.sh', ['common'], piDir, { ECC_SKIP_UPSTREAM: '' });
  assert.strictEqual(res.status, 0, res.stderr + res.stdout);
  const dest = path.join(piDir, 'extensions', 'subagent');
  assert.strictEqual(fs.readFileSync(path.join(dest, 'index.ts'), 'utf8'), 'INDEX\n');
  assert.strictEqual(fs.readFileSync(path.join(dest, 'agents.ts'), 'utf8'), 'AGENTS\n');
  assert.ok(!fs.existsSync(path.join(dest, 'README.md')), 'unlisted file must not be copied');

  // Skip without -f, then uninstall removes the upstream dir.
  fs.writeFileSync(path.join(dest, 'index.ts'), 'EDIT\n');
  const again = runScript(repo, 'install.sh', ['common'], piDir, { ECC_SKIP_UPSTREAM: '' });
  assert.ok(again.stdout.includes('SKIP'), again.stdout);
  assert.strictEqual(fs.readFileSync(path.join(dest, 'index.ts'), 'utf8'), 'EDIT\n');
  const un = runScript(repo, 'uninstall.sh', ['common'], piDir);
  assert.strictEqual(un.status, 0, un.stderr + un.stdout);
  assert.ok(!fs.existsSync(dest));
});

fetchTest('upstream fetch failures warn and skip while the install continues', () => {
  const up = makeUpstreamRepo({ 'index.ts': 'INDEX\n' });
  const repo = buildRepo();
  const piDir = mkDir('ecc-pi-dest-');

  // Missing listed file at the pinned commit.
  writeUpstreamJson(repo, {
    name: 'subagent',
    repo: up.bare,
    ref: up.sha,
    path: up.base,
    files: ['index.ts', 'agents.ts']
  });
  let res = runScript(repo, 'install.sh', ['common'], piDir, { ECC_SKIP_UPSTREAM: '' });
  assert.strictEqual(res.status, 0, res.stderr + res.stdout);
  assert.ok(/WARN.*agents\.ts not found/.test(res.stdout), res.stdout);
  assert.ok(!fs.existsSync(path.join(piDir, 'extensions', 'subagent')));
  assert.ok(fs.existsSync(path.join(piDir, 'extensions', 'ecc-safety', 'index.ts')));

  // Unreachable repo.
  writeUpstreamJson(repo, {
    name: 'subagent',
    repo: path.join(os.tmpdir(), 'ecc-pi-does-not-exist.git'),
    ref: up.sha,
    path: up.base,
    files: ['index.ts']
  });
  res = runScript(repo, 'install.sh', ['-f', 'common'], piDir, { ECC_SKIP_UPSTREAM: '' });
  assert.strictEqual(res.status, 0, res.stderr + res.stdout);
  assert.ok(/WARN.*fetch failed/.test(res.stdout), res.stdout);
});

test('dry-run with -n makes no fetch even when upstream is enabled', () => {
  const repo = buildRepo();
  writeUpstreamJson(repo, {
    name: 'subagent',
    repo: path.join(os.tmpdir(), 'ecc-pi-does-not-exist.git'),
    ref: 'a'.repeat(40),
    path: 'x',
    files: ['index.ts']
  });
  const piDir = mkDir('ecc-pi-dest-');
  const res = runScript(repo, 'install.sh', ['-n', 'common'], piDir, { ECC_SKIP_UPSTREAM: '' });
  assert.strictEqual(res.status, 0, res.stderr + res.stdout);
  assert.ok(res.stdout.includes('extensions/subagent/'), res.stdout);
  assert.ok(!res.stdout.includes('fetch failed'), res.stdout);
});

// ---------------------------------------------------------------------------
// User files survive uninstall and -p (install skipped them)
// ---------------------------------------------------------------------------
function readManifest(piDir) {
  const p = path.join(piDir, '.ecc-manifest');
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
}

fetchTest('user AGENTS.md, extensions/subagent/ and agents/planner.md that install skipped survive uninstall and -p', () => {
  const up = makeUpstreamRepo({ 'index.ts': 'INDEX\n', 'agents.ts': 'AGENTS\n' });
  const repo = buildRepo();
  writeUpstreamJson(repo, {
    name: 'subagent', repo: up.bare, ref: up.sha, path: up.base, files: ['index.ts', 'agents.ts']
  });
  const piDir = mkDir('ecc-pi-dest-');
  fs.mkdirSync(path.join(piDir, 'agents'));
  fs.mkdirSync(path.join(piDir, 'extensions', 'subagent'), { recursive: true });
  fs.writeFileSync(path.join(piDir, 'AGENTS.md'), '# my own instructions\n');
  fs.writeFileSync(path.join(piDir, 'agents', 'planner.md'), 'USER PLANNER\n');
  fs.writeFileSync(path.join(piDir, 'extensions', 'subagent', 'index.ts'), 'USER EXT\n');
  const env = { ECC_SKIP_UPSTREAM: '' };

  const inst = runScript(repo, 'install.sh', ['common'], piDir, env);
  assert.strictEqual(inst.status, 0, inst.stderr + inst.stdout);
  assert.ok(!/agents\/planner\.md/.test(readManifest(piDir)), 'skipped user file entered the manifest');

  const pruned = runScript(repo, 'install.sh', ['-p', 'common'], piDir, env);
  assert.strictEqual(pruned.status, 0, pruned.stderr + pruned.stdout);
  const un = runScript(repo, 'uninstall.sh', ['common'], piDir, env);
  assert.strictEqual(un.status, 0, un.stderr + un.stdout);

  assert.strictEqual(fs.readFileSync(path.join(piDir, 'AGENTS.md'), 'utf8'), '# my own instructions\n');
  assert.strictEqual(fs.readFileSync(path.join(piDir, 'agents', 'planner.md'), 'utf8'), 'USER PLANNER\n');
  assert.strictEqual(fs.readFileSync(path.join(piDir, 'extensions', 'subagent', 'index.ts'), 'utf8'), 'USER EXT\n');
  assert.ok(/SKIP/.test(un.stdout), un.stdout);
});

test('a user edit of a skipped installed file is not pruned after a reinstall', () => {
  const repo = buildRepo();
  const piDir = mkDir('ecc-pi-dest-');
  assert.strictEqual(runScript(repo, 'install.sh', ['common'], piDir).status, 0);
  fs.writeFileSync(path.join(piDir, 'agents', 'planner.md'), 'USER EDIT\n');
  fs.writeFileSync(path.join(piDir, 'prompts', 'plan.md'), 'USER EDIT\n');
  assert.strictEqual(runScript(repo, 'install.sh', ['common'], piDir).status, 0);
  assert.strictEqual(runScript(repo, 'install.sh', ['-p', 'common'], piDir).status, 0);
  assert.strictEqual(fs.readFileSync(path.join(piDir, 'agents', 'planner.md'), 'utf8'), 'USER EDIT\n');
  assert.strictEqual(fs.readFileSync(path.join(piDir, 'prompts', 'plan.md'), 'utf8'), 'USER EDIT\n');
});

test('uninstall keeps installed files that were edited, removes untouched ones', () => {
  const repo = buildRepo();
  const piDir = mkDir('ecc-pi-dest-');
  assert.strictEqual(runScript(repo, 'install.sh', ['common'], piDir).status, 0);
  const edited = [
    'prompts/plan.md', 'agents/planner.md', 'agents/worker.md', 'instructions/coding-style.md',
    'extensions/ecc-safety/index.ts'
  ];
  for (const t of edited) fs.writeFileSync(path.join(piDir, t), 'USER EDIT\n');
  fs.writeFileSync(path.join(piDir, 'skills', 'example-skill', 'SKILL.md'), 'USER EDIT\n');
  fs.writeFileSync(path.join(piDir, 'AGENTS.md'), '# replaced by the user\n');

  const res = runScript(repo, 'uninstall.sh', ['common'], piDir);
  assert.strictEqual(res.status, 0, res.stderr + res.stdout);
  for (const t of [...edited, 'skills/example-skill/SKILL.md', 'AGENTS.md']) {
    assert.ok(fs.existsSync(path.join(piDir, t)), `${t} was edited and must be kept`);
  }
  assert.ok(!fs.existsSync(path.join(piDir, 'agents', 'scout.md')), 'untouched scout.md is removed');
  assert.ok(!fs.existsSync(path.join(piDir, 'prompts', 'extra.md')), 'untouched prompt is removed');
  assert.ok(!fs.existsSync(path.join(piDir, 'agents', 'notools.md')), 'untouched converted agent is removed');
});

fetchTest('upstream install writes the .ecc-upstream marker with the ref', () => {
  const up = makeUpstreamRepo({ 'index.ts': 'INDEX\n', 'agents.ts': 'AGENTS\n' });
  const repo = buildRepo();
  writeUpstreamJson(repo, {
    name: 'subagent', repo: up.bare, ref: up.sha, path: up.base, files: ['index.ts', 'agents.ts']
  });
  const piDir = mkDir('ecc-pi-dest-');
  const res = runScript(repo, 'install.sh', ['common'], piDir, { ECC_SKIP_UPSTREAM: '' });
  assert.strictEqual(res.status, 0, res.stderr + res.stdout);
  assert.strictEqual(
    fs.readFileSync(path.join(piDir, 'extensions', 'subagent', '.ecc-upstream'), 'utf8').trim(), up.sha);
});

// ---------------------------------------------------------------------------
// -f never writes through symlinks
// ---------------------------------------------------------------------------
fetchTest('install -f leaves symlinked destinations and their targets untouched', () => {
  const up = makeUpstreamRepo({ 'index.ts': 'INDEX\n', 'agents.ts': 'AGENTS\n' });
  const repo = buildRepo();
  writeUpstreamJson(repo, {
    name: 'subagent', repo: up.bare, ref: up.sha, path: up.base, files: ['index.ts', 'agents.ts']
  });
  const piDir = mkDir('ecc-pi-dest-');
  const clone = mkDir('ecc-pi-clone-');
  const link = (target, dest, content, dir = false) => {
    const t = path.join(clone, target);
    if (dir) {
      fs.mkdirSync(t, { recursive: true });
      fs.writeFileSync(path.join(t, 'f.txt'), content);
    } else {
      fs.writeFileSync(t, content);
    }
    fs.mkdirSync(path.dirname(path.join(piDir, dest)), { recursive: true });
    fs.symlinkSync(t, path.join(piDir, dest));
  };
  link('worker.md', 'agents/worker.md', 'CLONE WORKER\n');
  link('planner.md', 'agents/planner.md', 'CLONE PLANNER\n');
  link('plan.md', 'prompts/plan.md', 'CLONE PLAN\n');
  link('skill', 'skills/example-skill', 'CLONE SKILL\n', true);
  link('ext', 'extensions/ecc-safety', 'CLONE EXT\n', true);
  fs.mkdirSync(path.join(piDir, 'extensions', 'subagent'), { recursive: true });
  link('index.ts', 'extensions/subagent/index.ts', 'CLONE INDEX\n');

  const res = runScript(repo, 'install.sh', ['-f', 'common'], piDir, { ECC_SKIP_UPSTREAM: '' });
  assert.strictEqual(res.status, 0, res.stderr + res.stdout);
  assert.ok(/WARN.*symlink, not overwritten/.test(res.stdout), res.stdout);
  const read = (f) => fs.readFileSync(path.join(clone, f), 'utf8');
  assert.strictEqual(read('worker.md'), 'CLONE WORKER\n');
  assert.strictEqual(read('planner.md'), 'CLONE PLANNER\n');
  assert.strictEqual(read('plan.md'), 'CLONE PLAN\n');
  assert.strictEqual(read('index.ts'), 'CLONE INDEX\n');
  assert.deepStrictEqual(fs.readdirSync(path.join(clone, 'skill')), ['f.txt']);
  assert.deepStrictEqual(fs.readdirSync(path.join(clone, 'ext')), ['f.txt']);
  assert.ok(fs.lstatSync(path.join(piDir, 'agents', 'worker.md')).isSymbolicLink());
  assert.ok(!fs.existsSync(path.join(piDir, 'extensions', 'subagent', 'agents.ts')), 'entry skipped as a whole');
  assert.ok(!/(^|\n)(skills\/example-skill|extensions\/ecc-safety|agents\/worker\.md)/.test(readManifest(piDir)));
});

fetchTest('a symlink inside the fetched upstream tree is skipped with a WARN', () => {
  const up = makeUpstreamRepo({ 'index.ts': 'INDEX\n', 'agents.ts': 'AGENTS\n' });
  // Replace agents.ts in the bare repo's history with a symlink via a fresh commit.
  const work = mkDir('ecc-pi-upstream-sym-');
  const env = { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null' };
  sh('git', ['clone', '-q', up.bare, work], { env });
  const base = path.join(work, up.base);
  fs.rmSync(path.join(base, 'agents.ts'));
  fs.symlinkSync('/etc/hostname', path.join(base, 'agents.ts'));
  const id = ['-c', 'user.email=t@t', '-c', 'user.name=t'];
  sh('git', [...id, 'commit', '-q', '-am', 'symlink'], { cwd: work, env });
  sh('git', ['push', '-q', 'origin', 'HEAD:master'], { cwd: work, env });
  sh('git', ['push', '-q', 'origin', 'HEAD:main'], { cwd: work, env });
  const sha = sh('git', ['rev-parse', 'HEAD'], { cwd: work, env }).stdout.trim();
  const repo = buildRepo();
  writeUpstreamJson(repo, { name: 'subagent', repo: up.bare, ref: sha, path: up.base, files: ['index.ts', 'agents.ts'] });
  const piDir = mkDir('ecc-pi-dest-');
  const res = runScript(repo, 'install.sh', ['common'], piDir, { ECC_SKIP_UPSTREAM: '' });
  assert.strictEqual(res.status, 0, res.stderr + res.stdout);
  assert.ok(/WARN.*agents\.ts.*symlink/.test(res.stdout), res.stdout);
  assert.ok(!fs.existsSync(path.join(piDir, 'extensions', 'subagent', 'agents.ts')));
});

fetchTest('upstream file names with .., a leading /, or glob characters are rejected', () => {
  const repo = buildRepo();
  const piDir = mkDir('ecc-pi-dest-');
  for (const bad of ['../x.ts', '/etc/passwd', '*.ts', 'a?.ts', '[a].ts']) {
    writeUpstreamJson(repo, {
      name: 'subagent', repo: path.join(os.tmpdir(), 'ecc-pi-none.git'), ref: 'a'.repeat(40), path: 'x',
      files: ['index.ts', bad]
    });
    const res = runScript(repo, 'install.sh', ['common'], piDir, { ECC_SKIP_UPSTREAM: '' });
    assert.strictEqual(res.status, 0, res.stderr + res.stdout);
    assert.ok(/WARN.*invalid file/.test(res.stdout), `${bad}: ${res.stdout}`);
    assert.ok(!res.stdout.includes('fetch failed'), `${bad} must be rejected before fetching`);
  }
});

fetchTest('a non-SHA or option-like ref, or an option-like repo, is skipped with a WARN before any fetch', () => {
  const repo = buildRepo();
  const bare = path.join(os.tmpdir(), 'ecc-pi-none.git');
  const cases = [
    { repo: bare, ref: 'main', what: /invalid ref/ },
    { repo: bare, ref: '--upload-pack=touch /tmp/ecc-pwned', what: /invalid ref/ },
    { repo: bare, ref: 'A'.repeat(40), what: /invalid ref/ },
    { repo: '--upload-pack=x', ref: 'a'.repeat(40), what: /invalid repo/ }
  ];
  for (const c of cases) {
    writeUpstreamJson(repo, { name: 'subagent', repo: c.repo, ref: c.ref, path: 'x', files: ['index.ts'] });
    const piDir = mkDir('ecc-pi-dest-');
    const res = runScript(repo, 'install.sh', ['common'], piDir, { ECC_SKIP_UPSTREAM: '' });
    assert.strictEqual(res.status, 0, res.stderr + res.stdout);
    assert.ok(c.what.test(res.stdout), `${c.ref}: ${res.stdout}`);
    assert.ok(!res.stdout.includes('fetch failed'), `${c.ref} must not reach git`);
    assert.ok(!fs.existsSync(path.join(piDir, 'extensions', 'subagent')));
  }
});

// ---------------------------------------------------------------------------
// Prune
// ---------------------------------------------------------------------------
test('-p prunes a prompt that was removed from content', () => {
  const repo = buildRepo({ commands: ['plan', 'extra'] });
  const piDir = mkDir('ecc-pi-dest-');
  assert.strictEqual(runScript(repo, 'install.sh', ['common'], piDir).status, 0);
  assert.ok(fs.existsSync(path.join(piDir, 'prompts', 'extra.md')));

  fs.rmSync(path.join(repo, 'content', 'commands', 'common', 'extra.md'));
  const noPrune = runScript(repo, 'install.sh', ['common'], piDir);
  assert.ok(noPrune.stdout.includes('orphaned'), noPrune.stdout);
  assert.ok(fs.existsSync(path.join(piDir, 'prompts', 'extra.md')), 'no -p, no removal');

  const res = runScript(repo, 'install.sh', ['-p', 'common'], piDir);
  assert.strictEqual(res.status, 0, res.stderr + res.stdout);
  assert.ok(!fs.existsSync(path.join(piDir, 'prompts', 'extra.md')));
  assert.ok(fs.existsSync(path.join(piDir, 'prompts', 'plan.md')));
  assert.ok(fs.existsSync(path.join(piDir, 'agents', 'worker.md')), 'worker is not manifest-managed');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
