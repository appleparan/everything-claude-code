---
paths:
  - "**/*.tf"
  - "**/*.tfvars"
  - "**/playbooks/**/*.yml"
  - "**/roles/**/*.yml"
  - "**/k8s/**/*.yaml"
  - "**/helm/**"
---
# Infra Debugging

Debugging discipline for infrastructure incidents (cloud, on-prem,
and Kubernetes/Helm alike).

## Discipline

1. **Separate facts from interpretations.** What was reported
   verbatim (a log line, an alert, a user report) versus what it is
   assumed to mean — keep these visibly distinct.
2. **Define the normal/expected state first.** Before hypothesizing
   about what's wrong, state what "working" looks like for this
   system, so the actual state has something to compare against.
3. **Enumerate hypotheses layer by layer**, in this order:
   1. Recent changes (deploys, config/IaC diffs, applied plans)
   2. Resources (CPU/mem/disk/quota exhaustion)
   3. Network (DNS, load balancer, firewall/security group, routes)
   4. Dependent services (upstream/downstream APIs, databases, queues)
   5. Application (code, config, feature flags)
4. **Sort hypotheses by verification cost**, cheapest first, so
   read-only checks are exhausted before anything expensive or risky.
5. **State each hypothesis with its check.** Format: "hypothesis +
   how to check it" — the check must be a read-only command or a log
   location, never a mutating action.
6. **Record excluded hypotheses with their evidence.** Don't just drop
   a ruled-out hypothesis — keep it, with the evidence that excluded
   it, so it isn't silently re-investigated later.
7. **Never re-raise an excluded hypothesis** unless new evidence
   specifically reopens it.
8. **Quote raw log/output lines when citing evidence** — see
   [infra-verification.md](infra-verification.md) for the verbatim
   quoting rule.

## Example Hypothesis Entry

```text
Hypothesis: Recent Terraform apply changed the security group and
  blocked port 5432 to the app subnet.
Check (read-only): `terraform state show aws_security_group.db` and
  `git log -p -- security_groups.tf` for the last apply.
Status: excluded — security group rule unchanged since 2026-08-01;
  `terraform plan` shows no drift on this resource.
```
