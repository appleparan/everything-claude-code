---
paths:
  - "**/*.tf"
  - "**/*.tfvars"
  - "**/playbooks/**/*.yml"
  - "**/roles/**/*.yml"
  - "**/k8s/**/*.yaml"
  - "**/helm/**"
---
# Infra Verification

Verification discipline for facts used in infrastructure work.

## Cite or Flag, Never Guess

Every number, quota, limit, price, SLA, instance spec, or service name
used in a design, review, or debugging session must either:

- cite an official documentation link (cloud provider docs, Terraform
  provider/module docs, Kubernetes/Helm docs, vendor SLA page), or
- be explicitly marked **"needs verification"**.

Never present an estimate, a recalled value, or a plausible-sounding
number as a verified fact. If you are not certain a figure is current,
say so — do not round it to something confident-sounding.

## Log Interpretation

When citing log or command output as evidence:

- Quote the original lines verbatim before interpreting them.
- Do not paraphrase a log line and then reason from the paraphrase.
- Keep the quoted evidence next to the conclusion it supports so the
  human can check the inference.

## Mark Verification Status Explicitly

In any output that states facts, distinguish:

- **Verified against official docs/source** — link or exact source
  included.
- **Unverified** — labeled "needs verification", never stated as if
  confirmed.

## Updating Verification Status

When the user verifies an item (confirms a number, points to a doc,
or checks it themselves), update that item's status to verified in
the document and keep the source. Do not silently drop the "needs
verification" marker without a source to replace it.
