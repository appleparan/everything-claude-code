'use strict';
// Pure decision logic for the ecc-safety pi extension. CommonJS so that both
// jiti (imported from index.ts) and the repo's Node test suite can load it.

const SEG = '[^;&|\\n]*'; // stay inside one shell command segment

// Quoted mentions (e.g. echo "--no-verify") are flagged too: this only asks
// for confirmation, so a false positive is cheap and unquoting is fragile.
const DESTRUCTIVE = [
  [/\brm\s+(?:-\S+\s+)*(?:-\w*[rR]\w*|--recursive)(?=\s|$)/, 'recursive rm'],
  [/\bsudo\b/, 'sudo'],
  [/\b(?:chmod|chown)\b.*777/, 'chmod/chown 777'],
  // --force-with-lease is deliberately allowed: it is the safe force push.
  [new RegExp(`\\bgit\\s+push\\b${SEG}\\s(?:--force(?![-\\w])|-[a-zA-Z]*f[a-zA-Z]*(?=\\s|$))`), 'git push --force'],
  [/\bgit\s+reset\b[^;&|\n]*--hard\b/, 'git reset --hard'],
  [new RegExp(`\\bgit\\s+clean\\b${SEG}\\s(?:--force\\b|-[a-zA-Z]*f)`), 'git clean -f'],
  [new RegExp(`\\bgit\\s+worktree\\s+remove\\b${SEG}\\s(?:--force\\b|-f\\b)`), 'git worktree remove --force'],
  [/\bgit\s+branch\b[^;&|\n]*\s-[a-zA-Z]*D/, 'git branch -D'],
  [/(?:^|[\s"'])--no-verify\b/, '--no-verify'],
];

const PUSH = /\bgit\s+push\b/;
const DOC_FILE = /\.(md|txt)$/;
const DOC_ALLOWED = new Set([
  'README.md', 'CLAUDE.md', 'AGENTS.md', 'CONTRIBUTING.md', 'IMPLEMENTATION_PLAN.md', 'SKILL.md',
]);
const PR_URL = /https:\/\/github\.com\/[^/\s]+\/[^/\s]+\/pull\/\d+/;

/** Classify a bash command as {kind: 'destructive'|'push'|'ok', reason?}. */
function classifyBash(command) {
  const cmd = String(command || '');
  for (const [re, reason] of DESTRUCTIVE) {
    if (re.test(cmd)) return { kind: 'destructive', reason };
  }
  if (PUSH.test(cmd)) return { kind: 'push', reason: 'git push' };
  return { kind: 'ok' };
}

/** True when writing a NEW file at filePath should be blocked as unnecessary docs. */
function isBlockedDocWrite(filePath, exists) {
  const p = String(filePath || '');
  if (!DOC_FILE.test(p) || exists) return false;
  return !DOC_ALLOWED.has(p.split(/[\\/]/).pop());
}

/** Extract the first github.com pull request URL from text, or null. */
function extractPrUrl(text) {
  const m = PR_URL.exec(String(text || ''));
  return m ? m[0] : null;
}

/** True when the command creates a PR via gh. */
function isPrCreate(command) {
  return /\bgh\s+pr\s+create\b/.test(String(command || ''));
}

module.exports = { classifyBash, isBlockedDocWrite, extractPrUrl, isPrCreate };
