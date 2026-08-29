---
paths:
  - "**/*.tf"
  - "**/*.tfvars"
  - "**/playbooks/**/*.yml"
  - "**/roles/**/*.yml"
  - "**/k8s/**/*.yaml"
  - "**/helm/**"
---
# Infra Safety

> This file extends [common/security.md](../common/security.md) with
> safety rules for state-mutating infrastructure commands.

## Never Mutate Without Explicit Confirmation

Never run a state-mutating command without the user explicitly
confirming it first — regardless of how safe the change looks:

- `terraform apply` / `terraform destroy` (or `tofu apply` / `tofu destroy`)
- `ansible-playbook` without `--check`
- `kubectl apply` / `delete` / `drain` / `scale` / `cordon`
- `helm upgrade` / `install` / `uninstall` / `rollback`

## Always Prefer Read-Only First

Run the read-only counterpart before proposing a mutation, and share
its output as part of the proposal:

| Mutating command | Read-only preview |
|---|---|
| `terraform apply` / `destroy` | `terraform plan`, `terraform show`, `terraform state list` |
| `tofu apply` / `destroy` | `tofu plan`, `tofu show` |
| `ansible-playbook` | `ansible-playbook --check --diff` |
| `ansible` ad-hoc | read-only modules (e.g. `command: cat`, `setup`, `stat`) |
| `kubectl apply` / `delete` / `scale` | `kubectl get`, `kubectl describe`, `kubectl diff` |
| `kubectl logs` / `events` | (already read-only — use freely) |
| `helm upgrade` / `install` | `helm diff upgrade`, `helm status` |

## Before Proposing Any Mutation

State the blast radius:

- Which resources change, and which are destroyed/replaced (not just
  updated in place).
- What could break downstream (dependent services, traffic, data).
- The rollback path, and whether rollback is actually possible
  (e.g. some `terraform destroy` or PVC deletions are not reversible).

## What NOT to Do

- Never put a state-mutating command in a script, CI job, or subagent
  prompt that runs unattended — confirmation must come from a human
  in the loop for each run.
- Never chain a read-only preview and the mutating command together
  so the mutation runs automatically once the preview succeeds.
- Never treat "the plan looked fine" as equivalent to "the user
  confirmed" — the confirmation must be explicit.
