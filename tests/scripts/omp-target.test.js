#!/usr/bin/env node
/**
 * Tests for the omp target: targets/omp/{install,uninstall}.sh and the omp
 * helpers in scripts/lib/pi-agents.sh.
 *
 * Fixtures are self-contained copies of scripts/ + targets/ plus a minimal
 * fabricated content/ tree, with a temp HOME and ECC_OMP_DIR so the real
 * ~/.omp is never touched. No network is needed (ECC_SKIP_UPSTREAM=1).
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawnSync } = require('child_process');

const repoRoot = path.join(__dirname, '..', '..');

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
const BUNDLED = ['scout', 'reviewer', 'security-reviewer', 'seance', 'task', 'sonic'];
const bundledMd = (n) => `---\nname: ${n}\ndescription: shared ${n}\ntools: ["Read"]\nmodel: sonnet\n---\n\nShared ${n}.\n`;
const SAFETY_TS = 'export default function () {}\n';
const SIMPLE_TS = '// omp simple-english\nexport default function () {}\n';
const PROMPT_CJS = 'module.exports = {};\n';

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
  for (const b of BUNDLED) w(`content/agents/common/${b}.md`, bundledMd(b));
  w('content/targets/omp/instructions.md', '## Harness: omp\n\nOmp addendum.\n');
  w('content/targets/omp/extensions/simple-english/index.ts', SIMPLE_TS);
  w('content/targets/pi/extensions/ecc-safety/index.ts', SAFETY_TS);
  w('content/targets/pi/extensions/ecc-safety/policy.cjs', 'module.exports = {};\n');
  w('content/targets/pi/extensions/simple-english/index.ts', '// pi version\n');
  w('content/targets/pi/extensions/simple-english/prompt.cjs', PROMPT_CJS);
}

const noModel = (md) => md.replace(/^model: .*\n/m, '');

function buildRepo(opts) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ecc-omp-fixture-'));
  fs.cpSync(path.join(repoRoot, 'scripts'), path.join(dir, 'scripts'), { recursive: true });
  fs.cpSync(path.join(repoRoot, 'targets'), path.join(dir, 'targets'), { recursive: true });
  writeFixtureContent(dir, opts);
  return dir;
}

function mkDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function baseEnv(ompDir, extra = {}) {
  const env = { ...process.env, HOME: mkDir('ecc-omp-home-'), ECC_SKIP_UPSTREAM: '1', ...extra };
  delete env.PI_CODING_AGENT_DIR;
  delete env.PI_CONFIG_DIR;
  delete env.ECC_OMP_DIR;
  if (ompDir) env.ECC_OMP_DIR = ompDir;
  Object.assign(env, extra);
  return env;
}

function runScript(repoDir, script, args, ompDir, extraEnv = {}) {
  const shPath = path.join(repoDir, 'targets', 'omp', script);
  return spawnSync('bash', [shPath, ...args], { env: baseEnv(ompDir, extraEnv), encoding: 'utf8' });
}

function readManifest(dir) {
  const p = path.join(dir, '.ecc-manifest');
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
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
  const dir = path.join(mkDir('ecc-omp-dest-'), 'agent');
  const res = runScript(repo, 'install.sh', ['-n', 'common'], dir);
  assert.strictEqual(res.status, 0, res.stderr + res.stdout);
  for (const s of ['[rules]', '[global]', '[skills]', '[commands]', '[agents]', '[extensions]']) {
    assert.ok(res.stdout.includes(s), `missing ${s}: ${res.stdout}`);
  }
  assert.ok(res.stdout.includes('commands/plan.md'), res.stdout);
  assert.ok(res.stdout.includes('rules/coding-style.md'), res.stdout);
  assert.ok(res.stdout.includes('extensions/ecc-safety/'), res.stdout);
  assert.ok(res.stdout.includes('extensions/simple-english/'), res.stdout);
  assert.ok(!fs.existsSync(dir), 'dry run must not create the omp dir');
});

test('install creates AGENTS.md, rules, skills, commands, agents and extensions', () => {
  const repo = buildRepo();
  const dir = mkDir('ecc-omp-dest-');
  const res = runScript(repo, 'install.sh', ['common'], dir);
  assert.strictEqual(res.status, 0, res.stderr + res.stdout);

  const agentsMd = fs.readFileSync(path.join(dir, 'AGENTS.md'), 'utf8');
  assert.ok(agentsMd.split('\n').includes('## Harness: omp'), 'omp addendum missing');
  assert.ok(agentsMd.includes(`\`${dir}/rules/coding-style.md\``), `index label wrong: ${agentsMd}`);

  assert.ok(fs.existsSync(path.join(dir, 'rules', 'coding-style.md')));
  assert.ok(fs.existsSync(path.join(dir, 'skills', 'example-skill', 'SKILL.md')));
  assert.strictEqual(
    fs.readFileSync(path.join(dir, 'commands', 'plan.md'), 'utf8'),
    fs.readFileSync(path.join(repo, 'content/commands/common/plan.md'), 'utf8')
  );
  assert.ok(res.stdout.includes('/skill:'), 'final hint missing');
  assert.ok(!fs.existsSync(path.join(dir, 'agents', 'worker.md')), 'no worker agent for omp');
  assert.ok(!fs.existsSync(path.join(dir, 'extensions', 'subagent')), 'no upstream subagent extension');
});

test('install without ECC_OMP_DIR labels the index ~/.omp/agent', () => {
  const repo = buildRepo();
  const home = mkDir('ecc-omp-home-');
  fs.mkdirSync(path.join(home, '.omp'));
  const env = baseEnv(null, { HOME: home });
  const res = spawnSync('bash', [path.join(repo, 'targets', 'omp', 'install.sh'), 'common'], { env, encoding: 'utf8' });
  assert.strictEqual(res.status, 0, res.stderr + res.stdout);
  const agentsMd = fs.readFileSync(path.join(home, '.omp', 'agent', 'AGENTS.md'), 'utf8');
  assert.ok(agentsMd.includes('`~/.omp/agent/rules/coding-style.md`'), agentsMd);
});

test('PI_CONFIG_DIR renames the .omp directory', () => {
  const repo = buildRepo();
  const home = mkDir('ecc-omp-home-');
  fs.mkdirSync(path.join(home, '.omp'));
  const env = baseEnv(null, { HOME: home, PI_CONFIG_DIR: '.myomp' });
  const res = spawnSync('bash', [path.join(repo, 'targets', 'omp', 'install.sh'), 'common'], { env, encoding: 'utf8' });
  assert.strictEqual(res.status, 0, res.stderr + res.stdout);
  assert.ok(fs.existsSync(path.join(home, '.myomp', 'agent', 'AGENTS.md')));
});

test('install fails when omp is not detected', () => {
  const repo = buildRepo();
  const env = baseEnv(null, { PATH: '/usr/bin:/bin' });
  const res = spawnSync('bash', [path.join(repo, 'targets', 'omp', 'install.sh'), '-n', 'common'], { env, encoding: 'utf8' });
  assert.notStrictEqual(res.status, 0);
  assert.ok((res.stdout + res.stderr).includes('omp not detected'));
});

test('PI_CODING_AGENT_DIR without ECC_OMP_DIR warns but still installs', () => {
  const repo = buildRepo();
  const home = mkDir('ecc-omp-home-');
  fs.mkdirSync(path.join(home, '.omp'));
  const env = baseEnv(null, { HOME: home, PI_CODING_AGENT_DIR: mkDir('ecc-omp-pi-') });
  const res = spawnSync('bash', [path.join(repo, 'targets', 'omp', 'install.sh'), 'common'], { env, encoding: 'utf8' });
  assert.strictEqual(res.status, 0, res.stderr + res.stdout);
  assert.ok(/WARN.*PI_CODING_AGENT_DIR/.test(res.stdout), res.stdout);
  assert.ok(res.stdout.includes('ECC_OMP_DIR'), res.stdout);
  assert.ok(fs.existsSync(path.join(home, '.omp', 'agent', 'AGENTS.md')));
});

test('no warning when ECC_OMP_DIR is set next to PI_CODING_AGENT_DIR', () => {
  const repo = buildRepo();
  const dir = mkDir('ecc-omp-dest-');
  const res = runScript(repo, 'install.sh', ['common'], dir, { PI_CODING_AGENT_DIR: mkDir('ecc-omp-pi-') });
  assert.strictEqual(res.status, 0, res.stderr + res.stdout);
  assert.ok(!/PI_CODING_AGENT_DIR/.test(res.stdout), res.stdout);
});

// ---------------------------------------------------------------------------
// Extensions
// ---------------------------------------------------------------------------
test('extensions are composed from the pi ecc-safety dir and the omp simple-english dir', () => {
  const repo = buildRepo();
  const dir = mkDir('ecc-omp-dest-');
  assert.strictEqual(runScript(repo, 'install.sh', ['common'], dir).status, 0);
  const ext = (...p) => path.join(dir, 'extensions', ...p);
  assert.strictEqual(fs.readFileSync(ext('ecc-safety', 'index.ts'), 'utf8'), SAFETY_TS);
  assert.ok(fs.existsSync(ext('ecc-safety', 'policy.cjs')));
  assert.strictEqual(fs.readFileSync(ext('simple-english', 'index.ts'), 'utf8'), SIMPLE_TS);
  assert.strictEqual(fs.readFileSync(ext('simple-english', 'prompt.cjs'), 'utf8'), PROMPT_CJS);
});

// ---------------------------------------------------------------------------
// Agents
// ---------------------------------------------------------------------------
test('agent conversion maps tools to omp names, drops unknown with WARN, strips model', () => {
  const repo = buildRepo();
  const dir = mkDir('ecc-omp-dest-');
  const res = runScript(repo, 'install.sh', ['common'], dir);
  assert.strictEqual(res.status, 0, res.stderr + res.stdout);
  assert.ok(/WARN.*planner.*WebSearch.*omp/.test(res.stdout), res.stdout);
  const out = fs.readFileSync(path.join(dir, 'agents', 'planner.md'), 'utf8');
  assert.strictEqual(
    out,
    noModel(PLANNER_MD).replace(
      'tools: ["Read", "Grep", "Glob", "Bash", "Edit", "Write", "WebSearch"]',
      'tools: read, grep, glob, bash, edit, write'
    )
  );
  assert.ok(out.includes('tools: ["Read"] stays in the body.'));
  assert.strictEqual(fs.readFileSync(path.join(dir, 'agents', 'notools.md'), 'utf8'), noModel(NOTOOLS_MD));
  assert.strictEqual((res.stdout.match(/model: lines removed/g) || []).length, 1, res.stdout);
});

test('shared agents that share a bundled omp agent name are skipped with one INFO each', () => {
  const repo = buildRepo();
  const dir = mkDir('ecc-omp-dest-');
  const res = runScript(repo, 'install.sh', ['common'], dir);
  assert.strictEqual(res.status, 0, res.stderr + res.stdout);
  for (const b of BUNDLED) {
    assert.ok(!fs.existsSync(path.join(dir, 'agents', `${b}.md`)), `${b}.md must not be written`);
    const hits = res.stdout.split('\n').filter((l) => /INFO/.test(l) && l.includes(`agents/${b}.md`));
    assert.strictEqual(hits.length, 1, `${b}: ${res.stdout}`);
    assert.ok(!new RegExp(`agents/${b}\\.md`).test(readManifest(dir)), `${b} must not be in the manifest`);
  }
});

test('a user agent with a bundled name survives -f, -p and uninstall', () => {
  const repo = buildRepo();
  const dir = mkDir('ecc-omp-dest-');
  fs.mkdirSync(path.join(dir, 'agents'));
  fs.writeFileSync(path.join(dir, 'agents', 'reviewer.md'), 'MY REVIEWER\n');
  assert.strictEqual(runScript(repo, 'install.sh', ['-f', 'common'], dir).status, 0);
  assert.strictEqual(runScript(repo, 'install.sh', ['-f', '-p', 'common'], dir).status, 0);
  assert.strictEqual(runScript(repo, 'uninstall.sh', ['common'], dir).status, 0);
  assert.strictEqual(fs.readFileSync(path.join(dir, 'agents', 'reviewer.md'), 'utf8'), 'MY REVIEWER\n');
});

test('omp_convert_agent maps Glob to glob and passes find through; pi keeps Glob as find', () => {
  const tmp = mkDir('ecc-omp-conv-');
  const src = path.join(tmp, 'a.md');
  fs.writeFileSync(src, '---\nname: a\ntools: ["Glob", "find", "ls", "Task"]\nmodel: x\n---\nBody\n');
  const run = (fn, out) => {
    const script = [
      `REPO_ROOT=${JSON.stringify(repoRoot)}`,
      'source "$REPO_ROOT/scripts/lib/common.sh"',
      'source "$REPO_ROOT/scripts/lib/pi-agents.sh"',
      'DRY_RUN=false',
      `${fn} ${JSON.stringify(src)} ${JSON.stringify(out)} a`
    ].join('\n');
    return spawnSync('bash', ['-c', script], { encoding: 'utf8', env: { ...process.env, HOME: tmp } });
  };
  const ompOut = path.join(tmp, 'omp.md');
  const r1 = run('omp_convert_agent', ompOut);
  assert.strictEqual(r1.status, 0, r1.stderr);
  assert.strictEqual(fs.readFileSync(ompOut, 'utf8'), '---\nname: a\ntools: glob, find\n---\nBody\n');
  assert.ok(/WARN.*ls.*omp/.test(r1.stdout) && /WARN.*Task/.test(r1.stdout), r1.stdout);
  const piOut = path.join(tmp, 'pi.md');
  const r2 = run('pi_convert_agent', piOut);
  assert.strictEqual(r2.status, 0, r2.stderr);
  assert.strictEqual(fs.readFileSync(piOut, 'utf8'), '---\nname: a\ntools: find, find, ls\n---\nBody\n');
  assert.ok(/WARN.*Task.*pi/.test(r2.stdout), r2.stdout);
});

// ---------------------------------------------------------------------------
// Skip / force / symlinks
// ---------------------------------------------------------------------------
test('existing files are skipped without -f and refreshed with -f', () => {
  const repo = buildRepo();
  const dir = mkDir('ecc-omp-dest-');
  assert.strictEqual(runScript(repo, 'install.sh', ['common'], dir).status, 0);
  const targets = ['commands/plan.md', 'agents/planner.md', 'rules/coding-style.md', 'extensions/ecc-safety/index.ts'];
  for (const t of targets) fs.writeFileSync(path.join(dir, t), 'USER EDIT\n');
  const second = runScript(repo, 'install.sh', ['common'], dir);
  assert.strictEqual(second.status, 0, second.stderr + second.stdout);
  assert.ok(second.stdout.includes('SKIP'), second.stdout);
  for (const t of targets) assert.strictEqual(fs.readFileSync(path.join(dir, t), 'utf8'), 'USER EDIT\n', t);
  const forced = runScript(repo, 'install.sh', ['-f', 'common'], dir);
  assert.strictEqual(forced.status, 0, forced.stderr + forced.stdout);
  for (const t of targets) assert.notStrictEqual(fs.readFileSync(path.join(dir, t), 'utf8'), 'USER EDIT\n', t);
});

test('install -f leaves symlinked destinations and their targets untouched', () => {
  const repo = buildRepo();
  const dir = mkDir('ecc-omp-dest-');
  const clone = mkDir('ecc-omp-clone-');
  const link = (target, dest, content, isDir = false) => {
    const t = path.join(clone, target);
    if (isDir) {
      fs.mkdirSync(t, { recursive: true });
      fs.writeFileSync(path.join(t, 'f.txt'), content);
    } else {
      fs.writeFileSync(t, content);
    }
    fs.mkdirSync(path.dirname(path.join(dir, dest)), { recursive: true });
    fs.symlinkSync(t, path.join(dir, dest));
  };
  link('planner.md', 'agents/planner.md', 'CLONE PLANNER\n');
  link('plan.md', 'commands/plan.md', 'CLONE PLAN\n');
  link('rule.md', 'rules/coding-style.md', 'CLONE RULE\n');
  link('agents.md', 'AGENTS.md', 'CLONE AGENTS\n');
  link('skill', 'skills/example-skill', 'CLONE SKILL\n', true);
  link('ext', 'extensions/ecc-safety', 'CLONE EXT\n', true);
  const res = runScript(repo, 'install.sh', ['-f', 'common'], dir);
  assert.strictEqual(res.status, 0, res.stderr + res.stdout);
  assert.ok(/WARN.*symlink, not overwritten/.test(res.stdout), res.stdout);
  const read = (f) => fs.readFileSync(path.join(clone, f), 'utf8');
  assert.strictEqual(read('planner.md'), 'CLONE PLANNER\n');
  assert.strictEqual(read('plan.md'), 'CLONE PLAN\n');
  assert.strictEqual(read('rule.md'), 'CLONE RULE\n');
  assert.strictEqual(read('agents.md'), 'CLONE AGENTS\n');
  assert.deepStrictEqual(fs.readdirSync(path.join(clone, 'skill')), ['f.txt']);
  assert.deepStrictEqual(fs.readdirSync(path.join(clone, 'ext')), ['f.txt']);
});

// ---------------------------------------------------------------------------
// Manifest and prune
// ---------------------------------------------------------------------------
test('manifest lists rules, commands, skills and converted agents but not extensions', () => {
  const repo = buildRepo();
  const dir = mkDir('ecc-omp-dest-');
  assert.strictEqual(runScript(repo, 'install.sh', ['common'], dir).status, 0);
  const m = readManifest(dir);
  for (const e of ['rules/coding-style.md', 'commands/plan.md', 'skills/example-skill', 'agents/planner.md']) {
    assert.ok(m.includes(e), `${e} missing from manifest: ${m}`);
  }
  assert.ok(!/extensions\//.test(m), m);
});

test('-p prunes a command that was removed from content', () => {
  const repo = buildRepo();
  const dir = mkDir('ecc-omp-dest-');
  assert.strictEqual(runScript(repo, 'install.sh', ['common'], dir).status, 0);
  fs.rmSync(path.join(repo, 'content', 'commands', 'common', 'extra.md'));
  const noPrune = runScript(repo, 'install.sh', ['common'], dir);
  assert.ok(noPrune.stdout.includes('orphaned'), noPrune.stdout);
  assert.ok(fs.existsSync(path.join(dir, 'commands', 'extra.md')), 'no -p, no removal');
  const res = runScript(repo, 'install.sh', ['-p', 'common'], dir);
  assert.strictEqual(res.status, 0, res.stderr + res.stdout);
  assert.ok(!fs.existsSync(path.join(dir, 'commands', 'extra.md')));
  assert.ok(fs.existsSync(path.join(dir, 'commands', 'plan.md')));
  assert.ok(fs.existsSync(path.join(dir, 'extensions', 'ecc-safety', 'index.ts')));
});

test('a user edit of a skipped installed file is not pruned after a reinstall', () => {
  const repo = buildRepo();
  const dir = mkDir('ecc-omp-dest-');
  assert.strictEqual(runScript(repo, 'install.sh', ['common'], dir).status, 0);
  fs.writeFileSync(path.join(dir, 'agents', 'planner.md'), 'USER EDIT\n');
  assert.strictEqual(runScript(repo, 'install.sh', ['common'], dir).status, 0);
  assert.strictEqual(runScript(repo, 'install.sh', ['-p', 'common'], dir).status, 0);
  assert.strictEqual(fs.readFileSync(path.join(dir, 'agents', 'planner.md'), 'utf8'), 'USER EDIT\n');
});

// ---------------------------------------------------------------------------
// Uninstall
// ---------------------------------------------------------------------------
test('uninstall removes installed items and leaves unrelated user files', () => {
  const repo = buildRepo();
  const dir = mkDir('ecc-omp-dest-');
  assert.strictEqual(runScript(repo, 'install.sh', ['common'], dir).status, 0);
  fs.writeFileSync(path.join(dir, 'agents', 'mine.md'), 'mine\n');
  fs.writeFileSync(path.join(dir, 'config.yml'), 'x: 1\n');
  fs.mkdirSync(path.join(dir, 'extensions', 'my-ext'));
  fs.writeFileSync(path.join(dir, 'extensions', 'my-ext', 'index.ts'), '// mine\n');

  const dry = runScript(repo, 'uninstall.sh', ['-n', 'common'], dir);
  assert.strictEqual(dry.status, 0, dry.stderr + dry.stdout);
  assert.ok(fs.existsSync(path.join(dir, 'AGENTS.md')), 'dry run must not remove');

  const res = runScript(repo, 'uninstall.sh', ['common'], dir);
  assert.strictEqual(res.status, 0, res.stderr + res.stdout);
  for (const gone of ['AGENTS.md', 'rules', 'skills', 'commands', 'agents/planner.md', 'agents/notools.md',
    'extensions/ecc-safety', 'extensions/simple-english']) {
    assert.ok(!fs.existsSync(path.join(dir, gone)), `${gone} should be removed`);
  }
  assert.strictEqual(fs.readFileSync(path.join(dir, 'agents', 'mine.md'), 'utf8'), 'mine\n');
  assert.strictEqual(fs.readFileSync(path.join(dir, 'config.yml'), 'utf8'), 'x: 1\n');
  assert.ok(fs.existsSync(path.join(dir, 'extensions', 'my-ext', 'index.ts')));
});

test('uninstall keeps an edited extension, a user AGENTS.md and a symlinked AGENTS.md', () => {
  const repo = buildRepo();
  const dir = mkDir('ecc-omp-dest-');
  assert.strictEqual(runScript(repo, 'install.sh', ['common'], dir).status, 0);
  fs.writeFileSync(path.join(dir, 'extensions', 'simple-english', 'index.ts'), 'USER EDIT\n');
  fs.writeFileSync(path.join(dir, 'AGENTS.md'), '# my own instructions\n');
  const res = runScript(repo, 'uninstall.sh', ['common'], dir);
  assert.strictEqual(res.status, 0, res.stderr + res.stdout);
  assert.strictEqual(fs.readFileSync(path.join(dir, 'extensions', 'simple-english', 'index.ts'), 'utf8'), 'USER EDIT\n');
  assert.strictEqual(fs.readFileSync(path.join(dir, 'AGENTS.md'), 'utf8'), '# my own instructions\n');
  assert.ok(!fs.existsSync(path.join(dir, 'extensions', 'ecc-safety')));

  const dir2 = mkDir('ecc-omp-dest-');
  assert.strictEqual(runScript(repo, 'install.sh', ['common'], dir2).status, 0);
  const real = path.join(mkDir('ecc-omp-dots-'), 'AGENTS.md');
  fs.copyFileSync(path.join(dir2, 'AGENTS.md'), real);
  fs.rmSync(path.join(dir2, 'AGENTS.md'));
  fs.symlinkSync(real, path.join(dir2, 'AGENTS.md'));
  assert.strictEqual(runScript(repo, 'uninstall.sh', ['common'], dir2).status, 0);
  assert.ok(fs.lstatSync(path.join(dir2, 'AGENTS.md')).isSymbolicLink());
  assert.ok(fs.existsSync(real));
});

test('uninstall keeps never-manifested files that differ; manifest-owned edited ones are removed', () => {
  const repo = buildRepo();
  const dir = mkDir('ecc-omp-dest-');
  fs.mkdirSync(path.join(dir, 'commands'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'commands', 'plan.md'), 'USER COMMAND\n');
  assert.strictEqual(runScript(repo, 'install.sh', ['common'], dir).status, 0);
  fs.writeFileSync(path.join(dir, 'commands', 'extra.md'), 'EDITED\n');
  assert.strictEqual(runScript(repo, 'uninstall.sh', ['common'], dir).status, 0);
  assert.strictEqual(fs.readFileSync(path.join(dir, 'commands', 'plan.md'), 'utf8'), 'USER COMMAND\n');
  assert.ok(!fs.existsSync(path.join(dir, 'commands', 'extra.md')));
});

// ---------------------------------------------------------------------------
// pi regression
// ---------------------------------------------------------------------------
test('pi agent output is unchanged by the harness-aware awk program', () => {
  const tmp = mkDir('ecc-omp-pireg-');
  const src = path.join(tmp, 'p.md');
  fs.writeFileSync(src, PLANNER_MD);
  const script = [
    `REPO_ROOT=${JSON.stringify(repoRoot)}`,
    'source "$REPO_ROOT/scripts/lib/common.sh"',
    'source "$REPO_ROOT/scripts/lib/pi-agents.sh"',
    `pi_agent_render ${JSON.stringify(src)}`
  ].join('\n');
  const res = spawnSync('bash', ['-c', script], { encoding: 'utf8', env: { ...process.env, HOME: tmp } });
  assert.strictEqual(res.status, 0, res.stderr);
  assert.strictEqual(
    res.stdout,
    noModel(PLANNER_MD).replace(
      'tools: ["Read", "Grep", "Glob", "Bash", "Edit", "Write", "WebSearch"]',
      'tools: read, grep, find, bash, edit, write'
    )
  );
});

console.log(`\nPassed: ${passed}`);
console.log(`Failed: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
