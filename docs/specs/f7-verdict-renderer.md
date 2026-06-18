# F7: Verdict Renderer

## Objective
Generate human-readable markdown verdict from a Decision object.

## Package
`packages/core/src/renderer.ts`

## Output Format

### allow verdict
```markdown
## AGENTOWNERS verdict: allowed

This appears to be a low-risk docs-only AI contribution.

Matched rule:

- `Allow docs-only agent PRs`

No human approval required by AGENTOWNERS policy.
```

### require_approval verdict
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

Decision:

This PR should not be merged until a human maintainer reviews the auth-related changes.
```

### block verdict
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

## Marker
Always wrap output with the sticky comment marker:
```
<!-- agentowners-verdict -->
<content>
<!-- /agentowners-verdict -->
```

## Functions

### `renderVerdict(decision: Decision, options?: RenderOptions): string`
Generate full markdown verdict.

```ts
export type RenderOptions = {
  actor?: string;
  includeMarker?: boolean; // default true
  compact?: boolean;       // shorter output for CI check output
};
```

### `renderAllowed(decision: Decision, options: RenderOptions): string`
### `renderRequiresApproval(decision: Decision, options: RenderOptions): string`
### `renderBlocked(decision: Decision, options: RenderOptions): string`

## Audit JSON

### `renderAuditJson(context: AuditContext): AuditRecord`
```ts
export type AuditRecord = {
  version: 1;
  timestamp: string;
  repository?: string;
  event?: string;
  actor: string;
  matchedAgent?: string;
  confidence: AgentDetectionConfidence;
  decision: Decision['effect'];
  riskScore: number;
  riskLevel: string;
  detectedActions: AgentAction[];
  changedFiles: string[];
  matchedRules: Array<{ name: string; effect: string; reason: string }>;
  requiredReviewers: string[];
};
```

## Tests (`packages/core/tests/renderer.test.ts`)
- `allow` decision renders "allowed" heading
- `block` decision renders "blocked" heading
- `require_approval` renders risk score
- Matched rules listed with reasons
- Required reviewers listed
- Sticky comment marker included by default
- `compact: true` produces shorter output
- `renderAuditJson` produces correct structure
