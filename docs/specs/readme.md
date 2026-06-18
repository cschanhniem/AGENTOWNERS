# Project Specification: AGENTOWNERS

## 0. One-line positioning

AGENTOWNERS is **CODEOWNERS for AI agents**: an open-source policy layer that lets repository maintainers define what AI agents may do in issues, pull requests, reviews, labels, files, workflows, and repository automation.

## 1. Product thesis

AI coding agents are becoming normal contributors in GitHub repositories. They can open PRs, comment on issues, review code, propose fixes, and sometimes trigger automation. The missing layer is not another AI reviewer. The missing layer is repo-native governance:

* Which agent is acting?
* What action is it trying to perform?
* Which files, labels, issues, or PRs are affected?
* Is the action allowed?
* Does it require human approval?
* Who should review it?
* Was the decision auditable later?

AGENTOWNERS solves this by adding a repo-level policy file plus enforcement tools.

## 2. Core analogy

CODEOWNERS answers:

> Who owns this code path?

AGENTOWNERS answers:

> Which agents may act here, and under what constraints?

AGENTS.md answers:

> How should agents work in this repo?

AGENTOWNERS answers:

> What must agents not do, and what requires human approval?

## 3. Primary user

The primary user is an open-source maintainer who accepts or expects AI-generated contributions.

They want:

* less AI spam
* fewer risky agent PRs
* automatic labeling of agent-created work
* clear review escalation
* protection for sensitive paths
* audit logs for agent actions
* simple config checked into the repo

They do not want:

* a SaaS dashboard
* another AI reviewer
* a complex enterprise governance system
* a new agent framework
* a tool requiring them to change their existing agents

## 4. Non-goals

Do not build these in v1:

* Do not build a full AI code reviewer.
* Do not build a hosted SaaS product.
* Do not build a payment layer.
* Do not build a new agent protocol.
* Do not build a full identity standard.
* Do not require users to replace Copilot, Codex, Claude Code, Cursor, OpenHands, Devin, or other agents.
* Do not require a database in MVP.
* Do not require users to run a server in MVP.
* Do not request broad GitHub permissions.
* Do not allow auto-merge or repository administration changes in v1.

## 5. Product shape

The project should ship as three things:

1. A policy format:

   * `.github/AGENTOWNERS.yml`

2. A GitHub Action:

   * `agentowners/check-action`

3. A CLI:

   * `agentowners check`
   * `agentowners explain`
   * `agentowners init`
   * `agentowners validate`
   * `agentowners fingerprint`

Optional later:

4. A GitHub App:

   * for webhook-based enforcement and action execution

The MVP should work without a GitHub App by running as a GitHub Action on pull requests and issues.

## 6. Repository structure

Create a monorepo:

```text
agentowners/
  README.md
  LICENSE
  CONTRIBUTING.md
  SECURITY.md
  CODE_OF_CONDUCT.md
  AGENTS.md
  .github/
    workflows/
      test.yml
      release.yml
    AGENTOWNERS.yml.example
  packages/
    core/
      src/
      tests/
      package.json
      tsconfig.json
    cli/
      src/
      tests/
      package.json
      tsconfig.json
    github-action/
      src/
      action.yml
      package.json
      tsconfig.json
  examples/
    minimal/
      AGENTOWNERS.yml
    strict-oss/
      AGENTOWNERS.yml
    monorepo/
      AGENTOWNERS.yml
    security-sensitive/
      AGENTOWNERS.yml
  docs/
    index.md
    philosophy.md
    policy-reference.md
    github-action.md
    cli.md
    examples.md
    threat-model.md
    integrations.md
    faq.md
```

## 7. Recommended stack

Use TypeScript.

Required libraries:

* Node.js 22+
* TypeScript
* zod for schema validation
* js-yaml for YAML parsing
* minimatch for glob matching
* commander for CLI
* @actions/core for GitHub Action
* @actions/github for GitHub context
* vitest for tests
* eslint
* prettier
* tsup or tsx for builds

Do not use a database in MVP.

## 8. License

Use Apache-2.0 or MIT.

Recommendation: Apache-2.0 because this is a governance/security-adjacent project and patent clarity matters.

## 9. Config file location

Default policy file:

```text
.github/AGENTOWNERS.yml
```

Also support:

```text
AGENTOWNERS.yml
.agentowners.yml
```

Resolution order:

