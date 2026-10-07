'use strict';
// Pure logic for the simple-english pi extension. CommonJS so that both jiti
// (imported from index.ts) and the repo's Node test suite can load it.

const fs = require('node:fs');

const MAX_CHARS = 9500;
const SKILL_NAME = 'simple-english';

const HEADER =
  'SIMPLE ENGLISH SKILL ACTIVE AUTOMATICALLY\n\n' +
  'Follow these writing rules without waiting for the user to name the skill. ' +
  'The full skill, with the rule catalog and the check mode, is the simple-english skill ' +
  'installed in this agent directory. Read it for a compliance check or for strict mode.\n\n';

const FALLBACK =
  HEADER +
  'Apply ASD-STE100 Simplified Technical English to technical-writing tasks. ' +
  'Use short sentences, active voice, one term for one meaning, and conditions before commands. ' +
  'Do not change code, identifiers, commands, or quoted errors.';

/** Remove a leading YAML frontmatter block (LF or CRLF). */
function stripFrontmatter(text) {
  const match = /^---[ \t]*\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/.exec(text);
  return match ? text.slice(match[0].length) : text;
}

/** Cut text to at most max characters. */
function capText(text, max = MAX_CHARS) {
  return text.length > max ? text.slice(0, max) : text;
}

/**
 * Build the section text. Returns the fallback when the skill is missing or
 * unreadable. Never throws.
 */
function buildSection(skills, readFile = (p) => fs.readFileSync(p, 'utf8')) {
  try {
    const skill = (Array.isArray(skills) ? skills : []).find((s) => s && s.name === SKILL_NAME);
    if (!skill || !skill.filePath) return FALLBACK;
    const body = stripFrontmatter(String(readFile(skill.filePath))).trim();
    if (!body) return FALLBACK;
    return capText(HEADER + body);
  } catch {
    return FALLBACK;
  }
}

module.exports = { stripFrontmatter, capText, buildSection, HEADER, FALLBACK, MAX_CHARS };
