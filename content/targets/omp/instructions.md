## Harness: omp

omp (oh-my-pi) ships its own built-in tools. The rest of this setup
comes from the skills, commands, agents, and extensions installed in
the omp agent directory (`~/.omp/agent/`).

- **Delegation**: to delegate, call the built-in `task` tool.
  Subagents use the models configured in omp. For delegated
  implementation, use the bundled `task` agent; for read-only
  exploration, use the bundled `scout` agent.
- **Skills and commands**: run a skill with `/skill:<name>`. The
  commands of this setup are slash commands, run as `/<name>`.
- **Safety**: the `ecc-safety` extension asks before destructive bash
  commands and blocks stray `.md`/`.txt` files, in addition to omp's
  own approval mode. It is a pattern list, not a boundary: the Safety
  rules above still apply in full.
- **Plain English**: the `simple-english` extension adds the
  `simple-english` skill to the system prompt before every turn, so
  its rules are always on. Run `/skill:simple-english` for a check.
- **Planning**: use omp's built-in plan mode and `todo` tool. For
  non-trivial work, keep the plan and its status in
  `IMPLEMENTATION_PLAN.md`.
