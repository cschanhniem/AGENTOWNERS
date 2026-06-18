# F4: Agent Detection

## Objective
Detect whether a PR, issue, comment, or commit likely came from an AI agent.

## Package
`packages/core/src/detection.ts`

## Detection Confidence Levels
`"confirmed" | "likely" | "possible" | "unknown"`

## Detection Signals (in priority order)

### 1. Explicit policy match (confirmed)
Actor matches a configured `agents[name].match.actors` entry.

### 2. Known bot actor (confirmed)
Actor is one of: `github-copilot[bot]`, `copilot-swe-agent[bot]`, `dependabot[bot]`, `renovate[bot]`

### 3. Commit message signatures (likely)
Commit messages or PR body contains:
- `Co-Authored-By: Claude`
- `Co-Authored-By: Codex`
- `Generated with`
- `🤖`
- `AI-generated`
- `Claude Code`
- `OpenAI Codex`
- `Cursor`

### 4. PR body agent markers (likely)
PR body contains known agent-specific footers or summaries:
- `🤖 Generated with`
- `<!-- agentowners` (our own marker)
- `Co-authored-by:.*\[bot\]`

### 5. Labels (possible)
PR/issue has labels: `ai-generated`, `agent`, `copilot`, `codex`, `claude`

### 6. Configured body patterns (from policy)
Body matches `agents[name].match.bodyPatterns` or `prTitlePatterns`.

## Types

```ts
export type AgentDetectionInput = {
  actor: string;
  commitMessages?: string[];
  prTitle?: string;
  prBody?: string;
  labels?: string[];
  policy?: AgentOwnersPolicy;
};

export type AgentDetectionResult = {
  agentName?: string;
  confidence: AgentDetectionConfidence;
  signals: string[];
};
```

## Functions

### `detectAgent(input: AgentDetectionInput): AgentDetectionResult`
Run all detection signals in priority order. Return first confident match or best guess.

### `isKnownBotActor(actor: string): boolean`
Check against hardcoded known bot list.

### `matchesAgentPolicy(actor: string, policy: AgentOwnersPolicy): string | null`
Return matched agent name from policy configuration or null.

## Tests (`packages/core/tests/detection.test.ts`)
- Configured actor → `confirmed`
- `github-copilot[bot]` → `confirmed`
- Commit with `Co-Authored-By: Claude` → `likely`
- PR body with `🤖 Generated with` → `likely`
- Label `ai-generated` → `possible`
- Unknown actor, no signals → `unknown`
- Policy match takes priority over built-in signals
- Multiple signals reported in `signals` array
