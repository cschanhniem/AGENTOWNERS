# F3: File Classifier and Glob Matching

## Objective
Deterministic classification of changed files into categories used for action inference.

## Package
`packages/core/src/classifier.ts`

## File Categories (from spec section 19)

### Docs patterns
`*.md`, `docs/**`, `*.rst`, `*.adoc`

### Tests patterns
`**/*.test.*`, `**/*.spec.*`, `tests/**`, `__tests__/**`

### Dependencies patterns
`package.json`, `package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`, `bun.lockb`,
`requirements.txt`, `uv.lock`, `poetry.lock`, `Pipfile`, `Pipfile.lock`,
`Cargo.toml`, `Cargo.lock`, `go.mod`, `go.sum`, `pom.xml`, `build.gradle`,
`composer.json`, `composer.lock`, `Gemfile`, `Gemfile.lock`

### Workflows patterns
`.github/workflows/**`, `.github/actions/**`

### Infra patterns
`infra/**`, `terraform/**`, `k8s/**`, `helm/**`, `deploy/**`,
`Dockerfile`, `docker-compose.yml`, `*.tf`, `*.tfvars`

### Auth/security patterns
`**/auth/**`, `**/security/**`, `**/permissions/**`, `**/roles/**`,
`**/policy/**`, `**/rbac/**`

### Secrets file names
`.env`, `.env.*`, `*.pem`, `*.key`, `id_rsa`, `id_ed25519`, `secrets.*`

### Secrets diff patterns (strings to detect in diff content)
`AWS_SECRET_ACCESS_KEY`, `AWS_ACCESS_KEY_ID`, `GITHUB_TOKEN`,
`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `PRIVATE_KEY`, `SECRET_KEY`,
`PASSWORD=`, `TOKEN=`

## Types

```ts
export type FileClassification = {
  isDocs: boolean;
  isTests: boolean;
  isDependency: boolean;
  isWorkflow: boolean;
  isInfra: boolean;
  isAuth: boolean;
  isSecret: boolean;
};

export type FilesClassification = {
  docsOnly: boolean;
  testsOnly: boolean;
  changesWorkflows: boolean;
  changesDependencies: boolean;
  changesAuth: boolean;
  changesInfra: boolean;
  secretFilesDetected: boolean;
  files: Record<string, FileClassification>;
};
```

## Functions

### `classifyFile(filePath: string): FileClassification`
Classify a single file path against all category patterns using `minimatch`.

### `classifyFiles(filePaths: string[]): FilesClassification`
Classify a list of changed files. Compute aggregate properties:
- `docsOnly`: all files match docs patterns
- `testsOnly`: all files match test patterns
- etc.

### `detectSecretPatterns(diffContent: string): string[]`
Scan diff content for secret-like patterns. Return list of matched pattern names (NOT the values). Never include the actual secret value in output — redact with `[REDACTED]`.

### `matchGlob(pattern: string, filePath: string): boolean`
Wrapper around `minimatch` with consistent options (`{ dot: true, matchBase: false }`).

### `matchGlobs(patterns: string[], filePath: string): boolean`
Returns true if any pattern matches.

## Tests (`packages/core/tests/classifier.test.ts`)
- `.md` file classified as docs
- `src/auth/session.ts` classified as auth
- `.github/workflows/test.yml` classified as workflow
- `package.json` classified as dependency
- `Dockerfile` classified as infra
- `tests/foo.test.ts` classified as test
- `src/main.ts` — no special classification
- `docsOnly: true` when all files are docs
- `docsOnly: false` when mixed
- Secret pattern detection in diff content
- Secret file detection for `.env`
- `matchGlob` handles `**` patterns correctly
