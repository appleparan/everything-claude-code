## Harness: Codex

- **Delegation**: spawn the `worker` agent (gpt-5.6-terra) for
  implementation and the `explorer` agent (gpt-5.6-luna) for read-only
  exploration; both are installed in `~/.codex/agents/`. Codex only
  spawns on a direct request or an instruction like this one, so ask
  for it explicitly ("Spawn a worker agent to …"). Never let a
  subagent inherit the parent model (gpt-6-astra) for routine work.
