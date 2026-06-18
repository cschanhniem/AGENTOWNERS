# F2: YAML Loader and Policy File Resolution

## Objective
Implement YAML loading, policy file discovery, and schema validation.

## Package
`packages/core/src/loader.ts`

## Policy File Resolution Order
1. `.github/AGENTOWNERS.yml`
2. `AGENTOWNERS.yml`
3. `.agentowners.yml`

If multiple exist, use first found and emit a warning to stderr.

## Functions

### `findPolicyFile(cwd: string): Promise<string | null>`
Search `cwd` for policy files in resolution order. Return first found path or null.

### `loadPolicyFile(filePath: string): Promise<AgentOwnersPolicy>`
- Read file with `fs.readFile`
- Parse YAML with `js-yaml`
- Validate with Zod schema (`parsePolicy`)
- Throw `PolicyLoadError` with clear message on failure

### `loadPolicy(cwd: string): Promise<{ policy: AgentOwnersPolicy; filePath: string }>`
- Find policy file
- Load and validate
- Throw `PolicyNotFoundError` if no file found

### `PolicyLoadError`
Custom error class with `filePath` and `validationErrors` fields.

### `PolicyNotFoundError`
Custom error class with `searchedPaths` field.

## Edge Cases
- YAML parse error → throw with line/column info
- Zod validation error → format all errors into readable message
- File not found → throw PolicyNotFoundError
- Multiple policy files found → use first, warn to stderr

## Tests (`packages/core/tests/loader.test.ts`)
- Load valid policy from fixture file
- Throw on invalid YAML
- Throw on schema violation
- Discover correct file in resolution order
- Warn when multiple policy files exist
- Throw PolicyNotFoundError when no file found

## Fixtures
Create `packages/core/tests/fixtures/` with:
- `valid-minimal.yml` — minimal valid policy
- `valid-full.yml` — full policy with agents, rules, defaults
- `invalid-schema.yml` — wrong version/types
- `invalid-yaml.yml` — malformed YAML
