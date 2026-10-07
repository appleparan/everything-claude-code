#!/usr/bin/env node
/**
 * Tests for Codex plugins: targets/codex/install.sh must run
 * `codex plugin marketplace add` + `codex plugin add` for each entry in
 * content/targets/codex/plugins.json, and uninstall.sh must reverse both.
 *
 * The real codex binary is never run: every spawn either puts a stub codex
 * first on PATH, uses a PATH without codex, sets ECC_SKIP_CODEX_PLUGINS=1,
 * or has no plugins.json in the fixture.
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawnSync } = require('child_process');

const repoRoot = path.join(__dirname, '..', '..');
const SOURCE = 'AminBlg/SimpleEnglish';
const ENTRY = {
  name: 'simple-english',
  marketplace: 'simple-english',
  source: SOURCE,
  replaces_skill: 'simple-english'
};

function mkTmp(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function buildRepo(plugins) {
  const dir = mkTmp('ecc-codex-plugins-fixture-');
  fs.cpSync(path.join(repoRoot, 'scripts'), path.join(dir, 'scripts'), { recursive: true });
  fs.cpSync(path.join(repoRoot, 'targets'), path.join(dir, 'targets'), { recursive: true });
  const w = (rel, content) => {
    const full = path.join(dir, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  };
  w('content/instructions/global.md', '# Global\n');
  w('content/rules/common/coding-style.md', '# Coding Style\n');
  w('content/mcp/servers.json', JSON.stringify({ mcpServers: {} }, null, 2) + '\n');
  if (plugins !== null) {
    w('content/targets/codex/plugins.json', JSON.stringify({ plugins }, null, 2) + '\n');
  }
  return dir;
}

// Stub codex: logs "$@" as one line to $CODEX_STUB_LOG, exits with `code`.
function makeStub(code) {
  const bin = mkTmp('ecc-codex-plugins-stub-');
  const file = path.join(bin, 'codex');
  fs.writeFileSync(
    file,
    `#!/usr/bin/env bash\necho "$@" >> "$CODEX_STUB_LOG"\n[ ${code} -ne 0 ] && echo "stub failure" >&2\nexit ${code}\n`
  );
  fs.chmodSync(file, 0o755);
  return bin;
}

// PATH directory with every binary from /usr/bin and /bin except codex.
function makeCodexlessBin() {
  const binDir = mkTmp('ecc-codex-plugins-nocodex-');
  for (const dir of ['/usr/bin', '/bin']) {
    let entries;
    try {
      entries = fs.readdirSync(dir);
    } catch {
      continue;
    }
    for (const f of entries) {
      if (f === 'codex') continue;
      try {
        fs.symlinkSync(path.join(dir, f), path.join(binDir, f));
      } catch {
        // duplicate entry (/bin symlinked to /usr/bin) - ignore
      }
    }
  }
  return binDir;
}

function run(repoDir, script, args, { stub, pathOverride, env: extraEnv = {} } = {}) {
  const codexHome = extraEnv.CODEX_HOME || mkTmp('ecc-codex-plugins-home-');
  const log = path.join(mkTmp('ecc-codex-plugins-log-'), 'calls.log');
  const env = { ...process.env, CODEX_HOME: codexHome, CODEX_STUB_LOG: log, ...extraEnv };
  if (stub) env.PATH = stub + ':' + process.env.PATH;
  if (pathOverride) env.PATH = pathOverride;
  const res = spawnSync('bash', [path.join(repoDir, 'targets', 'codex', script), ...args], {
    env,
    encoding: 'utf8'
  });
  const calls = fs.existsSync(log) ? fs.readFileSync(log, 'utf8').split('\n').filter(Boolean) : [];
  return { res, calls, codexHome, out: res.stdout + res.stderr };
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

test('install adds the marketplace then the plugin and prints the /hooks hint', () => {
  const { res, calls, out } = run(buildRepo([ENTRY]), 'install.sh', ['common'], {
    stub: makeStub(0)
  });
  assert.strictEqual(res.status, 0, out);
  assert.deepStrictEqual(calls, [
    `plugin marketplace add ${SOURCE}`,
    'plugin add simple-english@simple-english'
  ]);
  assert.ok(/INFO.*\/hooks/.test(out), 'expected the /hooks trust hint');
});

test('dry run calls nothing and lists the plugin', () => {
  const { res, calls, out } = run(buildRepo([ENTRY]), 'install.sh', ['-n', 'common'], {
    stub: makeStub(0)
  });
  assert.strictEqual(res.status, 0, out);
  assert.deepStrictEqual(calls, []);
  assert.ok(out.includes('simple-english@simple-english'), 'expected the plugin in dry-run output');
});

test('ECC_SKIP_CODEX_PLUGINS=1 calls nothing', () => {
  const { res, calls, out } = run(buildRepo([ENTRY]), 'install.sh', ['common'], {
    stub: makeStub(0),
    env: { ECC_SKIP_CODEX_PLUGINS: '1' }
  });
  assert.strictEqual(res.status, 0, out);
  assert.deepStrictEqual(calls, []);
  assert.ok(/ECC_SKIP_CODEX_PLUGINS/.test(out), 'expected a skip notice');
});

test('missing codex binary warns with manual commands and exits 0', () => {
  const { res, out } = run(buildRepo([ENTRY]), 'install.sh', ['common'], {
    pathOverride: makeCodexlessBin()
  });
  assert.strictEqual(res.status, 0, out);
  assert.ok(/WARN.*codex not found/.test(out), 'expected a codex-not-found warning');
  assert.ok(out.includes(`codex plugin marketplace add ${SOURCE}`), 'expected manual commands');
});

test('failing codex warns, skips the entry and exits 0', () => {
  const { res, out } = run(buildRepo([ENTRY]), 'install.sh', ['common'], { stub: makeStub(1) });
  assert.strictEqual(res.status, 0, out);
  assert.ok(/WARN.*skipped/.test(out), 'expected a skipped warning');
  assert.ok(out.includes('stub failure'), 'expected the codex error line in the warning');
  assert.ok(!/\/hooks/.test(out), 'no trust hint when nothing was added');
});

test('install removes an external skills/simple-english/ only when it has the marker', () => {
  const repo = buildRepo([ENTRY]);
  const stub = makeStub(0);

  const withMarker = mkTmp('ecc-codex-plugins-home-');
  const skillA = path.join(withMarker, 'skills', 'simple-english');
  fs.mkdirSync(skillA, { recursive: true });
  fs.writeFileSync(path.join(skillA, 'SKILL.md'), '# s\n');
  fs.writeFileSync(path.join(skillA, '.ecc-external'), 'repo\n');
  let r = run(repo, 'install.sh', ['common'], { stub, env: { CODEX_HOME: withMarker } });
  assert.strictEqual(r.res.status, 0, r.out);
  assert.ok(!fs.existsSync(skillA), 'marked external skill must be removed');
  assert.ok(/removed: the plugin now provides/.test(r.out));

  const noMarker = mkTmp('ecc-codex-plugins-home-');
  const skillB = path.join(noMarker, 'skills', 'simple-english');
  fs.mkdirSync(skillB, { recursive: true });
  fs.writeFileSync(path.join(skillB, 'SKILL.md'), '# mine\n');
  r = run(repo, 'install.sh', ['common'], { stub, env: { CODEX_HOME: noMarker } });
  assert.strictEqual(r.res.status, 0, r.out);
  assert.ok(fs.existsSync(path.join(skillB, 'SKILL.md')), 'unmarked skill must be kept');
});

test('uninstall removes the plugin then the marketplace', () => {
  const { res, calls, out } = run(buildRepo([ENTRY]), 'uninstall.sh', ['common'], {
    stub: makeStub(0)
  });
  assert.strictEqual(res.status, 0, out);
  assert.deepStrictEqual(calls, [
    'plugin remove simple-english@simple-english',
    'plugin marketplace remove simple-english'
  ]);
});

test('without plugins.json install prints nothing about plugins and exits 0', () => {
  const { res, calls, out } = run(buildRepo(null), 'install.sh', ['common'], {
    stub: makeStub(0)
  });
  assert.strictEqual(res.status, 0, out);
  assert.deepStrictEqual(calls, []);
  assert.ok(!/\[plugins\]|codex plugin|plugins\.json/.test(out), 'no plugin output expected');
});

test('an entry with an invalid name is skipped with a warning and no codex call', () => {
  const bad = { ...ENTRY, name: '../evil/name', replaces_skill: '' };
  const { res, calls, out } = run(buildRepo([bad]), 'install.sh', ['common'], {
    stub: makeStub(0)
  });
  assert.strictEqual(res.status, 0, out);
  assert.deepStrictEqual(calls, []);
  assert.ok(/WARN.*invalid entry/.test(out), 'expected an invalid-entry warning');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
