# F9: GitHub Action

## Objective
Implement the AGENTOWNERS GitHub Action that runs on PR/issue/review events.

## Package
`packages/github-action/`

## Files
- `packages/github-action/action.yml` — action definition
- `packages/github-action/src/index.ts` — main entrypoint
- `packages/github-action/src/github.ts` — GitHub API helpers
- `packages/github-action/src/comment.ts` — sticky comment management
- `packages/github-action/tests/` — unit tests with mocked @actions/github

## action.yml Definition

```yaml
name: AGENTOWNERS
description: CODEOWNERS for AI agents — policy enforcement for AI-generated PRs
author: agentowners

inputs:
  policy-path:
    required: false
    default: ".github/AGENTOWNERS.yml"
    description: "Path to AGENTOWNERS policy file"
  mode:
    required: false
    default: "comment"
    description: "comment | check | both | dry-run"
  fail-on-block:
    required: false
    default: "true"
    description: "Fail CI when decision is block"
  fail-on-require-approval:
    required: false
    default: "false"
    description: "Fail CI when decision is require_approval"
  add-labels:
    required: false
    default: "true"
    description: "Apply suggested labels to PR/issue"
  known-agent-actors:
    required: false
    description: "Comma-separated list of known agent actor names"

outputs:
  decision:
    description: "allow | require_approval | block"
  risk-score:
    description: "0-100+"
  risk-level:
    description: "low | medium | high | critical"
  matched-rules:
    description: "JSON array of matched rules"

runs:
  using: node20
  main: dist/index.js
```

## Required GitHub Permissions
- `contents: read`
- `pull-requests: write` (for comments and labels)
- `issues: write` (for issue comments)

## Main Logic (`src/index.ts`)

```
1. Get inputs
2. Get GitHub context (event, payload)
3. Load policy file
4. Branch on event type:
   - pull_request → fetchPRFiles, fetchPRMetadata
   - issues → inspect actor/title/body/labels
   - pull_request_review → inspect review state
   - issue_comment → inspect comment actor/body
5. Classify files
6. Infer actions
7. Detect agent
8. Evaluate policy
9. Render verdict
10. Post/update sticky comment (if mode includes "comment")
11. Apply labels (if add-labels: true)
12. Set outputs
13. Fail if needed
```

## Sticky Comment

Marker: `<!-- agentowners-verdict -->`

Logic:
1. List existing PR comments
2. Find comment containing the marker
3. If found → update it (PATCH)
4. If not found → create new comment (POST)

## Label Application
Apply `labelsToApply` from Decision to the PR/issue.
Create labels if they don't exist (with sensible colors).

## Audit Artifact
Write `agentowners-decision.json` to `$GITHUB_WORKSPACE` for upload as artifact.

## Tests (`packages/github-action/tests/`)
- PR opened event → fetches files, evaluates, posts comment
- Block decision → fails action when fail-on-block is true
- Block decision → does not fail when fail-on-block is false
- Dry-run mode → no comment posted, no labels
- Sticky comment updated on re-run
- Audit JSON written correctly
- Labels applied to PR

## Security Requirements
- Never print secret patterns from diff content
- Treat all PR content as untrusted input
- Do not execute content from policy as code
- Use least-privilege permissions
