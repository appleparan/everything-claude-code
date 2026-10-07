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
    `#!/usr/bin/env bash
echo "$@" >> "$CODEX_STUB_LOG"
if [ ${code} -ne 0 ]; then echo "stub failure" >&2; exit ${code}; fi
if [ "$1 $2 $3" = "plugin marketplace add" ]; then
  if [ "$CODEX_STUB_MARKET" = "existing" ]; then echo "Marketplace \`simple-english\` is already added"
  else echo "Added marketplace \`simple-english\`"; fi
fi
exit 0
`
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

const STATE = '.ecc-codex-plugins';

function homeWithState(content) {
  const home = mkTmp('ecc-codex-plugins-home-');
  if (content !== null) fs.writeFileSync(path.join(home, STATE), content);
  return home;
}

function markedSkill(home) {
  const dir = path.join(home, 'skills', 'simple-english');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'SKILL.md'), '# s\n');
  fs.writeFileSync(path.join(dir, '.ecc-external'), 'repo\n');
  return dir;
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

test('install records ownership: flag 1 when it added the marketplace, 0 when it pre-existed', () => {
  const repo = buildRepo([ENTRY]);
  const stub = makeStub(0);
  let r = run(repo, 'install.sh', ['common'], { stub });
  assert.strictEqual(r.res.status, 0, r.out);
  assert.strictEqual(
    fs.readFileSync(path.join(r.codexHome, STATE), 'utf8'),
    'simple-english@simple-english\t1\n'
  );
  r = run(repo, 'install.sh', ['common'], { stub, env: { CODEX_STUB_MARKET: 'existing' } });
  assert.strictEqual(r.res.status, 0, r.out);
  assert.strictEqual(
    fs.readFileSync(path.join(r.codexHome, STATE), 'utf8'),
    'simple-english@simple-english\t0\n'
  );
});

test('install keeps flag 1 on a re-install and replaces (not duplicates) the line', () => {
  const home = homeWithState('other@x\t0\nsimple-english@simple-english\t1\n');
  const r = run(buildRepo([ENTRY]), 'install.sh', ['common'], {
    stub: makeStub(0),
    env: { CODEX_HOME: home, CODEX_STUB_MARKET: 'existing' }
  });
  assert.strictEqual(r.res.status, 0, r.out);
  assert.strictEqual(
    fs.readFileSync(path.join(home, STATE), 'utf8'),
    'other@x\t0\nsimple-english@simple-english\t1\n'
  );
});

test('install does not write through a symlinked state file', () => {
  const home = mkTmp('ecc-codex-plugins-home-');
  const target = path.join(mkTmp('ecc-codex-plugins-link-'), 'victim');
  fs.writeFileSync(target, 'keep\n');
  fs.symlinkSync(target, path.join(home, STATE));
  const r = run(buildRepo([ENTRY]), 'install.sh', ['common'], {
    stub: makeStub(0),
    env: { CODEX_HOME: home }
  });
  assert.strictEqual(r.res.status, 0, r.out);
  assert.strictEqual(fs.readFileSync(target, 'utf8'), 'keep\n');
  assert.ok(/WARN.*symlink/.test(r.out), 'expected a symlink warning');
});

test('uninstall skips a plugin not in the state file and calls no codex', () => {
  const { res, calls, out } = run(buildRepo([ENTRY]), 'uninstall.sh', ['common'], {
    stub: makeStub(0)
  });
  assert.strictEqual(res.status, 0, out);
  assert.deepStrictEqual(calls, []);
  assert.ok(/SKIP.*codex plugin simple-english@simple-english/.test(out), out);
});

test('uninstall with flag 1 removes the plugin then the marketplace and deletes the state file', () => {
  const home = homeWithState('simple-english@simple-english\t1\n');
  const { res, calls, out } = run(buildRepo([ENTRY]), 'uninstall.sh', ['common'], {
    stub: makeStub(0),
    env: { CODEX_HOME: home }
  });
  assert.strictEqual(res.status, 0, out);
  assert.deepStrictEqual(calls, [
    'plugin remove simple-english@simple-english',
    'plugin marketplace remove simple-english'
  ]);
  assert.ok(!fs.existsSync(path.join(home, STATE)), 'empty state file must be removed');
});

