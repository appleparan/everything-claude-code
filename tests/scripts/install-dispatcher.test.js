#!/usr/bin/env node
/**
 * Tests for scripts/install.sh --target dispatch.
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawnSync } = require('child_process');

const repoRoot = path.join(__dirname, '..', '..');
const installSh = path.join(repoRoot, 'scripts', 'install.sh');

function run(args, envOverrides = {}) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'ecc-dispatch-'));
  const env = {
    ...process.env,
    HOME: home,
    PATH: '/usr/bin:/bin',
    ...envOverrides
  };
  delete env.CODEX_HOME;
  delete env.PI_CODING_AGENT_DIR;
  delete env.OPENCODE_CONFIG_DIR;
  delete env.XDG_CONFIG_HOME;
  Object.assign(env, envOverrides);
  const res = spawnSync('bash', [installSh, ...args], { env, encoding: 'utf8' });
  return { ...res, home };
}

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

test('--target claude dry-run installs CLAUDE.md, no AGENTS.md', () => {
  const res = run(['-n', '--target', 'claude', 'common']);
  assert.strictEqual(res.status, 0, res.stderr);
  assert.ok(res.stdout.includes('CLAUDE.md'), 'expected CLAUDE.md in output');
  assert.ok(!res.stdout.includes('AGENTS.md'), 'AGENTS.md must not appear for claude target');
});

test('unknown --target fails with error', () => {
  const res = run(['-n', '--target', 'bogus', 'common']);
  assert.notStrictEqual(res.status, 0);
  assert.ok((res.stdout + res.stderr).includes('Unknown target'), 'expected Unknown target error');
});

test('default target all without codex skips codex with INFO', () => {
  const res = run(['-n', 'common']);
  assert.strictEqual(res.status, 0, res.stderr);
  assert.ok(res.stdout.includes('CLAUDE.md'));
  assert.ok(res.stdout.includes('Codex not detected'), 'expected skip message');
});

test('--target codex dry-run plans AGENTS.md, instructions, and skills', () => {
  const codexHome = fs.mkdtempSync(path.join(os.tmpdir(), 'ecc-codex-'));
  const res = run(['-n', '--target', 'codex', 'common', 'python'],
    { CODEX_HOME: codexHome });
  assert.strictEqual(res.status, 0, res.stderr);
  assert.ok(res.stdout.includes('AGENTS.md'), 'AGENTS.md missing from plan');
  assert.ok(res.stdout.includes('instructions/coding-style.md'), 'rules copy missing');
  assert.ok(res.stdout.includes('skills/git-commit-msg'), 'skill copy missing');
});

test('--target codex without codex fails', () => {
  const res = run(['-n', '--target', 'codex', 'common']);
  assert.notStrictEqual(res.status, 0);
  assert.ok((res.stdout + res.stderr).includes('Codex not detected'));
});

test('uninstall --target codex dry-run plans removals but not config.toml', () => {
  const codexHome = fs.mkdtempSync(path.join(os.tmpdir(), 'ecc-codex-un-'));
  const uninstallSh = path.join(repoRoot, 'scripts', 'uninstall.sh');
  const env = { ...process.env, HOME: fs.mkdtempSync(path.join(os.tmpdir(), 'ecc-h-')), CODEX_HOME: codexHome, PATH: '/usr/bin:/bin' };
  fs.writeFileSync(path.join(codexHome, 'config.toml'), 'model = "test"\n');
  const res = spawnSync('bash', [uninstallSh, '-n', '--target', 'codex', 'common'], { env, encoding: 'utf8' });
  assert.strictEqual(res.status, 0, res.stderr);
  assert.ok(res.stdout.includes('AGENTS.md'));
  assert.ok(res.stdout.includes('instructions/coding-style.md'));
  assert.ok(res.stdout.includes('mcp_servers'), 'expected manual-removal INFO for MCP');
  assert.ok(!/RM.*config\.toml/.test(res.stdout), 'config.toml must never be scheduled for removal');
  assert.strictEqual(fs.readFileSync(path.join(codexHome, 'config.toml'), 'utf8'), 'model = "test"\n', 'config.toml content must be untouched');
});

test('-m passes through the dispatcher to both targets without a getopts error', () => {
  const codexHome = fs.mkdtempSync(path.join(os.tmpdir(), 'ecc-dispatch-mcp-codex-'));
  const res = run(['-n', '-m', '--target', 'all', 'common'], { CODEX_HOME: codexHome });
  assert.strictEqual(res.status, 0, res.stderr);
  assert.ok(res.stdout.includes('[mcp]'), 'expected a [mcp] section in the output');
});

// --- Target registry: run the real dispatchers against a fake repo whose
// targets/*/install.sh are stubs, so discovery is tested independent of
// the real claude/codex installers.
function makeFakeRepo(targets) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ecc-registry-'));
  fs.cpSync(path.join(repoRoot, 'scripts', 'lib'), path.join(dir, 'scripts', 'lib'), { recursive: true });
  for (const f of ['install.sh', 'uninstall.sh']) {
    fs.copyFileSync(path.join(repoRoot, 'scripts', f), path.join(dir, 'scripts', f));
  }
  for (const [name, available] of Object.entries(targets)) {
    const tdir = path.join(dir, 'targets', name);
    fs.mkdirSync(tdir, { recursive: true });
    fs.writeFileSync(path.join(tdir, 'target.sh'),
      `target_is_available() { ${available ? 'return 0' : 'return 1'}; }\n`);
    for (const kind of ['install', 'uninstall']) {
      fs.writeFileSync(path.join(tdir, `${kind}.sh`), `#!/usr/bin/env bash\necho "RAN ${name} ${kind}"\n`, { mode: 0o755 });
    }
  }
  return dir;
}

