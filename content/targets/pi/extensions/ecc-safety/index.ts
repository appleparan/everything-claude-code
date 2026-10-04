/**
 * ecc-safety: pi port of the Claude Code hooks in content/targets/claude/hooks/common/hooks.json.
 *
 * - Destructive bash (rm -r, sudo, chmod/chown 777, git push --force, reset --hard,
 *   clean -f, worktree remove --force, branch -D, --no-verify): confirm with the
 *   user, or block when there is no UI. --force-with-lease is allowed. Git global
 *   options (-C, -c, --git-dir, ...) and `+ref` force pushes are recognized.
 *   Headless runs (subagent children use `pi -p`, no UI) block by default; set
 *   ECC_SAFETY_HEADLESS=allow in the environment to allow destructive commands
 *   there (the parent's own approval is then the only gate).
 * - Doc blocker: refuses `write` of a NEW .md/.txt file unless README.md, CLAUDE.md,
 *   AGENTS.md, CONTRIBUTING.md, IMPLEMENTATION_PLAN.md or SKILL.md.
 * - git push: reminder to review changes, then allow.
 * - gh pr create: notify the PR URL found in the tool output.
 *
 * Decision logic lives in policy.cjs (shared with tests/scripts/pi-safety.test.js).
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import policy from "./policy.cjs";

const { classifyBash, isBlockedDocWrite, extractPrUrl, isPrCreate, headlessDecision } = policy;

export default function (pi: ExtensionAPI) {
	pi.on("tool_call", async (event, ctx) => {
		if (event.toolName === "bash") {
			const command = String(event.input.command ?? "");
			const verdict = classifyBash(command);
			if (verdict.kind === "push") {
				if (ctx.hasUI) ctx.ui.notify("Review changes before push", "info");
				return undefined;
			}
			if (verdict.kind !== "destructive") return undefined;
			if (!ctx.hasUI) {
				if (!headlessDecision(process.env).block) return undefined;
				return {
					block: true,
					reason: `Destructive command blocked (${verdict.reason}; no UI for confirmation; set ECC_SAFETY_HEADLESS=allow to permit)`,
				};
			}
			const choice = await ctx.ui.select(
				`Destructive command (${verdict.reason}):\n\n  ${command}\n\nAllow?`,
				["Yes", "No"],
			);
			return choice === "Yes" ? undefined : { block: true, reason: "Blocked by user" };
		}

		if (event.toolName === "write") {
			const path = String(event.input.path ?? "");
			const exists = existsSync(resolve(ctx.cwd ?? process.cwd(), path));
			if (isBlockedDocWrite(path, exists)) {
				return { block: true, reason: `Unnecessary documentation file: ${path}. Use README.md instead.` };
			}
		}
		return undefined;
	});

	pi.on("tool_result", async (event, ctx) => {
		if (event.toolName !== "bash" || !isPrCreate(String(event.input.command ?? ""))) return undefined;
		const text = (event.content ?? []).map((c) => (c.type === "text" ? c.text : "")).join("\n");
		const url = extractPrUrl(text);
		if (url && ctx.hasUI) ctx.ui.notify(`PR created: ${url}`, "info");
		return undefined;
	});
}