1. `.github/AGENTOWNERS.yml`
2. `AGENTOWNERS.yml`
3. `.agentowners.yml`

If multiple exist, use the first one and warn.

## 10. Minimal policy example

```yaml
version: 1

agents:
  github-copilot:
    match:
      actors:
        - "github-copilot[bot]"
        - "copilot-swe-agent[bot]"
    allowed:
      - open_pr
      - comment
      - label_issue
    requires_approval:
      - request_changes
      - modify_tests
    blocked:
      - merge_pr
      - edit_workflows
      - touch_secrets
      - change_permissions

rules:
  - name: "Block workflow edits by agents"
    when:
      files:
        - ".github/workflows/**"
    effect: block
    reason: "AI agents may not modify CI/CD workflows without maintainer approval."

  - name: "Require approval for auth changes"
    when:
      files:
        - "**/auth/**"
        - "**/security/**"
        - "**/permissions/**"
    effect: require_approval
    reviewers:
      - "@maintainers/security"
    reason: "Auth and permission changes require human review."

  - name: "Allow docs-only agent PRs"
    when:
      files:
        - "docs/**"
        - "*.md"
    effect: allow
    reason: "Docs-only changes are low risk."
```

## 11. Core data model

Implement these TypeScript types.

### 11.1 Policy

```ts
export type AgentOwnersPolicy = {
  version: 1;
  agents?: Record<string, AgentPolicy>;
  defaults?: DefaultPolicy;
  rules?: Rule[];
  audit?: AuditConfig;
};
```

### 11.2 AgentPolicy

```ts
export type AgentPolicy = {
  match: {
    actors?: string[];
    commitEmails?: string[];
    commitNames?: string[];
    prTitlePatterns?: string[];
    bodyPatterns?: string[];
    labels?: string[];
  };
  allowed?: AgentAction[];
  requires_approval?: AgentAction[];
  blocked?: AgentAction[];
};
```

### 11.3 Actions

Supported actions in v1:

```ts
export type AgentAction =
  | "open_pr"
  | "update_pr"
  | "comment"
  | "review_comment"
  | "approve_pr"
  | "request_changes"
  | "label_issue"
  | "close_issue"
  | "reopen_issue"
  | "assign_issue"
  | "edit_workflows"
  | "modify_tests"
  | "modify_docs"
  | "modify_dependencies"
  | "modify_auth"
  | "modify_infra"
  | "touch_secrets"
  | "change_permissions"
  | "merge_pr";
```

### 11.4 Rule

```ts
export type Rule = {
  name: string;
  when: RuleCondition;
  effect: "allow" | "require_approval" | "block";
  reviewers?: string[];
  labels?: string[];
  reason: string;
};
```

### 11.5 RuleCondition

```ts
export type RuleCondition = {
  agents?: string[];
  actors?: string[];
  actions?: AgentAction[];
  files?: string[];
  files_not?: string[];
  labels?: string[];
  pr_title?: string[];
  pr_body?: string[];
  issue_title?: string[];
  issue_body?: string[];
  diff_lines_over?: number;
  commits_over?: number;
  changes_package_files?: boolean;
  changes_workflows?: boolean;
  changes_permissions?: boolean;
  changes_auth?: boolean;
  changes_infra?: boolean;
  docs_only?: boolean;
  tests_only?: boolean;
};
```

### 11.6 Decision

```ts
export type Decision = {
  effect: "allow" | "require_approval" | "block";
  matchedRules: MatchedRule[];
  matchedAgent?: string;
  detectedActions: AgentAction[];
  riskScore: number;
  riskLevel: "low" | "medium" | "high" | "critical";
  requiredReviewers: string[];
  labelsToApply: string[];
  explanation: string;
};
```

## 12. Agent detection

The tool must detect whether a PR, issue, comment, or commit likely came from an AI agent.

Detection levels:

```ts
export type AgentDetectionConfidence = "confirmed" | "likely" | "possible" | "unknown";
```

Detection signals:

1. GitHub actor matches known bot:

   * `github-copilot[bot]`
   * `copilot-swe-agent[bot]`
   * `dependabot[bot]`
   * `renovate[bot]`
   * configured actor names

2. Commit message contains agent signature:

   * `Co-Authored-By: Claude`
   * `Co-Authored-By: Codex`
   * `Generated with`
   * `🤖`
   * `AI-generated`
   * `Claude Code`
   * `OpenAI Codex`
   * `Cursor`