function runFake(dir, script, args) {
  const env = { ...process.env, PATH: '/usr/bin:/bin', HOME: fs.mkdtempSync(path.join(os.tmpdir(), 'ecc-h-')) };
  delete env.CODEX_HOME;
  delete env.PI_CODING_AGENT_DIR;
  delete env.OPENCODE_CONFIG_DIR;
  delete env.XDG_CONFIG_HOME;
  return spawnSync('bash', [path.join(dir, 'scripts', script), ...args], { env, encoding: 'utf8' });
}

test('unknown --target error lists every discovered target', () => {
  const dir = makeFakeRepo({ claude: true, alpha: true, zeta: false });
  const res = runFake(dir, 'install.sh', ['--target', 'bogus', 'common']);
  assert.notStrictEqual(res.status, 0);
  const out = res.stdout + res.stderr;
  assert.ok(out.includes("Unknown target 'bogus'"), out);
  for (const name of ['claude', 'alpha', 'zeta']) {
    assert.ok(out.includes(name), `error must list ${name}: ${out}`);
  }
});

test('real unknown --target error lists claude, codex, pi and opencode', () => {
  const res = run(['-n', '--target', 'bogus', 'common']);
  const out = res.stdout + res.stderr;
  assert.ok(out.includes('claude') && out.includes('codex') && out.includes('pi') && out.includes('opencode'), out);
});

test('--target pi dry-run plans AGENTS.md, prompts, agents and extensions', () => {
  const piDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ecc-pi-'));
  const res = run(['-n', '--target', 'pi', 'common'], { PI_CODING_AGENT_DIR: piDir });
  assert.strictEqual(res.status, 0, res.stderr + res.stdout);
  for (const s of ['AGENTS.md', '[prompts]', '[agents]', 'extensions/ecc-safety/']) {
    assert.ok(res.stdout.includes(s), `expected ${s}: ${res.stdout}`);
  }
  assert.ok(!res.stdout.includes('CLAUDE.md'));
});

test('--target pi without pi fails', () => {
  const res = run(['-n', '--target', 'pi', 'common']);
  assert.notStrictEqual(res.status, 0);
  assert.ok((res.stdout + res.stderr).includes('pi not detected'));
});

test('default target all skips pi with INFO when pi is absent', () => {
  const res = run(['-n', 'common']);
  assert.strictEqual(res.status, 0, res.stderr);
  assert.ok(res.stdout.includes('Pi not detected; skipping pi target'), res.stdout);
});

test('target all with -m installs pi when detected (-m ignored)', () => {
  const piDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ecc-pi-'));
  const res = run(['-n', '-m', '--target', 'all', 'common'], { PI_CODING_AGENT_DIR: piDir });
  assert.strictEqual(res.status, 0, res.stderr + res.stdout);
  assert.ok(res.stdout.includes('extensions/ecc-safety/'), res.stdout);
});

test('uninstall --target pi dry-run plans removals', () => {
  const piDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ecc-pi-un-'));
  const uninstallSh = path.join(repoRoot, 'scripts', 'uninstall.sh');
  const env = { ...process.env, HOME: fs.mkdtempSync(path.join(os.tmpdir(), 'ecc-h-')), PI_CODING_AGENT_DIR: piDir, PATH: '/usr/bin:/bin' };
  const res = spawnSync('bash', [uninstallSh, '-n', '--target', 'pi', 'common'], { env, encoding: 'utf8' });
  assert.strictEqual(res.status, 0, res.stderr + res.stdout);
  assert.ok(res.stdout.includes('AGENTS.md'), res.stdout);
});

