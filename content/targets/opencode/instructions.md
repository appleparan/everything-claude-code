## Harness: OpenCode

- **Delegation**: hand implementation to the built-in `general`
  subagent and read-only exploration to `explore`. Their model comes
  from your OpenCode configuration. The agents in this setup's `agents/`
  directory ship without a model, so they use the same configuration.
- **Skills and commands**: load a skill with the skill tool or
  `@<skill-id>`. The commands of this setup run as `/<name>`.
- **Safety**: if this setup installed its `opencode.json`, OpenCode
  asks before destructive shell commands. Install skips that file when
  you already have one; then merge its `permissions` into your own
  config. Rules in your own `opencode.jsonc` load after it and take
  precedence. A `` !`cmd` `` line in a command template runs outside
  the permission check, so review such lines before running a command.
- **Planning**: keep the plan and its status in
  `IMPLEMENTATION_PLAN.md`; the built-in `plan` agent is read-only.
