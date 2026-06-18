# F1: Policy Schema and Core Types

## Objective
Implement the TypeScript types and Zod schema for the AGENTOWNERS policy format.

## Package
`packages/core/src/schema.ts` and `packages/core/src/types.ts`

## Types to implement

### AgentOwnersPolicy (root)
```ts
{
  version: 1;
  agents?: Record<string, AgentPolicy>;
  defaults?: DefaultPolicy;
  rules?: Rule[];
  audit?: AuditConfig;
}
```

### AgentPolicy
```ts
{
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
}
```

### AgentAction (union type)
All 18 actions: open_pr, update_pr, comment, review_comment, approve_pr, request_changes, label_issue, close_issue, reopen_issue, assign_issue, edit_workflows, modify_tests, modify_docs, modify_dependencies, modify_auth, modify_infra, touch_secrets, change_permissions, merge_pr

### Rule
```ts
{
  name: string;
  when: RuleCondition;
  effect: "allow" | "require_approval" | "block";
  reviewers?: string[];
  labels?: string[];
  reason: string;
}
```

### RuleCondition
All fields from spec section 11.5.

### Decision
```ts
{
  effect: "allow" | "require_approval" | "block";
  matchedRules: MatchedRule[];
  matchedAgent?: string;
  detectedActions: AgentAction[];
  riskScore: number;
  riskLevel: "low" | "medium" | "high" | "critical";
  requiredReviewers: string[];
  labelsToApply: string[];
  explanation: string;
}
```

### DefaultPolicy
```ts
{
  unknown_agent?: "allow" | "require_approval" | "block";
  known_agent?: "allow" | "require_approval" | "block";
  docs_only?: "allow" | "require_approval" | "block";
  workflows?: "allow" | "require_approval" | "block";
  secrets?: "allow" | "require_approval" | "block";
}
```

### AuditConfig
```ts
{
  enabled?: boolean;
  output?: string;
}
```

### AgentDetectionResult
```ts
{
  agentName?: string;
  confidence: AgentDetectionConfidence; // "confirmed" | "likely" | "possible" | "unknown"
  signals: string[];
}
```

## Zod Schema
- Implement full Zod schema matching TypeScript types
- Export `agentOwnersPolicySchema` as the root validator
- Use `z.union`, `z.object`, `z.array`, `z.record`, `z.literal`, `z.enum`
- Version must be exactly `1`
- All optional fields use `.optional()`
- AgentAction enum: `z.enum([...])`

## Tests
- Valid minimal policy parses without error
- Valid full policy parses without error
- Unknown version throws ZodError
- Invalid effect throws ZodError
- Extra unknown fields are stripped (use `.strict()` or `.passthrough()` — choose passthrough for forward compat)
- Missing required fields throw ZodError

## Files
- `packages/core/src/types.ts` — TypeScript types (no runtime code)
- `packages/core/src/schema.ts` — Zod schema + `parsePolicy(yaml: unknown): AgentOwnersPolicy`
- `packages/core/src/index.ts` — barrel export
- `packages/core/tests/schema.test.ts` — vitest unit tests
