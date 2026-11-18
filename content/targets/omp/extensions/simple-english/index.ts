/**
 * simple-english: omp port of the always-on simple-english hook for Claude Code.
 *
 * On every before_agent_start the extension appends the simple-english skill
 * body (frontmatter stripped, capped at 9500 characters) to the system prompt
 * array. If the skill is missing or unreadable, a short fallback rule text is
 * used. The handler never throws and never adds the section twice.
 *
 * Logic lives in handler.cjs and prompt.cjs (tested by
 * tests/scripts/omp-simple-english.test.js).
 */
import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import handler from "./handler.cjs";

const extDir = dirname(fileURLToPath(import.meta.url));

export default function (pi: ExtensionAPI) {
	pi.on("before_agent_start", async (event) => handler.handleBeforeAgentStart(event, extDir));
}
