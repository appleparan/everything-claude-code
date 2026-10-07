/**
 * simple-english: pi port of the always-on simple-english hook for Claude Code.
 *
 * On every before_agent_start the extension injects the simple-english skill
 * body (frontmatter stripped, capped at 9500 characters) into the system prompt
 * as the `simple_english` section. If the skill is missing or unreadable, a
 * short fallback rule text is used. The handler never throws.
 *
 * Logic lives in prompt.cjs (shared with tests/scripts/pi-simple-english.test.js).
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import prompt from "./prompt.cjs";

const { buildSection } = prompt;

export default function (pi: ExtensionAPI) {
	pi.on("before_agent_start", async (event) => {
		try {
			const options = event.systemPromptOptions;
			options.sections = {
				...(options.sections ?? {}),
				simple_english: buildSection(options.skills ?? []),
			};
		} catch {
			// never break the agent run
		}
		return undefined;
	});
}
