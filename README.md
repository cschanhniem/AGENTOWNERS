# AGENTOWNERS

**CODEOWNERS for AI agents.**

`AGENTS.md` tells agents how to work.  
`AGENTOWNERS` defines what agents are allowed to do.

---

## Why

AI agents can now open PRs, comment on issues, review code, and trigger automation in your repository. The missing layer is not another AI reviewer — it's **repo-native governance**:

- Which agent is acting?
- What action is it trying to perform?
- Is the action allowed by policy?
- Does it require human approval?
- Who should review it?
- Was the decision auditable?

AGENTOWNERS answers all of these from a single YAML file you check into your repo.

---

## What it does

- Detects AI-agent PRs from actor names, commit signatures, and body patterns
- Checks changed files against your policy rules
- Blocks dangerous paths (workflows, secrets, infra) by default
- Requires human approval for risky actions
- Labels AI-generated contributions automatically
- Posts an auditable verdict as a sticky PR comment
- Fails CI on blocked actions (configurable)

---

## Quick start

**1. Add `.github/AGENTOWNERS.yml`:**

```yaml
version: 1

defaults:
  known_agent: require_approval
  unknown_agent: require_approval
  docs_only: allow
  workflows: block
  secrets: block

rules:
  - name: "Allow docs-only changes"
    when:
      docs_only: true
    effect: allow
    reason: "Docs-only changes are low risk."

  - name: "Block workflow edits"
    when:
      files:
        - ".github/workflows/**"
    effect: block
    reason: "Agents may not modify GitHub Actions workflows."

  - name: "Require approval for dependency changes"
    when:
      changes_package_files: true
    effect: require_approval
    reason: "Dependency changes require maintainer review."
```

**2. Add the GitHub Action (`.github/workflows/agentowners.yml`):**

```yaml
name: AGENTOWNERS

on:
  pull_request:
    types: [opened, synchronize, reopened, ready_for_review]
  issues:
    types: [opened, labeled, closed]
  issue_comment:
    types: [created]
  pull_request_review:
    types: [submitted]

permissions:
  contents: read
  pull-requests: write
  issues: write

jobs:
  agentowners:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: agentowners/agentowners/check-action@v0
        with:
          policy-path: ".github/AGENTOWNERS.yml"
          mode: "both"
          fail-on-block: "true"
```

**3. Open an agent-generated PR and read the verdict.**

---

## Example verdict

When a PR opens from `github-copilot[bot]` modifying `src/auth/session.ts`:

```markdown
## AGENTOWNERS verdict: requires approval

This PR appears to be created by `github-copilot[bot]`.

Risk level: high
Risk score: 65/100

Matched rules:

1. `Require approval for auth changes`
   - matched files: `src/auth/session.ts`
   - reason: Auth and permission changes require human review.

Required reviewers:

- @maintainers/security

Suggested labels:

- ai-agent
- needs-human-review
- risk-high
```

---

## CLI

```bash
npm install -g @agentowners/cli

# Create a policy file
agentowners init --profile minimal

# Validate a policy file
agentowners validate .github/AGENTOWNERS.yml

# Check local diff against policy
agentowners check --base main --head HEAD

# Detect agent signals in current commit
agentowners fingerprint --commit HEAD
```

---

## Policy profiles

| Profile | Default behavior | Use case |
|---------|-----------------|----------|
| `minimal` | `require_approval` | New projects, getting started |
| `strict-oss` | `require_approval` | Open-source with many contributors |
| `security-sensitive` | `block` for unknown | Security-critical repositories |
| `monorepo` | Per-package rules | Large monorepos |

```bash
agentowners init --profile strict-oss
agentowners init --profile security-sensitive
```

---

## Policy format

### Root structure

```yaml
version: 1

agents:
  github-copilot:
    match:
      actors:
        - "github-copilot[bot]"
    allowed:
      - open_pr
      - comment
    requires_approval:
      - modify_tests
    blocked:
      - merge_pr
      - edit_workflows

defaults:
  unknown_agent: require_approval
  known_agent: require_approval
  docs_only: allow
  workflows: block
  secrets: block

rules:
  - name: "Block workflow edits"
    when:
      files:
        - ".github/workflows/**"
    effect: block
    reason: "Agents may not modify CI/CD workflows."
```