3. PR body contains known agent markers:

   * generated summary
   * agent run link
   * tool-specific footer
   * configured body patterns

4. Labels:

   * `ai-generated`
   * `agent`
   * `copilot`
   * `codex`
   * `claude`
   * configured labels

5. Explicit config match:

   * policy maps a GitHub actor to an agent name

Important: Do not claim certainty unless the actor is explicitly configured or known.

## 13. Action detection

The MVP should infer actions from GitHub event context and changed files.

### 13.1 Pull request opened

Detected action:

```text
open_pr
```

Additional inferred actions:

* `modify_docs` if only Markdown/docs files changed
* `modify_tests` if test files changed
* `modify_dependencies` if package files changed
* `edit_workflows` if `.github/workflows/**` changed
* `modify_auth` if paths match auth/security/permissions
* `modify_infra` if paths match infra/deploy/terraform/k8s/docker
* `change_permissions` if files contain permission/auth policy changes
* `touch_secrets` if files or diff mention secrets patterns

### 13.2 PR synchronize/update

Detected action:

```text
update_pr
```

Then infer file-based actions again.

### 13.3 Issue comment

Detected action:

```text
comment
```

### 13.4 Pull request review

Detected action:

```text
review_comment
```

If review state is approval:

```text
approve_pr
```

If review state is request changes:

```text
request_changes
```

### 13.5 Issue label

Detected action:

```text
label_issue
```

### 13.6 Issue close

Detected action:

```text
close_issue
```

## 14. Risk scoring

Implement a deterministic risk score from 0 to 100.

Default scoring:

```text
docs_only: +5
tests_only: +10
small_diff_under_50_lines: +5
diff_50_to_300_lines: +15
diff_over_300_lines: +30
dependency_file_changed: +30
workflow_changed: +50
auth_path_changed: +50
infra_path_changed: +40
permissions_changed: +60
secrets_pattern_detected: +80
agent_unknown_confidence: +20
agent_confirmed: +0
blocked_action_detected: +100
```

Risk levels:

```text
0-20: low
21-49: medium
50-79: high
80-100+: critical
```

Decision priority:

```text
block > require_approval > allow
```

If any matched rule blocks, final decision is block.

If no block but any rule requires approval, final decision is require_approval.

If explicit allow and no stricter rule, final decision is allow.

If no rule matches, use defaults.

Default behavior should be conservative:

```yaml
defaults:
  unknown_agent: require_approval
  known_agent: require_approval
  docs_only: allow
  workflows: block
  secrets: block
```

## 15. Output behavior

The tool must generate a human-readable verdict.

Example:

```markdown
## AGENTOWNERS verdict: requires approval

This PR appears to be created by `github-copilot[bot]`.

Risk level: high  
Risk score: 65/100

Matched rules:

1. `Require approval for auth changes`
   - matched files: `src/auth/session.ts`
   - reason: Auth and permission changes require human review.

2. `Block workflow edits by agents`
   - no match

Required reviewers:

- @maintainers/security

Suggested labels:

- ai-agent
- needs-human-review
- risk-high

Decision:

This PR should not be merged until a human maintainer reviews the auth-related changes.
```

For block:

```markdown
## AGENTOWNERS verdict: blocked

This agent action is blocked by repository policy.

Matched rule:

- `Block workflow edits by agents`

Reason:

AI agents may not modify CI/CD workflows without maintainer approval.

Recommended next step:

Ask a maintainer to make this change manually or open a new PR with explicit human ownership.
```

For allow:

```markdown
## AGENTOWNERS verdict: allowed

This appears to be a low-risk docs-only AI contribution.

Matched rule:

- `Allow docs-only agent PRs`

No human approval required by AGENTOWNERS policy.
```

## 16. GitHub Action behavior

Create an action at:

```text
packages/github-action/action.yml
```

Usage:

```yaml
name: AGENTOWNERS

on:
  pull_request:
    types: [opened, synchronize, reopened, ready_for_review]
  issues:
    types: [opened, edited, labeled, closed, reopened]
  issue_comment:
    types: [created, edited]
  pull_request_review:
    types: [submitted]

permissions:
  contents: read
  pull-requests: read
  issues: write

jobs:
  agentowners:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: agentowners/agentowners/check-action@v1
        with:
          policy-path: ".github/AGENTOWNERS.yml"
          mode: "comment"
          fail-on-block: "true"
          fail-on-require-approval: "false"
```