test('--target opencode dry-run plans AGENTS.md, commands, agents and opencode.json', () => {
  const ocDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ecc-oc-'));
  const res = run(['-n', '--target', 'opencode', 'common'], { OPENCODE_CONFIG_DIR: ocDir });
  assert.strictEqual(res.status, 0, res.stderr + res.stdout);
  for (const s of ['AGENTS.md', '[commands]', '[agents]', 'opencode.json']) {
    assert.ok(res.stdout.includes(s), `expected ${s}: ${res.stdout}`);
  }
  assert.ok(!res.stdout.includes('CLAUDE.md'));
});

test('--target opencode without OpenCode fails', () => {
  const res = run(['-n', '--target', 'opencode', 'common']);
  assert.notStrictEqual(res.status, 0);
  assert.ok((res.stdout + res.stderr).includes('OpenCode not detected'));
});

test('default target all skips opencode with INFO when OpenCode is absent', () => {
  const res = run(['-n', 'common']);
  assert.strictEqual(res.status, 0, res.stderr);
  assert.ok(res.stdout.includes('Opencode not detected; skipping opencode target'), res.stdout);
});

test('target all with -m installs opencode when detected (-m ignored)', () => {
  const ocDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ecc-oc-'));
  const res = run(['-n', '-m', '--target', 'all', 'common'], { OPENCODE_CONFIG_DIR: ocDir });
  assert.strictEqual(res.status, 0, res.stderr + res.stdout);
  assert.ok(res.stdout.includes('opencode.json'), res.stdout);
});

test('uninstall --target opencode dry-run plans removals', () => {
  const ocDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ecc-oc-un-'));
  const uninstallSh = path.join(repoRoot, 'scripts', 'uninstall.sh');
  const env = { ...process.env, HOME: fs.mkdtempSync(path.join(os.tmpdir(), 'ecc-h-')), OPENCODE_CONFIG_DIR: ocDir, PATH: '/usr/bin:/bin' };
  const res = spawnSync('bash', [uninstallSh, '-n', '--target', 'opencode', 'common'], { env, encoding: 'utf8' });
  assert.strictEqual(res.status, 0, res.stderr + res.stdout);
  assert.ok(res.stdout.includes('AGENTS.md'), res.stdout);
});

test('--target <discovered name> runs only that target', () => {
  const dir = makeFakeRepo({ claude: true, alpha: true });
  const res = runFake(dir, 'install.sh', ['--target', 'alpha', 'common']);
  assert.strictEqual(res.status, 0, res.stderr);
  assert.ok(res.stdout.includes('RAN alpha install'));
  assert.ok(!res.stdout.includes('RAN claude'));
});

test('all runs claude first, then available targets, and skips unavailable ones', () => {
  const dir = makeFakeRepo({ claude: true, alpha: true, zeta: false });
  const res = runFake(dir, 'install.sh', ['common']);
  assert.strictEqual(res.status, 0, res.stderr);
  const out = res.stdout;
  assert.ok(out.indexOf('RAN claude install') >= 0 && out.indexOf('RAN claude install') < out.indexOf('RAN alpha install'),
    `claude must run before alpha: ${out}`);
  assert.ok(!out.includes('RAN zeta'), 'unavailable target must not run');
  assert.ok(out.includes('Zeta not detected; skipping zeta target'), out);
});

test('claude runs first under all even when it sorts after another target', () => {
  const dir = makeFakeRepo({ alpha: true, claude: true });
  const res = runFake(dir, 'install.sh', ['common']);
  assert.ok(res.stdout.indexOf('RAN claude install') < res.stdout.indexOf('RAN alpha install'), res.stdout);
});

test('uninstall dispatcher mirrors registry discovery and skipping', () => {
  const dir = makeFakeRepo({ claude: true, alpha: true, zeta: false });
  const all = runFake(dir, 'uninstall.sh', ['common']);
  assert.strictEqual(all.status, 0, all.stderr);
  assert.ok(all.stdout.includes('RAN claude uninstall') && all.stdout.includes('RAN alpha uninstall'));
  assert.ok(all.stdout.includes('Zeta not detected; skipping zeta target'));
  const bad = runFake(dir, 'uninstall.sh', ['--target', 'bogus', 'common']);
  assert.notStrictEqual(bad.status, 0);
  assert.ok((bad.stdout + bad.stderr).includes('alpha'), 'unknown target error must list names');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
