# F10: Examples, Integration Tests, and CI

## Objective
Create policy examples, integration test fixtures, CI workflows, and the README.

## Examples (`examples/`)

### minimal/AGENTOWNERS.yml
Minimal policy from spec section 18.1.

### strict-oss/AGENTOWNERS.yml
Strict OSS policy from spec section 18.2.

### monorepo/AGENTOWNERS.yml
Monorepo policy — separate rules per package directory.

### security-sensitive/AGENTOWNERS.yml
Security-sensitive policy from spec section 18.3.

## Integration Test Fixtures (`packages/core/tests/fixtures/`)

### docs-only-pr/
- `policy.yml` — minimal policy
- `changed-files.txt` — list of doc files
- `event.json` — fake PR opened event
- `expected-decision.json` — expected Decision output

### workflow-edit-pr/
- Files: `.github/workflows/test.yml`
- Expected: block

### auth-change-pr/
- Files: `src/auth/session.ts`
- Expected: require_approval

### dependency-change-pr/
- Files: `package.json`, `package-lock.json`
- Expected: require_approval

### large-diff-pr/
- diffLinesCount: 500
- Expected: require_approval (based on diff_lines_over: 300)

### unknown-agent-pr/
- actor: `random-user`
- No agent signals
- Expected: require_approval (unknown_agent default)

## Integration Tests (`packages/core/tests/integration.test.ts`)
For each fixture:
1. Load policy from fixture
2. Apply event context
3. Call `evaluatePolicy()`
4. Compare to `expected-decision.json`

## CI Workflows (`.github/workflows/`)

### test.yml
Triggers: push and PR on main
Steps:
1. Checkout
2. Setup Node 22
3. Install pnpm
4. Install dependencies
5. Build packages
6. Run tests with coverage
7. Upload coverage report

### release.yml
Triggers: push tag matching `v*`
Steps:
1. Checkout
2. Setup Node 22
3. Install, build, test
4. Publish to npm (with npm token)
5. Create GitHub Release

## README
From spec section 21. Include:
- One-line description
- Why section
- What it does
- Quick start (copy-paste 3 steps)
- Example policy snippet
- Example GitHub Action workflow
- Philosophy section
- Status: Experimental

## CONTRIBUTING.md
- Development setup
- How to run tests
- How to add a new policy profile
- PR guidelines
- Code style

## SECURITY.md
- Responsible disclosure
- Security requirements (from spec section 24)
- What is and is not in scope

## CODE_OF_CONDUCT.md
Standard Contributor Covenant v2.1

## AGENTS.md
Project-level AGENTS.md for AI agents working on this repo:
- How the repo is structured
- How to run tests
- Key invariants (never execute policy content, redact secrets, etc.)
- Development workflow

## LICENSE
Apache-2.0

## Package files

### Root `package.json`
- Private monorepo
- Workspaces: `packages/*`
- Scripts: test, build, lint, format

### `packages/core/package.json`
- Name: `@agentowners/core`
- Dependencies: zod, js-yaml, minimatch
- DevDependencies: vitest, typescript, tsup

### `packages/cli/package.json`
- Name: `@agentowners/cli`
- Bin: `agentowners`
- Dependencies: @agentowners/core, commander
- DevDependencies: vitest, typescript, tsup

### `packages/github-action/package.json`
- Name: `@agentowners/github-action`
- Dependencies: @agentowners/core, @actions/core, @actions/github
- DevDependencies: vitest, typescript, tsup

### Root tsconfig.json
- target: ES2022
- module: Node16
- strict: true
- paths for workspace packages

### pnpm-workspace.yaml
- packages: ["packages/*"]
