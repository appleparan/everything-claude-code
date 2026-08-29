#!/usr/bin/env node
/**
 * Tests for jq-less environments: install/init scripts must never destroy
 * an existing settings.json and must print jq install guidance.
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawnSync } = require('child_process');

const repoRoot = path.join(__dirname, '..', '..');
const claudeInstall = path.join(repoRoot, 'targets', 'claude', 'install.sh');
const initProject = path.join(repoRoot, 'scripts', 'init-project.sh');

// Build a PATH directory containing every binary from /usr/bin and /bin
// except jq, so `command -v jq` fails while everything else still works.
function makeJqlessBin() {
  const binDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ecc-jqless-'));
  for (const dir of ['/usr/bin', '/bin']) {
    let entries;
    try {
      entries = fs.readdirSync(dir);
    } catch {
      continue;
    }
    for (const f of entries) {
      if (f === 'jq') continue;
      try {
        fs.symlinkSync(path.join(dir, f), path.join(binDir, f));
      } catch {
        // duplicate entry (/bin symlinked to /usr/bin) — ignore
      }
    }
  }
  return binDir;
}

const jqlessBin = makeJqlessBin();

function runInstall(args, { home, jqless }) {
  const env = {
    ...process.env,
    HOME: home,
    PATH: jqless ? jqlessBin : '/usr/bin:/bin'
  };
  return spawnSync('bash', [claudeInstall, ...args], { env, encoding: 'utf8' });
}

function makeHome(settings) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'ecc-jq-home-'));
  fs.mkdirSync(path.join(home, '.claude'), { recursive: true });
  if (settings) {
    fs.writeFileSync(
      path.join(home, '.claude', 'settings.json'),
      JSON.stringify(settings, null, 2)
    );
  }
  return home;
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

test('no jq + existing settings.json: non-hook keys preserved, not overwritten', () => {
  const home = makeHome({ model: 'opus', permissions: { allow: ['Bash(ls:*)'] } });
  const res = runInstall(['-f', 'common'], { home, jqless: true });
  assert.strictEqual(res.status, 0, res.stderr);
  const settings = JSON.parse(
    fs.readFileSync(path.join(home, '.claude', 'settings.json'), 'utf8')
  );
  assert.strictEqual(settings.model, 'opus', 'model key was lost');
  assert.deepStrictEqual(
    settings.permissions,
    { allow: ['Bash(ls:*)'] },
    'permissions key was lost'
  );
  const out = res.stdout + res.stderr;
  assert.ok(/jq not found/.test(out), 'expected jq not found warning');
  assert.ok(/apt install jq/.test(out) && /brew install jq/.test(out), 'expected per-OS jq install hint');
});

test('no jq + multiple hooks files: merge skipped with install hint', () => {
  const home = makeHome(null);
  const res = runInstall(['-f', 'common', 'node'], { home, jqless: true });
  assert.strictEqual(res.status, 0, res.stderr);
  assert.ok(
    !fs.existsSync(path.join(home, '.claude', 'settings.json')),
    'settings.json must not be written from a partial merge'
  );
  const out = res.stdout + res.stderr;
  assert.ok(/jq not found/.test(out), 'expected jq not found warning');
  assert.ok(/apt install jq/.test(out) && /brew install jq/.test(out), 'expected per-OS jq install hint');
  assert.ok(/Skipped:.*1/.test(out), 'skipped hooks merge must count in the summary');
});

test('no jq + single hooks file + no existing settings.json: install succeeds', () => {
  const home = makeHome(null);
  const res = runInstall(['-f', 'common'], { home, jqless: true });
  assert.strictEqual(res.status, 0, res.stderr);
  const settings = JSON.parse(
    fs.readFileSync(path.join(home, '.claude', 'settings.json'), 'utf8')
  );
  assert.ok(settings.hooks, 'hooks key missing after jq-less single-file install');
});

test('with jq + existing settings.json: hooks merged, non-hook keys preserved', () => {
  const home = makeHome({ model: 'opus' });
  const res = runInstall(['-f', 'common'], { home, jqless: false });
  assert.strictEqual(res.status, 0, res.stderr);
  const settings = JSON.parse(
    fs.readFileSync(path.join(home, '.claude', 'settings.json'), 'utf8')
  );
  assert.strictEqual(settings.model, 'opus', 'model key was lost');
  assert.ok(settings.hooks, 'hooks key missing after install');
});

test('no jq + init-project.sh multi-language: fails with install hint', () => {
  const home = makeHome(null);
  const hooksDir = path.join(home, '.claude', 'project-hooks');
  fs.mkdirSync(hooksDir, { recursive: true });
  const template = { hooks: { PreToolUse: [] } };
  fs.writeFileSync(path.join(hooksDir, 'python.json'), JSON.stringify(template));
  fs.writeFileSync(path.join(hooksDir, 'node.json'), JSON.stringify(template));
  const projDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ecc-jq-proj-'));

  const env = { ...process.env, HOME: home, PATH: jqlessBin };
  const res = spawnSync('bash', [initProject, 'python', 'node'], {
    env,
    cwd: projDir,
    encoding: 'utf8'
  });
  assert.notStrictEqual(res.status, 0, 'expected non-zero exit without jq');
  const out = res.stdout + res.stderr;
  assert.ok(/jq is required/.test(out), 'expected jq required error');
  assert.ok(/apt install jq/.test(out) && /brew install jq/.test(out), 'expected per-OS jq install hint');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
