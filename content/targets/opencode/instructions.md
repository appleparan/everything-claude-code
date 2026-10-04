## Harness: OpenCode

- **Delegation**: hand implementation to the built-in `general`
  subagent and read-only exploration to `explore`. Their model comes
  from your OpenCode configuration. The agents in this setup's `agents/`
  directory ship without a model, so they use the same configuration.
- **Skills and commands**: load a skill with the skill tool or
  `@<skill-id>`. The commands of this setup run as `/<name>`.
- **Safety**: the `opencode.json` installed with this setup asks before
  destructive shell commands. Rules in your own `opencode.jsonc` load
  after it and take precedence. A `` !`cmd` `` line in a command
  template runs outside the permission check, so the Safety rules above
  still apply in full.
- **Planning**: keep the plan and its status in
  `IMPLEMENTATION_PLAN.md`; the built-in `plan` agent is read-only.
