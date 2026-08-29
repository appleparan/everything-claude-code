#!/usr/bin/env node
/**
 * Tests for plugin migration: targets/claude/install.sh must merge
 * content/plugins/plugins.json (enabledPlugins + extraKnownMarketplaces)
 * into ~/.claude/settings.json, and uninstall.sh must remove only the
 * repo-tracked entries.
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

const PLUGINS_JSON = {
  enabledPlugins: {
    'alpha@official-market': true,
    'beta@custom-market': true
  },
  extraKnownMarketplaces: {
    'custom-market': {
      source: { source: 'github', repo: 'acme/custom-market' }
    }
  },
  _comments: {
    usage: 'test fixture — must never be merged into settings.json'
  }
};

function writeFixtureContent(dir, { withPlugins = true } = {}) {
  const w = (rel, content) => {
    const full = path.join(dir, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  };
  w('content/instructions/global.md', '# Global\n');
  w('content/agents/common/planner.md', '# Planner\n');
  w('content/rules/common/coding-style.md', '# Coding Style\n');
  if (withPlugins) {
    w('content/plugins/plugins.json', JSON.stringify(PLUGINS_JSON, null, 2) + '\n');
  }
}

function buildRepo(opts = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ecc-plugins-repo-'));
  fs.cpSync(path.join(repoRoot, 'scripts'), path.join(dir, 'scripts'), { recursive: true });
  fs.cpSync(path.join(repoRoot, 'targets'), path.join(dir, 'targets'), { recursive: true });
  writeFixtureContent(dir, opts);
  return dir;
}

function mkHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ecc-plugins-home-'));
}

function runScript(repoDir, script, args, home, extraEnv = {}) {
  const sh = path.join(repoDir, 'targets', 'claude', script);
  const env = { ...process.env, HOME: home, ...extraEnv };
  delete env.CODEX_HOME;
  return spawnSync('bash', [sh, ...args], { env, encoding: 'utf8' });
}

function readSettings(home) {
  return JSON.parse(fs.readFileSync(path.join(home, '.claude', 'settings.json'), 'utf8'));
}

function writeSettings(home, obj) {
  const dir = path.join(home, '.claude');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'settings.json'), JSON.stringify(obj, null, 2) + '\n');
}

// Build a PATH directory containing every binary from /usr/bin and /bin
// except jq, so `command -v jq` fails while everything else still works.
function makeJqlessBin() {
  const binDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ecc-plugins-jqless-'));
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
// 1. Fresh HOME: install creates settings.json with the tracked plugin keys
// ---------------------------------------------------------------------------
test('fresh install writes enabledPlugins + extraKnownMarketplaces to settings.json', () => {
  const repo = buildRepo();
  const home = mkHome();
  const res = runScript(repo, 'install.sh', ['common'], home);
  assert.strictEqual(res.status, 0, res.stderr);

  const settings = readSettings(home);
  assert.deepStrictEqual(settings.enabledPlugins, PLUGINS_JSON.enabledPlugins);
  assert.deepStrictEqual(settings.extraKnownMarketplaces, PLUGINS_JSON.extraKnownMarketplaces);
  assert.strictEqual(settings._comments, undefined, '_comments must not leak into settings.json');
});

// ---------------------------------------------------------------------------
// 2. Existing settings.json without -f is untouched
// ---------------------------------------------------------------------------
test('existing settings.json without -f is left untouched', () => {
  const repo = buildRepo();
  const home = mkHome();
  writeSettings(home, { model: 'opus', enabledPlugins: { 'gamma@official-market': true } });
  const before = fs.readFileSync(path.join(home, '.claude', 'settings.json'), 'utf8');

  const res = runScript(repo, 'install.sh', ['common'], home);
  assert.strictEqual(res.status, 0, res.stderr);

  const after = fs.readFileSync(path.join(home, '.claude', 'settings.json'), 'utf8');
  assert.strictEqual(after, before, 'settings.json must not change without -f');
});

// ---------------------------------------------------------------------------
// 3. Existing settings.json with -f: additive merge, repo wins per key
// ---------------------------------------------------------------------------
test('install -f merges plugin keys and preserves unrelated settings', () => {
  const repo = buildRepo();
  const home = mkHome();
  writeSettings(home, {
    model: 'opus',
    permissions: { allow: ['Bash(ls:*)'] },
    enabledPlugins: {
      'gamma@official-market': true, // untracked — must survive
      'alpha@official-market': false // tracked — repo value (true) wins
    },
    extraKnownMarketplaces: {
      'user-market': { source: { source: 'github', repo: 'user/market' } }
    }
  });

  const res = runScript(repo, 'install.sh', ['-f', 'common'], home);
  assert.strictEqual(res.status, 0, res.stderr);

  const settings = readSettings(home);
  assert.strictEqual(settings.model, 'opus', 'unrelated keys must be preserved');
  assert.deepStrictEqual(settings.permissions, { allow: ['Bash(ls:*)'] });
  assert.strictEqual(settings.enabledPlugins['gamma@official-market'], true, 'untracked plugin must survive');
  assert.strictEqual(settings.enabledPlugins['alpha@official-market'], true, 'repo value must win');
  assert.strictEqual(settings.enabledPlugins['beta@custom-market'], true);
  assert.deepStrictEqual(
    settings.extraKnownMarketplaces['user-market'],
    { source: { source: 'github', repo: 'user/market' } },
    'untracked marketplace must survive'
  );
  assert.deepStrictEqual(
    settings.extraKnownMarketplaces['custom-market'],
    PLUGINS_JSON.extraKnownMarketplaces['custom-market']
  );
});

// ---------------------------------------------------------------------------
// 4. jq-less: existing settings.json is never destroyed
// ---------------------------------------------------------------------------
test('install -f without jq skips plugins and leaves settings.json intact', () => {
  const repo = buildRepo();
  const home = mkHome();
  writeSettings(home, { model: 'opus' });
  const before = fs.readFileSync(path.join(home, '.claude', 'settings.json'), 'utf8');

  const jqlessBin = makeJqlessBin();
  const res = runScript(repo, 'install.sh', ['-f', 'common'], home, { PATH: jqlessBin });
  assert.strictEqual(res.status, 0, res.stderr);

  const after = fs.readFileSync(path.join(home, '.claude', 'settings.json'), 'utf8');
  assert.strictEqual(after, before, 'settings.json must not be destroyed without jq');
  assert.ok(/jq/.test(res.stdout + res.stderr), 'expected a jq warning');
});

// ---------------------------------------------------------------------------
// 5. Dry run: nothing written
// ---------------------------------------------------------------------------
test('install -n does not create settings.json but lists plugins', () => {
  const repo = buildRepo();
  const home = mkHome();
  const res = runScript(repo, 'install.sh', ['-n', 'common'], home);
  assert.strictEqual(res.status, 0, res.stderr);
  assert.ok(!fs.existsSync(path.join(home, '.claude', 'settings.json')), 'dry run must not write settings.json');
  assert.ok(/\[plugins\]/.test(res.stdout), 'dry run output should have a [plugins] section');
});

// ---------------------------------------------------------------------------
// 6. Repo without content/plugins/plugins.json: install still succeeds
// ---------------------------------------------------------------------------
test('install without content/plugins/plugins.json is a no-op for plugins', () => {
  const repo = buildRepo({ withPlugins: false });
  const home = mkHome();
  const res = runScript(repo, 'install.sh', ['common'], home);
  assert.strictEqual(res.status, 0, res.stderr);
  assert.ok(!fs.existsSync(path.join(home, '.claude', 'settings.json')), 'no plugins file → no settings.json');
});

// ---------------------------------------------------------------------------
// 7. Uninstall removes only repo-tracked plugin entries
// ---------------------------------------------------------------------------
test('uninstall removes tracked plugin entries and preserves the rest', () => {
  const repo = buildRepo();
  const home = mkHome();
  writeSettings(home, {
    model: 'opus',
    enabledPlugins: {
      'alpha@official-market': true,
      'beta@custom-market': true,
      'gamma@official-market': true
    },
    extraKnownMarketplaces: {
      'custom-market': PLUGINS_JSON.extraKnownMarketplaces['custom-market'],
      'user-market': { source: { source: 'github', repo: 'user/market' } }
    }
  });

  const res = runScript(repo, 'uninstall.sh', ['common'], home);
  assert.strictEqual(res.status, 0, res.stderr);

  const settings = readSettings(home);
  assert.strictEqual(settings.model, 'opus', 'unrelated keys must be preserved');
  assert.strictEqual(settings.enabledPlugins['alpha@official-market'], undefined, 'tracked plugin must be removed');
  assert.strictEqual(settings.enabledPlugins['beta@custom-market'], undefined, 'tracked plugin must be removed');
  assert.strictEqual(settings.enabledPlugins['gamma@official-market'], true, 'untracked plugin must survive');
  assert.strictEqual(settings.extraKnownMarketplaces['custom-market'], undefined, 'tracked marketplace must be removed');
  assert.deepStrictEqual(
    settings.extraKnownMarketplaces['user-market'],
    { source: { source: 'github', repo: 'user/market' } },
    'untracked marketplace must survive'
  );
});

// ---------------------------------------------------------------------------
// 8. Uninstall drops plugin keys entirely when nothing untracked remains
// ---------------------------------------------------------------------------
test('uninstall deletes plugin keys left empty by the removal', () => {
  const repo = buildRepo();
  const home = mkHome();
  writeSettings(home, {
    model: 'opus',
    enabledPlugins: {
      'alpha@official-market': true,
      'beta@custom-market': true
    },
    extraKnownMarketplaces: {
      'custom-market': PLUGINS_JSON.extraKnownMarketplaces['custom-market']
    }
  });

  const res = runScript(repo, 'uninstall.sh', ['common'], home);
  assert.strictEqual(res.status, 0, res.stderr);

  const settings = readSettings(home);
  assert.strictEqual(settings.model, 'opus');
  assert.strictEqual(settings.enabledPlugins, undefined, 'emptied enabledPlugins key must be dropped');
  assert.strictEqual(settings.extraKnownMarketplaces, undefined, 'emptied extraKnownMarketplaces key must be dropped');
});

// ---------------------------------------------------------------------------
// 9. Uninstall without settings.json reports not-found, does not fail
// ---------------------------------------------------------------------------
test('uninstall without settings.json succeeds and reports not found', () => {
  const repo = buildRepo();
  const home = mkHome();
  const res = runScript(repo, 'uninstall.sh', ['common'], home);
  assert.strictEqual(res.status, 0, res.stderr);
  assert.ok(!fs.existsSync(path.join(home, '.claude', 'settings.json')), 'settings.json must not be created');
});

// ---------------------------------------------------------------------------
// 10. jq-less uninstall leaves settings.json untouched
// ---------------------------------------------------------------------------
test('uninstall without jq leaves settings.json intact', () => {
  const repo = buildRepo();
  const home = mkHome();
  writeSettings(home, { model: 'opus', enabledPlugins: { 'alpha@official-market': true } });
  const before = fs.readFileSync(path.join(home, '.claude', 'settings.json'), 'utf8');

  const jqlessBin = makeJqlessBin();
  const res = runScript(repo, 'uninstall.sh', ['common'], home, { PATH: jqlessBin });
  assert.strictEqual(res.status, 0, res.stderr);

  const after = fs.readFileSync(path.join(home, '.claude', 'settings.json'), 'utf8');
  assert.strictEqual(after, before, 'settings.json must not change without jq');
  assert.ok(/jq not found/.test(res.stdout + res.stderr), 'expected a jq warning');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
