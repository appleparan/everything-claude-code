## Harness: pi

pi ships only a few built-in tools; the rest of this setup comes from
the extensions, agents, prompts, and skills installed in the pi agent directory (`~/.pi/agent/` unless
`PI_CODING_AGENT_DIR` is set).

- **Delegation**: call the `subagent` tool. Use the `worker` agent
  (sonnet) for implementation and the `scout` agent (haiku) for
  read-only exploration. Each file in its `agents/` directory sets its
  own model; an agent without one inherits yours, so never route
  routine work to such an agent.
- **Skills and commands**: run a skill with `/skill:<name>`. The
  commands of this setup are prompt templates, run as `/<name>`.
- **Safety**: pi asks no permission before a tool call and has no
  sandbox. The `ecc-safety` extension asks before destructive bash
  commands and blocks stray `.md`/`.txt` files. It is a pattern list,
  not a boundary: the Safety rules above still apply in full.
- **Planning**: pi has no plan mode or todo tool. Keep the plan and its
  status in `IMPLEMENTATION_PLAN.md`.
