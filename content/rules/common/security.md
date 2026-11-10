# Security Guidelines

## Mandatory Security Checks

Before a commit, run the checks that apply:

Every commit (a leaked secret stays in history):

- [ ] No hardcoded secrets (API keys, passwords, tokens)
- [ ] Error messages don't leak sensitive data

When the change touches that surface (web endpoints, queries,
templates, auth):

- [ ] User inputs validated
- [ ] SQL injection prevention (parameterized queries)
- [ ] XSS prevention (sanitized HTML)
- [ ] CSRF protection enabled
- [ ] Authentication/authorization verified
- [ ] Rate limiting on endpoints

## Secret Management

- Do not hardcode secrets in source code
- Use environment variables or a secret manager
- Validate that required secrets are present at startup
- Rotate any secrets that may have been exposed

## Security Response Protocol

If security issue found:
1. Stop the current change, so the issue does not ship further
2. Use **security-reviewer** agent
3. Fix CRITICAL issues before continuing
4. Rotate any exposed secrets
5. Review entire codebase for similar issues
