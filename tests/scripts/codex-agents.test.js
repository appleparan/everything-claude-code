#!/usr/bin/env node
/**
 * Tests for Codex custom subagent role files: targets/codex/install.sh must
 * copy content/codex/agents/*.toml into $CODEX_DIR/agents/, uninstall.sh must
 * remove only the tracked role files, and (when uv is available) config.toml
 * must gain the [agents] defaults from content/codex/config.toml.
 *
 * Fixtures are self-contained copies of scripts/ + targets/ plus a minimal
 * fabricated content/ tree, mirroring codex-external-skills.test.js.
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawnSync } = require('child_process');

const repoRoot = path.join(__dirname, '..', '..');
const hasUv = spawnSync('uv', ['--version'], { encoding: 'utf8' }).status === 0;

const WORKER_TOML = [
  'name = "worker"',
  'description = "test worker"',
  'developer_instructions = "do the work"',
  'model = "gpt-5.6-terra"',
  ''
].join('\n');

const EXPLORER_TOML = [
  'name = "explorer"',
  'description = "test explorer"',
  'developer_instructions = "look around"',
  'model = "gpt-5.6-luna"',
  'sandbox_mode = "read-only"',
  ''
].join('\n');

const CONFIG_FRAGMENT = ['[agents]', 'default_subagent_model = "gpt-5.6-terra"', ''].join('\n');

const MCP_SERVERS = {
  mcpServers: {
    'common-tool': {
      command: 'bunx',
      args: ['common-tool-mcp@latest'],
      description: 'Common tool, installed for every language'
    }
  }
};

function writeFixtureContent(
  dir,
  { withCodexAgents = true, withConfigFragment = true, servers = MCP_SERVERS } = {}
) {
  const w = (rel, content) => {
    const full = path.join(dir, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  };
  w('content/instructions/global.md', '# Global\n');
  w('content/rules/common/coding-style.md', '# Coding Style\n');
  w('content/mcp/servers.json', JSON.stringify(servers, null, 2) + '\n');
  if (withCodexAgents) {
    w('content/codex/agents/worker.toml', WORKER_TOML);
    w('content/codex/agents/explorer.toml', EXPLORER_TOML);
  }
  if (withConfigFragment) {
    w('content/codex/config.toml', CONFIG_FRAGMENT);
  }
}

function buildRepo(opts = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ecc-codex-agents-fixture-'));
  fs.cpSync(path.join(repoRoot, 'scripts'), path.join(dir, 'scripts'), { recursive: true });
  fs.cpSync(path.join(repoRoot, 'targets'), path.join(dir, 'targets'), { recursive: true });
  writeFixtureContent(dir, opts);
  return dir;
}

function mkCodexHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ecc-codex-agents-home-'));
}

function runScript(repoDir, script, args, codexHome, extraEnv = {}) {
  const shPath = path.join(repoDir, 'targets', 'codex', script);
  const env = { ...process.env, CODEX_HOME: codexHome, ...extraEnv };
  return spawnSync('bash', [shPath, ...args], { env, encoding: 'utf8' });
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
// 1. Fresh install copies both role files into agents/
// ---------------------------------------------------------------------------
test('install copies worker.toml and explorer.toml into agents/', () => {
  const repo = buildRepo();
  const codexHome = mkCodexHome();
  const res = runScript(repo, 'install.sh', ['common'], codexHome);
  assert.strictEqual(res.status, 0, res.stderr + res.stdout);

  const workerDest = path.join(codexHome, 'agents', 'worker.toml');
  const explorerDest = path.join(codexHome, 'agents', 'explorer.toml');
  assert.strictEqual(fs.readFileSync(workerDest, 'utf8'), WORKER_TOML);
  assert.strictEqual(fs.readFileSync(explorerDest, 'utf8'), EXPLORER_TOML);
});

// ---------------------------------------------------------------------------
// 2. Second install without -f skips and leaves a user-modified file intact
// ---------------------------------------------------------------------------
test('existing role file is skipped without -f and refreshed with -f', () => {
  const repo = buildRepo();
  const codexHome = mkCodexHome();

  let res = runScript(repo, 'install.sh', ['common'], codexHome);
  assert.strictEqual(res.status, 0, res.stderr + res.stdout);

  const workerDest = path.join(codexHome, 'agents', 'worker.toml');
  fs.writeFileSync(workerDest, 'model = "user-pinned"\n');

  res = runScript(repo, 'install.sh', ['common'], codexHome);
  assert.strictEqual(res.status, 0, res.stderr + res.stdout);
  assert.ok(/SKIP/.test(res.stdout), 'expected a SKIP line on the second install');
  assert.strictEqual(
    fs.readFileSync(workerDest, 'utf8'),
    'model = "user-pinned"\n',
    'existing role file must not be overwritten without -f'
  );

  res = runScript(repo, 'install.sh', ['-f', 'common'], codexHome);
  assert.strictEqual(res.status, 0, res.stderr + res.stdout);
  assert.strictEqual(
    fs.readFileSync(workerDest, 'utf8'),
    WORKER_TOML,
    '-f must refresh the role file from content/codex/agents/'
  );
});

// ---------------------------------------------------------------------------
// 3. Dry run installs nothing
// ---------------------------------------------------------------------------
test('dry run does not install role files', () => {
  const repo = buildRepo();
  const codexHome = mkCodexHome();
  const res = runScript(repo, 'install.sh', ['-n', 'common'], codexHome);
  assert.strictEqual(res.status, 0, res.stderr + res.stdout);
  assert.ok(!fs.existsSync(path.join(codexHome, 'agents', 'worker.toml')));
  assert.ok(!fs.existsSync(path.join(codexHome, 'agents', 'explorer.toml')));
});

// ---------------------------------------------------------------------------
// 4. Uninstall removes the two role files but leaves the user's own file
// ---------------------------------------------------------------------------
test('uninstall removes tracked role files only', () => {
  const repo = buildRepo();
  const codexHome = mkCodexHome();
  let res = runScript(repo, 'install.sh', ['common'], codexHome);
  assert.strictEqual(res.status, 0, res.stderr + res.stdout);

  const mineDest = path.join(codexHome, 'agents', 'mine.toml');
  fs.writeFileSync(mineDest, 'name = "mine"\n');

  res = runScript(repo, 'uninstall.sh', ['common'], codexHome);
  assert.strictEqual(res.status, 0, res.stderr + res.stdout);
  assert.ok(!fs.existsSync(path.join(codexHome, 'agents', 'worker.toml')));
  assert.ok(!fs.existsSync(path.join(codexHome, 'agents', 'explorer.toml')));
  assert.ok(fs.existsSync(mineDest), 'untracked agent file must survive uninstall');
});

// ---------------------------------------------------------------------------
// 5. Install without content/codex/ present still succeeds
// ---------------------------------------------------------------------------
test('install without content/codex/ present still succeeds', () => {
  const repo = buildRepo({ withCodexAgents: false, withConfigFragment: false });
  fs.rmSync(path.join(repo, 'content', 'codex'), { recursive: true, force: true });
  const codexHome = mkCodexHome();
  const res = runScript(repo, 'install.sh', ['common'], codexHome);
  assert.strictEqual(res.status, 0, res.stderr + res.stdout);
  assert.ok(!fs.existsSync(path.join(codexHome, 'agents', 'worker.toml')));
});

// ---------------------------------------------------------------------------
// 6. [agents] config merge, when uv is available
// ---------------------------------------------------------------------------
if (!hasUv) {
  console.log('  SKIP  [agents] config.toml merge test (uv not available)');
} else {
  test('install merges [agents] defaults into config.toml', () => {
    const repo = buildRepo();
    const codexHome = mkCodexHome();
    const res = runScript(repo, 'install.sh', ['common'], codexHome);
    assert.strictEqual(res.status, 0, res.stderr + res.stdout);
    const configPath = path.join(codexHome, 'config.toml');
    assert.ok(fs.existsSync(configPath), 'config.toml must be created');
    const out = fs.readFileSync(configPath, 'utf8');
    assert.ok(out.includes('[agents]'));
    assert.ok(out.includes('default_subagent_model = "gpt-5.6-terra"'));
  });
}

// ---------------------------------------------------------------------------
// 7. MCP merge is opt-in via -m; [agents] defaults merge regardless
// ---------------------------------------------------------------------------
if (!hasUv) {
  console.log('  SKIP  MCP opt-in tests (uv not available)');
} else {
  test('install without -m: no [mcp_servers.*] but [agents] defaults present', () => {
    const repo = buildRepo();
    const codexHome = mkCodexHome();
    const res = runScript(repo, 'install.sh', ['common'], codexHome);
    assert.strictEqual(res.status, 0, res.stderr + res.stdout);
    const configPath = path.join(codexHome, 'config.toml');
    assert.ok(fs.existsSync(configPath), 'config.toml must be created for [agents] defaults');
    const out = fs.readFileSync(configPath, 'utf8');
    assert.ok(!out.includes('[mcp_servers.'), '[mcp_servers.*] must not appear without -m');
    assert.ok(out.includes('[agents]'));
    assert.ok(out.includes('default_subagent_model = "gpt-5.6-terra"'));
    assert.ok(/-m/.test(res.stdout), 'expected output to mention -m');
  });

  test('install -m merges [mcp_servers.*] into config.toml', () => {
    const repo = buildRepo();
    const codexHome = mkCodexHome();
    const res = runScript(repo, 'install.sh', ['-m', 'common'], codexHome);
    assert.strictEqual(res.status, 0, res.stderr + res.stdout);
    const configPath = path.join(codexHome, 'config.toml');
    const out = fs.readFileSync(configPath, 'utf8');
    assert.ok(out.includes('[mcp_servers.common-tool]'), 'expected the common-tool server to be merged');
    assert.ok(out.includes('[agents]'));
  });
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
