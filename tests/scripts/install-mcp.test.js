#!/usr/bin/env node
/**
 * Tests for opt-in MCP server installation on the Claude target:
 * targets/claude/install.sh must merge content/mcp/servers.json into
 * ~/.claude.json's mcpServers object only when -m is passed, and
 * uninstall.sh must never touch ~/.claude.json.
 *
 * Fixtures are self-contained copies of scripts/ + targets/ plus a minimal
 * fabricated content/ tree, mirroring install-plugins.test.js.
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawnSync } = require('child_process');

const repoRoot = path.join(__dirname, '..', '..');

const SERVERS_JSON = {
  mcpServers: {
    'common-tool': {
      command: 'bunx',
      args: ['common-tool-mcp@latest'],
      description: 'Common tool, installed for every language'
    },
    'node-tool': {
      command: 'bunx',
      args: ['node-tool-mcp@latest'],
      env: { NODE_ENV: 'production' },
      description: 'Node-only tool',
      languages: ['node']
    },
    'py-tool': {
      command: 'uvx',
      args: ['py-tool-mcp'],
      description: 'Python-only tool',
      languages: ['python']
    }
  },
  _comments: {
    usage: 'test fixture — must never be merged into ~/.claude.json'
  }
};

function writeFixtureContent(dir, { withServers = true } = {}) {
  const w = (rel, content) => {
    const full = path.join(dir, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  };
  w('content/instructions/global.md', '# Global\n');
  w('content/rules/common/coding-style.md', '# Coding Style\n');
  if (withServers) {
    w('content/mcp/servers.json', JSON.stringify(SERVERS_JSON, null, 2) + '\n');
  }
}

function buildRepo(opts = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ecc-mcp-repo-'));
  fs.cpSync(path.join(repoRoot, 'scripts'), path.join(dir, 'scripts'), { recursive: true });
  fs.cpSync(path.join(repoRoot, 'targets'), path.join(dir, 'targets'), { recursive: true });
  writeFixtureContent(dir, opts);
  return dir;
}

function mkHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ecc-mcp-home-'));
}

function runScript(repoDir, script, args, home, extraEnv = {}) {
  const sh = path.join(repoDir, 'targets', 'claude', script);
  const env = { ...process.env, HOME: home, ...extraEnv };
  delete env.CODEX_HOME;
  return spawnSync('bash', [sh, ...args], { env, encoding: 'utf8' });
}

function claudeJsonPath(home) {
  return path.join(home, '.claude.json');
}

function readClaudeJson(home) {
  return JSON.parse(fs.readFileSync(claudeJsonPath(home), 'utf8'));
}

function writeClaudeJson(home, obj) {
  fs.writeFileSync(claudeJsonPath(home), JSON.stringify(obj, null, 2) + '\n');
}

function listBackups(home) {
  return fs
    .readdirSync(home)
    .filter((f) => f.startsWith('.claude.json.bak.'));
}

// Build a PATH directory containing every binary from /usr/bin and /bin
// except jq, so `command -v jq` fails while everything else still works.
function makeJqlessBin() {
  const binDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ecc-mcp-jqless-'));
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
// 1. Without -m: ~/.claude.json is not created and output mentions -m
// ---------------------------------------------------------------------------
test('install without -m does not create ~/.claude.json and mentions -m', () => {
  const repo = buildRepo();
  const home = mkHome();
  const res = runScript(repo, 'install.sh', ['common'], home);
  assert.strictEqual(res.status, 0, res.stderr);
  assert.ok(!fs.existsSync(claudeJsonPath(home)), '~/.claude.json must not be created without -m');
  assert.ok(/-m/.test(res.stdout), 'expected output to mention -m');
});

// ---------------------------------------------------------------------------
// 2. Without -m on a pre-seeded file: byte-identical afterwards
// ---------------------------------------------------------------------------
test('install without -m leaves a pre-seeded ~/.claude.json byte-identical', () => {
  const repo = buildRepo();
  const home = mkHome();
  writeClaudeJson(home, { oauthAccount: { x: 1 } });
  const before = fs.readFileSync(claudeJsonPath(home), 'utf8');

  const res = runScript(repo, 'install.sh', ['common'], home);
  assert.strictEqual(res.status, 0, res.stderr);

  const after = fs.readFileSync(claudeJsonPath(home), 'utf8');
  assert.strictEqual(after, before, '~/.claude.json must not change without -m');
});

// ---------------------------------------------------------------------------
// 3. -m node: common + node servers present, python absent, fields scoped
// ---------------------------------------------------------------------------
test('-m node merges common-tool and node-tool, skips py-tool, scopes fields', () => {
  const repo = buildRepo();
  const home = mkHome();
  writeClaudeJson(home, {
    oauthAccount: { x: 1 },
    mcpServers: { 'user-tool': { command: 'mine' } }
  });

  const res = runScript(repo, 'install.sh', ['-m', 'node'], home);
  assert.strictEqual(res.status, 0, res.stderr);

  const doc = readClaudeJson(home);
  assert.deepStrictEqual(doc.oauthAccount, { x: 1 }, 'unrelated top-level keys must be preserved');
  assert.deepStrictEqual(doc.mcpServers['user-tool'], { command: 'mine' }, 'untracked server must survive');

  assert.deepStrictEqual(doc.mcpServers['common-tool'], {
    command: 'bunx',
    args: ['common-tool-mcp@latest']
  });
  assert.deepStrictEqual(doc.mcpServers['node-tool'], {
    command: 'bunx',
    args: ['node-tool-mcp@latest'],
    env: { NODE_ENV: 'production' }
  });
  assert.strictEqual(doc.mcpServers['py-tool'], undefined, 'py-tool must not be installed for node');

  assert.strictEqual(doc.mcpServers['common-tool'].description, undefined);
  assert.strictEqual(doc.mcpServers['common-tool'].languages, undefined);
  assert.strictEqual(doc._comments, undefined, '_comments must never be written');
});

// ---------------------------------------------------------------------------
// 4. -m python: python + common present, node absent
// ---------------------------------------------------------------------------
test('-m python merges common-tool and py-tool, skips node-tool', () => {
  const repo = buildRepo();
  const home = mkHome();

  const res = runScript(repo, 'install.sh', ['-m', 'python'], home);
  assert.strictEqual(res.status, 0, res.stderr);

  const doc = readClaudeJson(home);
  assert.ok(doc.mcpServers['common-tool']);
  assert.ok(doc.mcpServers['py-tool']);
  assert.strictEqual(doc.mcpServers['node-tool'], undefined);
});

// ---------------------------------------------------------------------------
// 5. Existing same-name server: skip without -f, overwrite with -f
// ---------------------------------------------------------------------------
test('existing server is skipped without -f and overwritten with -f', () => {
  const repo = buildRepo();
  const home = mkHome();
  writeClaudeJson(home, { mcpServers: { 'common-tool': { command: 'user' } } });

  let res = runScript(repo, 'install.sh', ['-m', 'common'], home);
  assert.strictEqual(res.status, 0, res.stderr);
  assert.ok(/SKIP/.test(res.stdout), 'expected a SKIP line');
  let doc = readClaudeJson(home);
  assert.strictEqual(doc.mcpServers['common-tool'].command, 'user', 'existing entry must survive without -f');

  res = runScript(repo, 'install.sh', ['-f', '-m', 'common'], home);
  assert.strictEqual(res.status, 0, res.stderr);
  doc = readClaudeJson(home);
  assert.strictEqual(doc.mcpServers['common-tool'].command, 'bunx', '-f must overwrite the existing entry');
});

// ---------------------------------------------------------------------------
// 6. Backup: created once on first change, not on an idempotent re-run
// ---------------------------------------------------------------------------
test('backup is created once and a repeat run is idempotent', () => {
  const repo = buildRepo();
  const home = mkHome();
  writeClaudeJson(home, { oauthAccount: { x: 1 } });

  let res = runScript(repo, 'install.sh', ['-m', 'common'], home);
  assert.strictEqual(res.status, 0, res.stderr);
  assert.strictEqual(listBackups(home).length, 1, 'expected exactly one backup after the first change');

  const after1 = fs.readFileSync(claudeJsonPath(home), 'utf8');

  res = runScript(repo, 'install.sh', ['-m', 'common'], home);
  assert.strictEqual(res.status, 0, res.stderr);
  assert.strictEqual(listBackups(home).length, 1, 'a no-op repeat run must not create a new backup');

  const after2 = fs.readFileSync(claudeJsonPath(home), 'utf8');
  assert.strictEqual(after2, after1, 'a no-op repeat run must leave the file unchanged');
});

// ---------------------------------------------------------------------------
// 7. Dry run: nothing written, no backup
// ---------------------------------------------------------------------------
test('-n -m node writes nothing and creates no backup', () => {
  const repo = buildRepo();
  const home = mkHome();
  writeClaudeJson(home, { oauthAccount: { x: 1 } });
  const before = fs.readFileSync(claudeJsonPath(home), 'utf8');

  const res = runScript(repo, 'install.sh', ['-n', '-m', 'node'], home);
  assert.strictEqual(res.status, 0, res.stderr);

  const after = fs.readFileSync(claudeJsonPath(home), 'utf8');
  assert.strictEqual(after, before, 'dry run must not write ~/.claude.json');
  assert.strictEqual(listBackups(home).length, 0, 'dry run must not create a backup');
  assert.ok(/DRY/.test(res.stdout), 'expected DRY output lines');
});

// ---------------------------------------------------------------------------
// 8. jq missing: warns and skips, never touches ~/.claude.json
// ---------------------------------------------------------------------------
test('-m without jq warns and leaves ~/.claude.json untouched', () => {
  const repo = buildRepo();
  const home = mkHome();
  writeClaudeJson(home, { oauthAccount: { x: 1 } });
  const before = fs.readFileSync(claudeJsonPath(home), 'utf8');

  const jqlessBin = makeJqlessBin();
  const res = runScript(repo, 'install.sh', ['-m', 'common'], home, { PATH: jqlessBin });
  assert.strictEqual(res.status, 0, res.stderr);

  const after = fs.readFileSync(claudeJsonPath(home), 'utf8');
  assert.strictEqual(after, before, '~/.claude.json must not change without jq');
  assert.ok(/jq/.test(res.stdout + res.stderr), 'expected a jq warning');
});

// ---------------------------------------------------------------------------
// 9. Uninstall leaves ~/.claude.json unchanged and prints manual-removal info
// ---------------------------------------------------------------------------
test('uninstall leaves ~/.claude.json unchanged and prints manual-removal info', () => {
  const repo = buildRepo();
  const home = mkHome();
  writeClaudeJson(home, { oauthAccount: { x: 1 }, mcpServers: { 'common-tool': { command: 'bunx' } } });
  const before = fs.readFileSync(claudeJsonPath(home), 'utf8');

  const res = runScript(repo, 'uninstall.sh', ['common'], home);
  assert.strictEqual(res.status, 0, res.stderr);

  const after = fs.readFileSync(claudeJsonPath(home), 'utf8');
  assert.strictEqual(after, before, 'uninstall must never touch ~/.claude.json');
  assert.ok(/common-tool/.test(res.stdout), 'expected a manual-removal hint naming the tracked server');
  assert.ok(/left untouched/.test(res.stdout), 'expected an explanation that ~/.claude.json is left untouched');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