Action inputs:

```yaml
inputs:
  policy-path:
    required: false
    default: ".github/AGENTOWNERS.yml"
  mode:
    required: false
    default: "comment"
    description: "comment | check | both | dry-run"
  fail-on-block:
    required: false
    default: "true"
  fail-on-require-approval:
    required: false
    default: "false"
  add-labels:
    required: false
    default: "true"
  known-agent-actors:
    required: false
```

Action outputs:

```yaml
outputs:
  decision:
    description: "allow | require_approval | block"
  risk-score:
    description: "0-100+"
  risk-level:
    description: "low | medium | high | critical"
  matched-rules:
    description: "JSON array of matched rules"
```

Behavior:

* On PR events:

  * fetch changed files
  * fetch PR metadata
  * infer agent
  * infer actions
  * evaluate policy
  * post or update a sticky comment
  * optionally apply labels
  * fail check if decision is block

* On issue events:

  * inspect actor, title, body, labels
  * evaluate comment/label/close action
  * post verdict as issue comment if needed

* On review events:

  * inspect review state
  * block or warn on agent approvals/request-changes if policy disallows

Sticky comment marker:

```markdown
<!-- agentowners-verdict -->
```

When posting a new verdict, update existing comment with that marker instead of posting duplicates.

## 17. CLI behavior

### 17.1 `agentowners init`

Creates `.github/AGENTOWNERS.yml`.

Options:

```text
agentowners init --profile minimal
agentowners init --profile strict-oss
agentowners init --profile security-sensitive
```

### 17.2 `agentowners validate`

Validates schema.

```text
agentowners validate .github/AGENTOWNERS.yml
```

Output:

```text
AGENTOWNERS policy valid.
```

On error:

```text
Invalid AGENTOWNERS policy:
- rules[0].effect must be one of allow, require_approval, block
- agents.copilot.match.actors must be an array of strings
```

### 17.3 `agentowners check`

Checks local git diff or GitHub PR.

Modes:

```text
agentowners check --policy .github/AGENTOWNERS.yml --base main --head HEAD
agentowners check --pr 123
agentowners check --event pull_request --payload event.json
```

For MVP, implement local diff mode first.

### 17.4 `agentowners explain`

Explains why a decision happened.

```text
agentowners explain --decision decision.json
```

### 17.5 `agentowners fingerprint`

Detects whether a PR/commit likely came from an AI agent.

```text
agentowners fingerprint --pr 123
agentowners fingerprint --commit HEAD
```

## 18. Policy profiles

Ship example profiles.

### 18.1 minimal

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

### 18.2 strict-oss

```yaml
version: 1

defaults:
  known_agent: require_approval
  unknown_agent: require_approval
  docs_only: require_approval
  workflows: block
  secrets: block

rules:
  - name: "Block sensitive paths"
    when:
      files:
        - ".github/workflows/**"
        - ".github/actions/**"
        - "**/auth/**"
        - "**/security/**"
        - "**/permissions/**"
        - "infra/**"
        - "terraform/**"
        - "k8s/**"
    effect: block
    reason: "Agents may not modify sensitive operational or security paths."

  - name: "Require approval for large diffs"
    when:
      diff_lines_over: 300
    effect: require_approval
    reason: "Large AI-generated diffs are hard to review safely."

  - name: "Require approval for dependencies"
    when:
      changes_package_files: true
    effect: require_approval
    reason: "Dependency changes can affect supply-chain risk."
```

### 18.3 security-sensitive

```yaml
version: 1

defaults:
  known_agent: require_approval
  unknown_agent: block
  docs_only: require_approval
  workflows: block
  secrets: block

rules:
  - name: "Block unknown agents"
    when:
      agents:
        - "unknown"
    effect: block
    reason: "Unknown agents cannot act in this repository."

  - name: "Block all workflow edits"
    when:
      files:
        - ".github/workflows/**"
    effect: block
    reason: "CI/CD workflows must be edited by humans."

  - name: "Block auth/security edits"
    when:
      files:
        - "**/auth/**"
        - "**/security/**"
        - "**/permissions/**"
    effect: block
    reason: "Security-sensitive code must be changed by accountable humans."

  - name: "Require approval for test changes"
    when:
      files:
        - "**/*.test.*"
        - "**/*.spec.*"
        - "tests/**"
    effect: require_approval
    reason: "Agents may weaken tests accidentally."
```

