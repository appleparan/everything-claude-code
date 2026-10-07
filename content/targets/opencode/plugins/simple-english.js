// Always-on Simple English for OpenCode.
//
// Appends the simple-english skill body to the system prompt on every turn,
// so the writing rules apply without the user naming the skill. This mirrors
// the Claude Code plugin's SessionStart hook. The skill file is read from
// ../skills/simple-english/SKILL.md next to this plugin directory; if it is
// missing, a short static rule summary is used instead. The hook never throws.
import { readFileSync } from 'node:fs'

const MAX_CHARS = 9500

const HEADER =
  'SIMPLE ENGLISH SKILL ACTIVE AUTOMATICALLY\n\n' +
  'Follow these writing rules without waiting for the user to name the skill. ' +
  'The full skill, with the rule catalog and the check mode, is the simple-english ' +
  'skill installed in this OpenCode config directory. ' +
  'Read it for a compliance check or for strict mode.\n\n'

const FALLBACK =
  'Apply ASD-STE100 Simplified Technical English to technical-writing tasks. ' +
  'Use short sentences, active voice, one term for one meaning, and conditions before commands. ' +
  'Do not change code, identifiers, commands, or quoted errors.'

function skillBody() {
  const raw = readFileSync(new URL('../skills/simple-english/SKILL.md', import.meta.url), 'utf8')
  const text = raw.replace(/^\uFEFF/, '')
  const body = text.replace(/^---[ \t]*\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/, '').trim()
  if (!body) throw new Error('empty skill body')
  return body
}

function text() {
  try {
    return (HEADER + skillBody()).slice(0, MAX_CHARS)
  } catch {
    return HEADER + FALLBACK
  }
}

export const SimpleEnglish = async () => ({
  'experimental.chat.system.transform': async (_input, output) => {
    try {
      output.system.push(text())
    } catch {
      // Never break a chat turn because of this plugin.
    }
  }
})
