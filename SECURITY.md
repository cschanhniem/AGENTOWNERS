# Security Policy

## Reporting a vulnerability

Open a GitHub issue with title `[SECURITY] <brief description>` and we will respond within 48 hours. For critical vulnerabilities affecting production systems, use GitHub's private security advisory feature.

Do not post proof-of-concept code in public issues.

## Security requirements

### Policy evaluation

- Policy YAML is treated as untrusted data and validated strictly with Zod
- No `eval`, `new Function`, or `require()` from policy content
- No shell execution from policy content
- No remote code loading

### Secret handling

- Secret patterns in diffs are detected but never printed
- Matched values are always replaced with `[REDACTED]`
- Audit logs never contain raw secret values

### GitHub Action permissions

The action uses minimum required permissions:

```yaml
permissions:
  contents: read       # read policy file and changed files
  pull-requests: write # post verdict comment and apply labels
  issues: write        # post comment on issues
```

The action never requests:
- `secrets: read`
- `administration: write`
- `repository_projects: write`

### Input handling

All PR content (title, body, labels, commit messages) is treated as untrusted input. It is used for pattern matching only, never executed or interpolated into shell commands.

### Audit artifacts

The GitHub Action produces `agentowners-decision.json` as a workflow artifact. This file contains the decision, matched rules, and risk score — but never secret values or raw diff content.

## What is in scope

- Policy evaluation bugs (wrong decision for a given input)
- Secret value leakage in output or logs
- Code injection via policy YAML
- Permission escalation via the GitHub Action
- Incorrect agent detection leading to security bypass

## What is out of scope

- GitHub's own security features
- Social engineering attacks
- Vulnerabilities in dependencies (report to the dependency maintainer)
- Rate limiting on the GitHub API