test('uninstall with flag 0 removes only the plugin and keeps other state lines', () => {
  const home = homeWithState('simple-english@simple-english\t0\nother@x\t1\n');
  const { res, calls, out } = run(buildRepo([ENTRY]), 'uninstall.sh', ['common'], {
    stub: makeStub(0),
    env: { CODEX_HOME: home }
  });
  assert.strictEqual(res.status, 0, out);
  assert.deepStrictEqual(calls, ['plugin remove simple-english@simple-english']);
  assert.strictEqual(fs.readFileSync(path.join(home, STATE), 'utf8'), 'other@x\t1\n');
});

test('uninstall removes a stale marked skills/simple-english/ and keeps an unmarked one', () => {
  const repo = buildRepo([ENTRY]);
  const stub = makeStub(0);
  const homeA = mkTmp('ecc-codex-plugins-home-');
  const skillA = markedSkill(homeA);
  let r = run(repo, 'uninstall.sh', ['common'], { stub, env: { CODEX_HOME: homeA } });
  assert.strictEqual(r.res.status, 0, r.out);
  assert.ok(!fs.existsSync(skillA), 'marked stale skill must be removed');

  const homeB = mkTmp('ecc-codex-plugins-home-');
  const skillB = path.join(homeB, 'skills', 'simple-english');
  fs.mkdirSync(skillB, { recursive: true });
  fs.writeFileSync(path.join(skillB, 'SKILL.md'), '# mine\n');
  r = run(repo, 'uninstall.sh', ['common'], { stub, env: { CODEX_HOME: homeB } });
  assert.strictEqual(r.res.status, 0, r.out);
  assert.ok(fs.existsSync(path.join(skillB, 'SKILL.md')), 'unmarked skill must be kept');
});

test('uninstall dry run calls nothing and keeps the state file', () => {
  const home = homeWithState('simple-english@simple-english\t1\n');
  const { res, calls, out } = run(buildRepo([ENTRY]), 'uninstall.sh', ['-n', 'common'], {
    stub: makeStub(0),
    env: { CODEX_HOME: home }
  });
  assert.strictEqual(res.status, 0, out);
  assert.deepStrictEqual(calls, []);
  assert.ok(out.includes('codex plugin simple-english@simple-english'));
  assert.strictEqual(
    fs.readFileSync(path.join(home, STATE), 'utf8'),
    'simple-english@simple-english\t1\n'
  );
});

test('uninstall with codex missing warns and keeps the state file', () => {
  const home = homeWithState('simple-english@simple-english\t1\n');
  const { res, out } = run(buildRepo([ENTRY]), 'uninstall.sh', ['common'], {
    pathOverride: makeCodexlessBin(),
    env: { CODEX_HOME: home }
  });
  assert.strictEqual(res.status, 0, out);
  assert.ok(/WARN.*codex not found/.test(out), out);
  assert.strictEqual(
    fs.readFileSync(path.join(home, STATE), 'utf8'),
    'simple-english@simple-english\t1\n'
  );
});

test('install dry run with codex missing warns instead of listing the add', () => {
  const { res, out } = run(buildRepo([ENTRY]), 'install.sh', ['-n', 'common'], {
    pathOverride: makeCodexlessBin()
  });
  assert.strictEqual(res.status, 0, out);
  assert.ok(/WARN.*codex not found/.test(out), out);
  assert.ok(!/DRY.*codex plugin add/.test(out), 'must not list the add as planned');
});

test('install dry run lists the marked stale skill removal', () => {
  const home = mkTmp('ecc-codex-plugins-home-');
  const skill = markedSkill(home);
  const { res, calls, out } = run(buildRepo([ENTRY]), 'install.sh', ['-n', 'common'], {
    stub: makeStub(0),
    env: { CODEX_HOME: home }
  });
  assert.strictEqual(res.status, 0, out);
  assert.deepStrictEqual(calls, []);
  assert.ok(/DRY.*skills\/simple-english\//.test(out), out);
  assert.ok(fs.existsSync(skill), 'dry run must not delete');
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
