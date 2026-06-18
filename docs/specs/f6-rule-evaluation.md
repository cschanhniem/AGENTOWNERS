# F6: Rule Evaluation and Risk Scoring

## Objective
Evaluate policy rules against a GitHub event context and compute a deterministic risk score.

## Package
`packages/core/src/evaluator.ts` and `packages/core/src/scoring.ts`

## Rule Evaluation

### Decision Priority (spec section 14)
`block > require_approval > allow`

If any matched rule blocks → final decision is `block`
If no block but any requires approval → `require_approval`
If explicit allow and no stricter rule → `allow`
If no rule matches → use defaults

### Default Behavior (conservative)
```yaml
defaults:
  unknown_agent: require_approval
  known_agent: require_approval
  docs_only: allow
  workflows: block
  secrets: block
```

### Rule Condition Matching
A rule matches when ALL specified conditions in `when` are satisfied:

- `agents`: agent name matches list
- `actors`: GitHub actor matches list
- `actions`: any inferred action is in list
- `files`: any changed file matches any glob pattern
- `files_not`: no changed file matches any glob pattern
- `labels`: PR/issue has any of these labels
- `pr_title`: PR title matches any pattern (substring or regex)
- `pr_body`: PR body matches any pattern
- `diff_lines_over`: diff line count exceeds threshold
- `commits_over`: commit count exceeds threshold
- `changes_package_files`: FilesClassification.changesDependencies
- `changes_workflows`: FilesClassification.changesWorkflows
- `changes_permissions`: FilesClassification.changesAuth
- `changes_auth`: FilesClassification.changesAuth
- `changes_infra`: FilesClassification.changesInfra
- `docs_only`: FilesClassification.docsOnly
- `tests_only`: FilesClassification.testsOnly

## Types

```ts
export type EvaluationInput = {
  policy: AgentOwnersPolicy;
  agentDetection: AgentDetectionResult;
  detectedActions: AgentAction[];
  changedFiles: string[];
  filesClassification: FilesClassification;
  diffLinesCount?: number;
  commitsCount?: number;
  actor: string;
  prTitle?: string;
  prBody?: string;
  labels?: string[];
};

export type MatchedRule = {
  rule: Rule;
  matchedConditions: string[];
};
```

## Functions

### `evaluatePolicy(input: EvaluationInput): Decision`
Main evaluation function. Returns full Decision object.

### `evaluateRule(rule: Rule, input: EvaluationInput): MatchedRule | null`
Evaluate a single rule. Return MatchedRule if it matches, null otherwise.

### `computeDecision(matchedRules: MatchedRule[], agentDetection: AgentDetectionResult, policy: AgentOwnersPolicy, filesClassification: FilesClassification): Decision['effect']`
Apply priority logic to compute final effect.

## Risk Scoring (spec section 14)

Additive scoring:
```
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
- 0-20: low
- 21-49: medium
- 50-79: high
- 80+: critical

### `computeRiskScore(input: RiskScoringInput): { score: number; level: RiskLevel }`

## Tests (`packages/core/tests/evaluator.test.ts`)
- Block rule takes precedence over allow
- Require_approval takes precedence over allow
- Unknown agent defaults to require_approval
- docs_only defaults to allow
- Workflow file change defaults to block
- Secrets default to block
- Rule with `files` condition matches correct paths
- Rule with `changes_workflows: true` matches workflow files
- Risk score: workflow change → high
- Risk score: secrets → critical
- Risk score: docs only → low
- No rules → default behavior applies
- Multiple matched rules → highest priority wins
