#!/usr/bin/env node
/**
 * Run all tests
 *
 * Usage: node tests/run-all.js
 */

const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const testsDir = __dirname;
const testFiles = [
  'lib/utils.test.js',
  'lib/package-manager.test.js',
  'hooks/hooks.test.js',
  'integration/hooks.test.js',
  'ci/validators.test.js',
  'ci/no-personal-paths.test.js',
  'ci/validate-workflow-security.test.js',
  'ci/scan-supply-chain-iocs.test.js',
  'ci/supply-chain-advisory-sources.test.js',
  'scripts/setup-package-manager.test.js',
  'scripts/skill-create-output.test.js',
  'scripts/install-dispatcher.test.js',
  'scripts/install-prune.test.js',
  'scripts/jq-missing.test.js',
  'scripts/codex-adapter.test.js'
];

const BOX_W = 58; // inner width between delimiters
const boxLine = (s) => `║${s.padEnd(BOX_W)}║`;

console.log('╔' + '═'.repeat(BOX_W) + '╗');
console.log(boxLine('           Everything Claude Code - Test Suite'));
console.log('╚' + '═'.repeat(BOX_W) + '╝');
console.log();

let totalPassed = 0;
let totalFailed = 0;
let totalTests = 0;

for (const testFile of testFiles) {
  const testPath = path.join(testsDir, testFile);

  if (!fs.existsSync(testPath)) {
    console.log(`⚠ Skipping ${testFile} (file not found)`);
    continue;
  }

  console.log(`\n━━━ Running ${testFile} ━━━`);

  const result = spawnSync('node', [testPath], {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe']
  });

  const stdout = result.stdout || '';
  const stderr = result.stderr || '';

  // Show both stdout and stderr so hook warnings are visible
  if (stdout) console.log(stdout);
  if (stderr) console.log(stderr);

  // Parse results from combined output. Test files use one of two summary
  // formats: "Passed: N" / "Failed: N" or "N passed, M failed".
  const combined = stdout + stderr;
  const passedMatch = combined.match(/Passed:\s*(\d+)/) || combined.match(/(\d+) passed/);
  const failedMatch = combined.match(/Failed:\s*(\d+)/) || combined.match(/(\d+) failed/);

  if (passedMatch) totalPassed += parseInt(passedMatch[1], 10);
  if (failedMatch) totalFailed += parseInt(failedMatch[1], 10);

  // A test file that exits non-zero without reporting failures (e.g. a crash
  // before the summary line) must still fail the suite.
  if (result.status !== 0 && (!failedMatch || parseInt(failedMatch[1], 10) === 0)) {
    console.error(`✗ ${testFile} exited with status ${result.status}`);
    totalFailed += 1;
  }
}

totalTests = totalPassed + totalFailed;

console.log('\n╔' + '═'.repeat(BOX_W) + '╗');
console.log(boxLine('                     Final Results'));
console.log('╠' + '═'.repeat(BOX_W) + '╣');
console.log(boxLine(`  Total Tests: ${String(totalTests).padStart(4)}`));
console.log(boxLine(`  Passed:      ${String(totalPassed).padStart(4)}  ✓`));
console.log(boxLine(`  Failed:      ${String(totalFailed).padStart(4)}  ${totalFailed > 0 ? '✗' : ' '}`));
console.log('╚' + '═'.repeat(BOX_W) + '╝');

process.exit(totalFailed > 0 ? 1 : 0);