## 19. File classification

Implement deterministic file classification.

### Docs

```text
*.md
docs/**
*.rst
*.adoc
```

### Tests

```text
**/*.test.*
**/*.spec.*
tests/**
__tests__/**
```

### Dependencies

```text
package.json
package-lock.json
pnpm-lock.yaml
yarn.lock
bun.lockb
requirements.txt
uv.lock
poetry.lock
Pipfile
Pipfile.lock
Cargo.toml
Cargo.lock
go.mod
go.sum
pom.xml
build.gradle
composer.json
composer.lock
Gemfile
Gemfile.lock
```

### Workflows

```text
.github/workflows/**
.github/actions/**
```

### Infra

```text
infra/**
terraform/**
k8s/**
helm/**
deploy/**
Dockerfile
docker-compose.yml
*.tf
*.tfvars
```

### Auth/security

```text
**/auth/**
**/security/**
**/permissions/**
**/roles/**
**/policy/**
**/rbac/**
```

### Secrets indicators

File names:

```text
.env
.env.*
*.pem
*.key
id_rsa
id_ed25519
secrets.*
```

Diff patterns:

```text
AWS_SECRET_ACCESS_KEY
AWS_ACCESS_KEY_ID
GITHUB_TOKEN
OPENAI_API_KEY
ANTHROPIC_API_KEY
PRIVATE_KEY
SECRET_KEY
PASSWORD=
TOKEN=
```

Never print secret values in output. Redact matched lines.

## 20. Audit log

MVP audit can be comment-based and artifact-based.

The GitHub Action should produce:

```text
agentowners-decision.json
```

Schema:

```json
{
  "version": 1,
  "timestamp": "2026-06-18T00:00:00Z",
  "repository": "owner/repo",
  "event": "pull_request",
  "actor": "github-copilot[bot]",
  "matchedAgent": "github-copilot",
  "confidence": "confirmed",
  "decision": "require_approval",
  "riskScore": 65,
  "riskLevel": "high",
  "detectedActions": ["open_pr", "modify_auth"],
  "changedFiles": ["src/auth/session.ts"],
  "matchedRules": [
    {
      "name": "Require approval for auth changes",
      "effect": "require_approval",
      "reason": "Auth and permission changes require human review."
    }
  ],
  "requiredReviewers": ["@maintainers/security"]
}
```

In v1, store audit in:

* GitHub Action artifact
* sticky PR comment
* optional `.agentowners/audit/*.json` only for local CLI use

Do not commit audit logs automatically to the repository in v1.

## 21. README structure

The README should be sharp and OSS-native.

Suggested README outline:

```markdown
# AGENTOWNERS

CODEOWNERS for AI agents.

AGENTS.md tells agents how to work.
AGENTOWNERS defines what agents are allowed to do.

## Why

AI agents can now open PRs, comment on issues, and review code.
Maintainers need a repo-native way to define boundaries.

## What it does

- Detects AI-agent PRs and comments
- Checks changed files against policy
- Blocks dangerous paths
- Requires human approval for risky actions
- Labels AI-generated contributions
- Posts an auditable verdict

## Quick start

1. Add `.github/AGENTOWNERS.yml`
2. Add the GitHub Action
3. Open an agent-generated PR
4. Read the verdict

## Example

[policy snippet]

## Philosophy

This is not an AI reviewer.
This is a permission layer for AI reviewers.

## Status

Experimental. Use in advisory mode first.
```

## 22. Acceptance criteria for MVP

The MVP is complete when all of these work:

1. `agentowners init --profile minimal` creates a valid policy.
2. `agentowners validate` validates correct policies and rejects invalid ones.
3. `agentowners check --base main --head HEAD` analyzes local changed files.
4. GitHub Action runs on PR open/sync.
5. GitHub Action detects changed files.
6. GitHub Action detects likely agent actor from configured actors.
7. GitHub Action evaluates rules in deterministic priority.
8. GitHub Action posts one sticky verdict comment.
9. GitHub Action fails the check when decision is block.
10. GitHub Action does not fail when decision is require_approval unless configured.
11. Package has at least 80% unit test coverage for policy evaluation.
12. README has copy-paste quickstart.
13. Examples include minimal, strict OSS, monorepo, and security-sensitive policies.
14. No broad GitHub permissions are requested.
15. Secret-like values are redacted in logs.