### Rule conditions

| Condition | Type | Description |
|-----------|------|-------------|
| `files` | `string[]` | Glob patterns for changed files |
| `files_not` | `string[]` | Exclude if any file matches |
| `agents` | `string[]` | Agent names from policy |
| `actors` | `string[]` | GitHub actor usernames |
| `actions` | `AgentAction[]` | Inferred actions |
| `labels` | `string[]` | PR/issue labels |
| `docs_only` | `boolean` | All changed files are docs |
| `tests_only` | `boolean` | All changed files are tests |
| `changes_package_files` | `boolean` | Any dependency file changed |
| `changes_workflows` | `boolean` | Any workflow file changed |
| `changes_auth` | `boolean` | Any auth/security path changed |
| `changes_infra` | `boolean` | Any infra path changed |
| `diff_lines_over` | `number` | Diff exceeds N lines |

### Effects

| Effect | Meaning |
|--------|---------|
| `allow` | No approval needed |
| `require_approval` | Human review required before merge |
| `block` | Action is forbidden |

Priority: `block > require_approval > allow`

---

## Detected actions

AGENTOWNERS infers these actions from GitHub events and changed files:

`open_pr` `update_pr` `comment` `review_comment` `approve_pr` `request_changes`
`label_issue` `close_issue` `reopen_issue` `assign_issue` `edit_workflows`
`modify_tests` `modify_docs` `modify_dependencies` `modify_auth` `modify_infra`
`touch_secrets` `change_permissions` `merge_pr`

---

## Agent detection

AGENTOWNERS detects AI agents from:

1. **Policy config** — explicit actor → agent mapping (`confirmed`)
2. **Known bots** — `github-copilot[bot]`, `copilot-swe-agent[bot]`, `dependabot[bot]`, `renovate[bot]` (`confirmed`)
3. **Commit signatures** — `Co-Authored-By: Claude`, `Generated with`, `🤖`, `Claude Code` (`likely`)
4. **PR body markers** — tool-specific footers (`likely`)
5. **Labels** — `ai-generated`, `agent`, `claude`, `copilot` (`possible`)

---

## Risk scoring

Each decision gets a risk score from 0–100:

| Signal | Score |
|--------|-------|
| Docs only | +5 |
| Small diff (< 50 lines) | +5 |
| Tests changed | +10 |
| Large diff (> 300 lines) | +30 |
| Dependency files changed | +30 |
| Infra paths changed | +40 |
| Auth paths changed | +50 |
| Workflow files changed | +50 |
| Permission changes | +60 |
| Secret patterns detected | +80 |
| Block action detected | +100 |

Risk levels: `low` (0–20) · `medium` (21–49) · `high` (50–79) · `critical` (80+)

---

## Modes

| Mode | Behavior |
|------|----------|
| `advisory` | Comment verdict, never fail CI |
| `enforcement` | Fail CI on `block` |
| `dry-run` | Print decision only, no comments or labels |

Default: `advisory` — safe for new adopters.

---

## Philosophy

This is not an AI reviewer.  
This is a permission layer for AI contributions.

AGENTOWNERS is deterministic — the same policy + the same PR always produces the same verdict. No LLM, no external API, no ambiguity.

Design principles:
1. Policy over prompts
2. Constraints over suggestions
3. Deterministic first, AI optional later
4. Maintainer control over agent autonomy
5. Repo-native over SaaS
6. Small config over dashboard
7. Fail safely on sensitive actions
8. Audit every decision
9. Complement `AGENTS.md`, do not replace it
10. First install useful in under five minutes

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). For AI agents: see [AGENTS.md](AGENTS.md).

---

## Status

**Experimental.** Use in `advisory` mode first. Read verdicts. Tune your policy. Switch to `enforcement` when ready.

---

## License

[Apache-2.0](LICENSE) — patent clarity matters for governance-adjacent tooling.
