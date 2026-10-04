#!/usr/bin/env node
/**
 * Tests for the OpenCode target: targets/opencode/{install,uninstall}.sh and
 * the converter in scripts/lib/opencode-agents.sh.
 *
 * Fixtures are self-contained copies of scripts/ + targets/ plus a minimal
 * fabricated content/ tree, with a temp HOME, OPENCODE_CONFIG_DIR and
 * XDG_CONFIG_HOME so the real ~/.config/opencode is never touched. No
 * external-skills.json is shipped in the fixture, so nothing needs network.
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawnSync } = require('child_process');

const repoRoot = path.join(__dirname, '..', '..');

const FULL_MD = [
  '---',
  'name: full',
  'description: Does everything.',
  'tools: ["Read", "Grep", "Glob", "Bash", "Edit", "Write"]',
  'model: opus',
  '---',
  '',
  'tools: ["Read"] stays in the body.',
  'model: opus stays too.',
  ''
].join('\n');
const READONLY_MD = '---\nname: readonly\ndescription: Reads.\ntools: ["Read", "Grep", "Glob", "Bash"]\nmodel: sonnet\n---\n\nRead.\n';
const NOBASH_MD = '---\nname: nobash\ndescription: Edits.\ntools: ["Read", "Write", "Edit", "Grep"]\nmodel: sonnet\n---\n\nEdit.\n';
const BOTH_MD = '---\nname: both\ndescription: Reads only.\ntools: ["Read", "Grep", "Glob"]\nmodel: haiku\n---\n\nBoth.\n';
const NOTOOLS_MD = '---\nname: notools\ndescription: No tools line.\nmodel: sonnet\n---\n\nBody.\n';
const MODE_MD = '---\nname: moded\ndescription: Has a mode.\nmode: primary\ntools: ["Read", "Write", "Bash"]\n---\n\nBody.\n';

const realJson = fs.readFileSync(path.join(repoRoot, 'content/targets/opencode/opencode.json'), 'utf8');

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
  const agents = { full: FULL_MD, readonly: READONLY_MD, nobash: NOBASH_MD, both: BOTH_MD, notools: NOTOOLS_MD, moded: MODE_MD };
  for (const [n, md] of Object.entries(agents)) w(`content/agents/common/${n}.md`, md);
  w('content/targets/opencode/instructions.md', '## Harness: OpenCode\n\nAddendum.\n');
  w('content/targets/opencode/opencode.json', realJson);
}

function buildRepo(opts) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ecc-oc-fixture-'));
  fs.cpSync(path.join(repoRoot, 'scripts'), path.join(dir, 'scripts'), { recursive: true });
  fs.cpSync(path.join(repoRoot, 'targets'), path.join(dir, 'targets'), { recursive: true });
  writeFixtureContent(dir, opts);
  return dir;
}

function mkDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function runScript(repoDir, script, args, ocDir, extraEnv = {}) {
  const env = {
    ...process.env,
    HOME: mkDir('ecc-oc-home-'),
    OPENCODE_CONFIG_DIR: ocDir,
    ...extraEnv
  };
  delete env.XDG_CONFIG_HOME;
  Object.assign(env, extraEnv);
  const shPath = path.join(repoDir, 'targets', 'opencode', script);
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

const read = (dir, rel) => fs.readFileSync(path.join(dir, rel), 'utf8');
const exists = (dir, rel) => fs.existsSync(path.join(dir, rel));
const install = (repo, dir, args = ['common']) => {
  const res = runScript(repo, 'install.sh', args, dir);
  assert.strictEqual(res.status, 0, res.stderr + res.stdout);
  return res;
};

const DENY_EDIT = '  - action: edit\n    resource: "*"\n    effect: deny\n';
const DENY_SHELL = '  - action: shell\n    resource: "*"\n    effect: deny\n';

// ---------------------------------------------------------------------------
// Dry run and install
// ---------------------------------------------------------------------------
test('dry-run lists every section and writes nothing', () => {
  const repo = buildRepo();
  const ocDir = path.join(mkDir('ecc-oc-dest-'), 'opencode');
  const res = runScript(repo, 'install.sh', ['-n', 'common'], ocDir);
  assert.strictEqual(res.status, 0, res.stderr + res.stdout);
  for (const section of ['[instructions]', '[global]', '[skills]', '[commands]', '[agents]']) {
    assert.ok(res.stdout.includes(section), `missing ${section}: ${res.stdout}`);
  }
  assert.ok(res.stdout.includes('opencode.json'), res.stdout);
  assert.ok(res.stdout.includes('commands/plan.md'), res.stdout);
  assert.ok(!fs.existsSync(ocDir), 'dry run must not create the config dir');
});

test('install creates AGENTS.md, rules, skills, commands, agents and opencode.json', () => {
  const repo = buildRepo();
  const ocDir = mkDir('ecc-oc-dest-');
  const res = install(repo, ocDir);

  const agentsMd = read(ocDir, 'AGENTS.md');
  assert.ok(agentsMd.includes('## Harness: OpenCode'), 'addendum missing');
  assert.ok(agentsMd.includes(`\`${ocDir}/instructions/coding-style.md\``), `index label wrong: ${agentsMd}`);
  assert.ok(exists(ocDir, 'instructions/coding-style.md'));
  assert.ok(exists(ocDir, 'skills/example-skill/SKILL.md'));
  assert.strictEqual(read(ocDir, 'commands/plan.md'), read(repo, 'content/commands/common/plan.md'));
  assert.strictEqual(read(ocDir, 'opencode.json'), realJson);
  for (const n of ['full', 'readonly', 'nobash', 'both', 'notools', 'moded']) {
    assert.ok(exists(ocDir, `agents/${n}.md`), n);
  }
  assert.strictEqual((res.stdout.match(/INFO/g) || []).length, 1, res.stdout);
  assert.ok(/INFO.*tools: lines removed.*OpenCode configuration/.test(res.stdout), res.stdout);
});

test('index label is ~/.config/opencode without overrides and the real path with XDG_CONFIG_HOME', () => {
  const repo = buildRepo();
  const home = mkDir('ecc-oc-home-');
  fs.mkdirSync(path.join(home, '.config', 'opencode'), { recursive: true });
  const env = { ...process.env, HOME: home };
  delete env.OPENCODE_CONFIG_DIR;
  delete env.XDG_CONFIG_HOME;
  const sh = path.join(repo, 'targets', 'opencode', 'install.sh');
  let res = spawnSync('bash', [sh, 'common'], { env, encoding: 'utf8' });
  assert.strictEqual(res.status, 0, res.stderr + res.stdout);
  assert.ok(read(path.join(home, '.config', 'opencode'), 'AGENTS.md').includes('`~/.config/opencode/instructions/coding-style.md`'));

  const xdg = mkDir('ecc-oc-xdg-');
  fs.mkdirSync(path.join(xdg, 'opencode'));
  res = spawnSync('bash', [sh, 'common'], { env: { ...env, XDG_CONFIG_HOME: xdg }, encoding: 'utf8' });
  assert.strictEqual(res.status, 0, res.stderr + res.stdout);
  assert.ok(read(path.join(xdg, 'opencode'), 'AGENTS.md').includes(`\`${xdg}/opencode/instructions/coding-style.md\``));
});

test('install fails when OpenCode is not detected', () => {
  const repo = buildRepo();
  const env = { ...process.env, HOME: mkDir('ecc-oc-home-'), PATH: '/usr/bin:/bin' };
  delete env.OPENCODE_CONFIG_DIR;
  delete env.XDG_CONFIG_HOME;
  const res = spawnSync('bash', [path.join(repo, 'targets', 'opencode', 'install.sh'), '-n', 'common'], {
    env,
    encoding: 'utf8'
  });
  assert.notStrictEqual(res.status, 0);
  assert.ok((res.stdout + res.stderr).includes('OpenCode not detected'));
});

// ---------------------------------------------------------------------------
// Agent conversion
// ---------------------------------------------------------------------------
test('converter drops tools and model, adds mode, keeps the body byte for byte', () => {
  const ocDir = mkDir('ecc-oc-dest-');
  install(buildRepo(), ocDir);
  assert.strictEqual(
    read(ocDir, 'agents/full.md'),
    '---\nname: full\ndescription: Does everything.\nmode: subagent\n---\n\ntools: ["Read"] stays in the body.\nmodel: opus stays too.\n'
  );
});

test('converter denies edit for agents without Edit and Write', () => {
  const ocDir = mkDir('ecc-oc-dest-');
  install(buildRepo(), ocDir);
  assert.strictEqual(
    read(ocDir, 'agents/readonly.md'),
    `---\nname: readonly\ndescription: Reads.\nmode: subagent\npermissions:\n${DENY_EDIT}---\n\nRead.\n`
  );
});

test('converter denies shell for agents without Bash', () => {
  const ocDir = mkDir('ecc-oc-dest-');
  install(buildRepo(), ocDir);
  assert.strictEqual(
    read(ocDir, 'agents/nobash.md'),
    `---\nname: nobash\ndescription: Edits.\nmode: subagent\npermissions:\n${DENY_SHELL}---\n\nEdit.\n`
  );
});

test('converter emits both denies under one permissions key', () => {
  const ocDir = mkDir('ecc-oc-dest-');
  install(buildRepo(), ocDir);
  const out = read(ocDir, 'agents/both.md');
  assert.strictEqual(out, `---\nname: both\ndescription: Reads only.\nmode: subagent\npermissions:\n${DENY_EDIT}${DENY_SHELL}---\n\nBoth.\n`);
  assert.strictEqual((out.match(/^permissions:/gm) || []).length, 1);
});

test('converter adds no permissions without a tools line', () => {
  const ocDir = mkDir('ecc-oc-dest-');
  install(buildRepo(), ocDir);
  assert.strictEqual(
    read(ocDir, 'agents/notools.md'),
    '---\nname: notools\ndescription: No tools line.\nmode: subagent\n---\n\nBody.\n'
  );
});

test('converter keeps an existing mode and does not add a second one', () => {
  const ocDir = mkDir('ecc-oc-dest-');
  install(buildRepo(), ocDir);
  const out = read(ocDir, 'agents/moded.md');
  assert.strictEqual(out, '---\nname: moded\ndescription: Has a mode.\nmode: primary\n---\n\nBody.\n');
});

test('every shipped agent converts without tools/model lines and with sane frontmatter', () => {
  const lib = path.join(repoRoot, 'scripts/lib/opencode-agents.sh');
  const root = path.join(repoRoot, 'content', 'agents');
  let count = 0;
  for (const lang of fs.readdirSync(root)) {
    for (const f of fs.readdirSync(path.join(root, lang))) {
      const src = path.join(root, lang, f);
      const res = spawnSync('bash', ['-c', `source "${lib}"; opencode_agent_render "${src}"`], { encoding: 'utf8' });
      assert.strictEqual(res.status, 0, res.stderr);
      const m = res.stdout.match(/^---\n([\s\S]*?)\n---\n/);
      assert.ok(m, `${f}: no frontmatter`);
      const fm = m[1];
      assert.ok(!/^(tools|model):/m.test(fm), `${f}: tools/model left`);
      assert.ok(/^name: /m.test(fm) && /^description: /m.test(fm), `${f}: name/description lost`);
      assert.strictEqual((fm.match(/^mode:/gm) || []).length, 1, `${f}: mode`);
      assert.ok((fm.match(/^permissions:/gm) || []).length <= 1, `${f}: permissions`);
      // Unquoted plain scalars with ": " or " #" are not valid strict YAML.
      for (const line of fm.split('\n')) {
        const kv = line.match(/^[A-Za-z][\w-]*:\s+(.*)$/);
        if (kv && !/^["'[{|>]/.test(kv[1])) {
          assert.ok(!kv[1].includes(': ') && !kv[1].includes(' #'), `${f}: bad scalar ${line}`);
        }
      }
      // Body is the original body.
      const orig = fs.readFileSync(src, 'utf8');
      assert.strictEqual(res.stdout.split(/\n---\n/).slice(1).join('\n---\n'), orig.split(/\n---\n/).slice(1).join('\n---\n'), `${f}: body changed`);
      count += 1;
    }
  }
  assert.ok(count > 0);
});

// ---------------------------------------------------------------------------
// opencode.json
// ---------------------------------------------------------------------------
test('shipped opencode.json is valid JSON and every rule is a shell ask', () => {
  const cfg = JSON.parse(realJson);
  assert.strictEqual(cfg.$schema, 'https://opencode.ai/config.json');
  assert.ok(Array.isArray(cfg.permissions) && cfg.permissions.length > 0);
  for (const rule of cfg.permissions) {
    assert.strictEqual(rule.action, 'shell', JSON.stringify(rule));
    assert.strictEqual(rule.effect, 'ask', JSON.stringify(rule));
    assert.strictEqual(typeof rule.resource, 'string');
  }
  const res = cfg.permissions.map((r) => r.resource);
  for (const must of ['rm -rf *', 'sudo *', 'git push --force*', 'git reset --hard*', '* --no-verify*']) {
    assert.ok(res.includes(must), must);
  }
});

test('a user opencode.json is skipped with WARN, survives -f-less reinstall and uninstall', () => {
  const repo = buildRepo();
  const ocDir = mkDir('ecc-oc-dest-');
  fs.writeFileSync(path.join(ocDir, 'opencode.json'), '{"theme":"mine"}\n');
  const res = install(repo, ocDir);
  assert.ok(/WARN.*opencode\.json/.test(res.stdout), res.stdout);
  assert.strictEqual(read(ocDir, 'opencode.json'), '{"theme":"mine"}\n');

  const un = runScript(repo, 'uninstall.sh', ['common'], ocDir);
  assert.strictEqual(un.status, 0, un.stderr + un.stdout);
  assert.strictEqual(read(ocDir, 'opencode.json'), '{"theme":"mine"}\n');
  assert.ok(!exists(ocDir, 'AGENTS.md'));
});

test('-f replaces opencode.json; a plain rerun of our own file is silent', () => {
  const repo = buildRepo();
  const ocDir = mkDir('ecc-oc-dest-');
  fs.writeFileSync(path.join(ocDir, 'opencode.json'), '{"theme":"mine"}\n');
  install(repo, ocDir, ['-f', 'common']);
  assert.strictEqual(read(ocDir, 'opencode.json'), realJson);
  const again = install(repo, ocDir);
  assert.ok(!/WARN/.test(again.stdout), again.stdout);
});

test('opencode.jsonc is never touched by install or uninstall', () => {
  const repo = buildRepo();
  const ocDir = mkDir('ecc-oc-dest-');
  fs.writeFileSync(path.join(ocDir, 'opencode.jsonc'), '// mine\n{}\n');
  install(repo, ocDir, ['-f', 'common']);
  assert.strictEqual(read(ocDir, 'opencode.jsonc'), '// mine\n{}\n');
  const un = runScript(repo, 'uninstall.sh', ['common'], ocDir);
  assert.strictEqual(un.status, 0, un.stderr + un.stdout);
  assert.strictEqual(read(ocDir, 'opencode.jsonc'), '// mine\n{}\n');
  assert.ok(!exists(ocDir, 'opencode.json'), 'our opencode.json is removed');
});

// ---------------------------------------------------------------------------
// Skip / force / symlink
// ---------------------------------------------------------------------------
test('existing files are skipped without -f and refreshed with -f', () => {
  const repo = buildRepo();
  const ocDir = mkDir('ecc-oc-dest-');
  install(repo, ocDir);
  const files = ['commands/plan.md', 'agents/full.md', 'instructions/coding-style.md'];
  for (const t of files) fs.writeFileSync(path.join(ocDir, t), 'USER EDIT\n');

  const res = install(repo, ocDir);
  assert.ok(res.stdout.includes('SKIP'), res.stdout);
  for (const t of files) assert.strictEqual(read(ocDir, t), 'USER EDIT\n', t);

  install(repo, ocDir, ['-f', 'common']);
  assert.strictEqual(read(ocDir, 'commands/plan.md'), read(repo, 'content/commands/common/plan.md'));
  assert.ok(read(ocDir, 'agents/full.md').includes('mode: subagent'));
});

test('a symlinked destination is skipped, even with -f, and its target is untouched', () => {
  const repo = buildRepo();
  const ocDir = mkDir('ecc-oc-dest-');
  fs.mkdirSync(path.join(ocDir, 'agents'));
  fs.mkdirSync(path.join(ocDir, 'commands'));
  const outside = mkDir('ecc-oc-outside-');
  const agentTarget = path.join(outside, 'agent.md');
  const cmdTarget = path.join(outside, 'cmd.md');
  fs.writeFileSync(agentTarget, 'OUTSIDE\n');
  fs.writeFileSync(cmdTarget, 'OUTSIDE\n');
  fs.symlinkSync(agentTarget, path.join(ocDir, 'agents', 'full.md'));
  fs.symlinkSync(cmdTarget, path.join(ocDir, 'commands', 'plan.md'));

  const res = install(repo, ocDir, ['-f', 'common']);
  assert.ok(res.stdout.includes('symlink'), res.stdout);
  assert.strictEqual(fs.readFileSync(agentTarget, 'utf8'), 'OUTSIDE\n');
  assert.strictEqual(fs.readFileSync(cmdTarget, 'utf8'), 'OUTSIDE\n');
  assert.ok(fs.lstatSync(path.join(ocDir, 'agents', 'full.md')).isSymbolicLink());

  const un = runScript(repo, 'uninstall.sh', ['common'], ocDir);
  assert.strictEqual(un.status, 0, un.stderr + un.stdout);
  assert.ok(fs.lstatSync(path.join(ocDir, 'agents', 'full.md')).isSymbolicLink());
  assert.strictEqual(fs.readFileSync(agentTarget, 'utf8'), 'OUTSIDE\n');
});

// ---------------------------------------------------------------------------
// Uninstall
// ---------------------------------------------------------------------------
test('uninstall removes installed items and keeps unrelated user files', () => {
  const repo = buildRepo();
  const ocDir = mkDir('ecc-oc-dest-');
  install(repo, ocDir);
  fs.writeFileSync(path.join(ocDir, 'agents', 'mine.md'), 'mine\n');
  fs.writeFileSync(path.join(ocDir, 'commands', 'mine.md'), 'mine\n');
  fs.mkdirSync(path.join(ocDir, 'skills', 'my-skill'));
  fs.writeFileSync(path.join(ocDir, 'skills', 'my-skill', 'SKILL.md'), 'mine\n');

  const res = runScript(repo, 'uninstall.sh', ['common'], ocDir);
  assert.strictEqual(res.status, 0, res.stderr + res.stdout);
  for (const rel of ['AGENTS.md', 'opencode.json', 'instructions', 'skills/example-skill', 'commands/plan.md', 'agents/full.md', 'agents/notools.md']) {
    assert.ok(!exists(ocDir, rel), `${rel} should be gone`);
  }
  for (const rel of ['agents/mine.md', 'commands/mine.md', 'skills/my-skill/SKILL.md']) {
    assert.ok(exists(ocDir, rel), `${rel} should stay`);
  }
});

test('uninstall keeps a user-authored AGENTS.md and an edited unowned agent', () => {
  const repo = buildRepo();
  const ocDir = path.join(mkDir('ecc-oc-dest-'), 'opencode');
  fs.mkdirSync(path.join(ocDir, 'agents'), { recursive: true });
  fs.writeFileSync(path.join(ocDir, 'AGENTS.md'), '# Mine\n');
  fs.writeFileSync(path.join(ocDir, 'agents', 'full.md'), 'USER\n');
  install(repo, ocDir);
  const res = runScript(repo, 'uninstall.sh', ['common'], ocDir);
  assert.strictEqual(res.status, 0, res.stderr + res.stdout);
  assert.strictEqual(read(ocDir, 'AGENTS.md'), '# Mine\n');
  assert.strictEqual(read(ocDir, 'agents/full.md'), 'USER\n');
});

test('uninstall dry-run removes nothing', () => {
  const repo = buildRepo();
  const ocDir = mkDir('ecc-oc-dest-');
  install(repo, ocDir);
  const res = runScript(repo, 'uninstall.sh', ['-n', 'common'], ocDir);
  assert.strictEqual(res.status, 0, res.stderr + res.stdout);
  assert.ok(exists(ocDir, 'AGENTS.md') && exists(ocDir, 'opencode.json') && exists(ocDir, 'agents/full.md'));
});

// ---------------------------------------------------------------------------
// Prune
// ---------------------------------------------------------------------------
test('-p prunes a command that was removed from content', () => {
  const repo = buildRepo({ commands: ['plan', 'extra'] });
  const ocDir = mkDir('ecc-oc-dest-');
  install(repo, ocDir);
  assert.ok(exists(ocDir, 'commands/extra.md'));

  fs.rmSync(path.join(repo, 'content', 'commands', 'common', 'extra.md'));
  const noPrune = runScript(repo, 'install.sh', ['common'], ocDir);
  assert.ok(noPrune.stdout.includes('orphaned'), noPrune.stdout);
  assert.ok(exists(ocDir, 'commands/extra.md'), 'no -p, no removal');

  const res = runScript(repo, 'install.sh', ['-p', 'common'], ocDir);
  assert.strictEqual(res.status, 0, res.stderr + res.stdout);
  assert.ok(!exists(ocDir, 'commands/extra.md'));
  assert.ok(exists(ocDir, 'commands/plan.md'));
  assert.ok(exists(ocDir, 'opencode.json'));
});

test('a user edit of a skipped converted agent is not pruned after the source is deleted', () => {
  const repo = buildRepo();
  const ocDir = mkDir('ecc-oc-dest-');
  fs.mkdirSync(path.join(ocDir, 'agents'));
  fs.writeFileSync(path.join(ocDir, 'agents', 'full.md'), 'USER\n');
  install(repo, ocDir);
  fs.rmSync(path.join(repo, 'content', 'agents', 'common', 'full.md'));
  const res = runScript(repo, 'install.sh', ['-p', 'common'], ocDir);
  assert.strictEqual(res.status, 0, res.stderr + res.stdout);
  assert.strictEqual(read(ocDir, 'agents/full.md'), 'USER\n');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