## 23. Testing plan

### Unit tests

Test:

* YAML parsing
* schema validation
* glob matching
* rule priority
* default policy behavior
* docs-only classification
* test-only classification
* dependency file detection
* workflow file detection
* auth path detection
* infra path detection
* secret pattern redaction
* agent actor matching
* risk scoring
* decision explanation

### Integration tests

Create fixture repositories:

```text
fixtures/
  docs-only-pr/
  workflow-edit-pr/
  auth-change-pr/
  dependency-change-pr/
  large-diff-pr/
  unknown-agent-pr/
```

Each fixture contains:

* policy file
* changed files list
* fake GitHub event payload
* expected decision JSON

### GitHub Action test

Use mocked GitHub context and event payloads.

Do not require real GitHub API calls in unit tests.

## 24. Security requirements

* Use least privilege in GitHub Actions.
* Default to read-only where possible.
* Do not request repository administration permission.
* Do not request secrets permission.
* Do not execute untrusted code from PRs.
* Do not parse or print secret values.
* Treat PR content as untrusted input.
* Never run shell commands from policy content.
* Avoid dynamic evaluation.
* Avoid remote code loading.
* Validate YAML strictly.
* Fail closed on invalid policy if `strict` mode is enabled.
* In advisory mode, fail open but comment with warning.

## 25. Modes

Support three modes:

### Advisory mode

Default for new users.

* comment verdict
* never block CI
* useful for learning

### Enforcement mode

* block forbidden agent actions
* fail CI on `block`
* optionally fail CI on `require_approval`

### Dry-run mode

* print decision only
* no comments
* no labels
* no CI failure

## 26. Versioning

Policy file has:

```yaml
version: 1
```

Any unsupported version should fail with clear error.

Use semantic versioning for package releases.

## 27. Future roadmap

Do not build these in MVP, but design so they are possible:

### v1.1

* GitHub App
* label application
* reviewer request
* support for issue triage
* richer agent fingerprints
* SARIF output

### v1.2

* OpenHands integration
* Claude Code integration
* Codex integration
* Cursor integration
* agent self-check command

### v2

* signed agent action manifests
* policy inheritance for orgs
* compatibility with AGENTS.md
* `AGENTOWNERS.lock`
* temporal audit graph
* support for GitLab
* support for Forgejo/Gitea

## 28. Suggested package names

Repository:

```text
agentowners/agentowners
```

NPM packages:

```text
@agentowners/core
@agentowners/cli
@agentowners/github-action
```

CLI binary:

```text
agentowners
```

GitHub Action:

```yaml
uses: agentowners/agentowners/check-action@v1
```

Policy file:

```text
.github/AGENTOWNERS.yml
```

## 29. First implementation order

Build in this exact order:

1. Create monorepo skeleton.
2. Implement policy schema with zod.
3. Implement YAML loader.
4. Implement glob matching.
5. Implement file classifier.
6. Implement action inference from changed files.
7. Implement agent detection from actor and metadata.
8. Implement deterministic rule evaluation.
9. Implement risk scoring.
10. Implement markdown verdict renderer.
11. Implement CLI `validate`.
12. Implement CLI `init`.
13. Implement CLI `check` for local diffs.
14. Implement GitHub Action wrapper.
15. Implement sticky PR comment.
16. Add examples.
17. Add tests.
18. Add README quickstart.
19. Add CI.
20. Cut v0.1.0 release.

## 30. Design principles

1. Policy over prompts.
2. Constraints over suggestions.
3. Deterministic first, AI optional later.
4. Maintainer control over agent autonomy.
5. Repo-native over SaaS.
6. Small config over dashboard.
7. Fail safely on sensitive actions.
8. Audit every decision.
9. Complement AGENTS.md, do not replace it.
10. Make the first install useful in under five minutes.

## 31. Final deliverable

Produce a working OSS repository that can be installed into another GitHub repo and used like this:

```yaml
name: AGENTOWNERS

on:
  pull_request:
    types: [opened, synchronize, reopened, ready_for_review]

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

The final repository must include:

* working TypeScript packages
* CLI
* GitHub Action
* policy examples
* tests
* README
* docs
* security notes
* contribution guide
* release workflow

The project is not successful if it merely describes a policy. It is successful only when a maintainer can copy one YAML file and one GitHub Action into a repo and immediately get a useful verdict on an AI-generated PR.

