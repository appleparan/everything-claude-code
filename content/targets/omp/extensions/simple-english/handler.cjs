'use strict';
// Pure logic for the simple-english omp extension. CommonJS so that both bun
// (imported from index.ts) and the repo's Node test suite can load it.
// prompt.cjs is the pi extension's file; the installer copies it next to this one.

const path = require('node:path');
const { buildSection } = require('./prompt.cjs');

const SKILL_NAME = 'simple-english';

/** Path of the installed skill: <agent dir>/skills/simple-english/SKILL.md. */
function skillFilePath(extDir) {
  return path.resolve(extDir, '..', '..', 'skills', SKILL_NAME, 'SKILL.md');
}

/**
 * Build the before_agent_start result. Returns undefined when the section is
 * already present or on any error, so it never breaks the agent run.
 */
function handleBeforeAgentStart(event, extDir, build = buildSection) {
  try {
    const current = event && Array.isArray(event.systemPrompt) ? event.systemPrompt : [];
    const section = build([{ name: SKILL_NAME, filePath: skillFilePath(extDir) }]);
    if (current.includes(section)) return undefined;
    return { systemPrompt: [...current, section] };
  } catch {
    return undefined;
  }
}

module.exports = { skillFilePath, handleBeforeAgentStart };
