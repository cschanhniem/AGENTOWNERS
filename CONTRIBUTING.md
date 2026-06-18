# Contributing to AGENTOWNERS

## For AI agents

Read [AGENTS.md](AGENTS.md) first. It has everything you need: repo map, invariants, commands, and common mistakes.

## For humans

### Setup

```bash
git clone https://github.com/agentowners/agentowners
cd agentowners
pnpm install
pnpm build
pnpm test
```

Node.js 22+ and pnpm 9+ required.

### Development workflow

1. **Find or create an issue** — all work starts with an issue
2. **Fork and branch** — `feat/my-feature` or `fix/the-bug`
3. **Write tests first** (TDD) — failing test, then implementation
4. **Run `pnpm test`** — all 200+ tests must pass
5. **Run `pnpm typecheck`** — zero TypeScript errors
6. **Open a PR** — title follows conventional commits format

### Commit format

```
feat(core): add SARIF output format to renderer
fix(cli): handle missing policy file gracefully
test(core): add coverage for secrets detection edge cases
docs: update policy reference for diff_lines_over condition
```

Types: `feat` `fix` `refactor` `test` `docs` `chore` `perf` `ci`  
Scopes: `core` `cli` `github-action` `examples` `docs`

### Adding a new policy profile

1. Add YAML string to `packages/core/src/profiles.ts`
2. Add example to `examples/<name>/AGENTOWNERS.yml`
3. Add `--profile <name>` to `packages/cli/src/commands/init.ts`
4. Add test to `packages/core/tests/profiles.test.ts`

### Adding a new AgentAction

1. Add to union in `packages/core/src/types.ts`
2. Add to Zod enum in `packages/core/src/schema.ts`
3. Add detection logic in `packages/core/src/actions.ts`
4. Update tests in `packages/core/tests/actions.test.ts`
5. Update `docs/specs/readme.md` section 11.3

### Code style

- Functions: < 50 lines
- Files: < 800 lines
- No `any` — use `unknown` and narrow safely
- No mutation — return new objects
- Import paths end in `.js` (NodeNext)
- No `console.log` in library code

### Security

If you find a security vulnerability, open a GitHub issue with title `[SECURITY] ...` before disclosing publicly.

See [SECURITY.md](SECURITY.md) for full policy.

### PR checklist

- [ ] Tests pass (`pnpm test`)
- [ ] TypeScript compiles (`pnpm typecheck`)
- [ ] New functionality has tests
- [ ] Decision priority invariant preserved (`block > require_approval > allow`)
- [ ] No secrets or tokens committed
- [ ] No shell execution from policy content
