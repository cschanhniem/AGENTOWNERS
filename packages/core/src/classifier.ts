import { minimatch } from 'minimatch';

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

const DOCS_PATTERNS = ['*.md', 'docs/**', '*.rst', '*.adoc'];

const TESTS_PATTERNS = ['**/*.test.*', '**/*.spec.*', 'tests/**', '__tests__/**'];

const DEPENDENCY_PATTERNS = [
  'package.json', 'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lockb',
  'requirements.txt', 'uv.lock', 'poetry.lock', 'Pipfile', 'Pipfile.lock',
  'Cargo.toml', 'Cargo.lock', 'go.mod', 'go.sum', 'pom.xml', 'build.gradle',
  'composer.json', 'composer.lock', 'Gemfile', 'Gemfile.lock',
];

const WORKFLOW_PATTERNS = ['.github/workflows/**', '.github/actions/**'];

const INFRA_PATTERNS = [
  'infra/**', 'terraform/**', 'k8s/**', 'helm/**', 'deploy/**',
  'Dockerfile', 'docker-compose.yml', '*.tf', '*.tfvars',
];

const AUTH_PATTERNS = [
  '**/auth/**', '**/security/**', '**/permissions/**', '**/roles/**',
  '**/policy/**', '**/rbac/**',
];

const SECRET_FILE_PATTERNS = [
  '.env', '.env.*', '*.pem', '*.key', 'id_rsa', 'id_ed25519', 'secrets.*',
];

const SECRET_DIFF_PATTERNS = [
  'AWS_SECRET_ACCESS_KEY',
  'AWS_ACCESS_KEY_ID',
  'GITHUB_TOKEN',
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'PRIVATE_KEY',
  'SECRET_KEY',
  'PASSWORD=',
  'TOKEN=',
];

export function matchGlob(pattern: string, filePath: string): boolean {
  return minimatch(filePath, pattern, { dot: true });
}

export function matchGlobs(patterns: string[], filePath: string): boolean {
  return patterns.some((p) => matchGlob(p, filePath));
}

export function classifyFile(filePath: string): FileClassification {
  return {
    isDocs: matchGlobs(DOCS_PATTERNS, filePath),
    isTests: matchGlobs(TESTS_PATTERNS, filePath),
    isDependency: matchGlobs(DEPENDENCY_PATTERNS, filePath),
    isWorkflow: matchGlobs(WORKFLOW_PATTERNS, filePath),
    isInfra: matchGlobs(INFRA_PATTERNS, filePath),
    isAuth: matchGlobs(AUTH_PATTERNS, filePath),
    isSecret: matchGlobs(SECRET_FILE_PATTERNS, filePath),
  };
}

export function classifyFiles(filePaths: string[]): FilesClassification {
  const files: Record<string, FileClassification> = {};
  for (const fp of filePaths) {
    files[fp] = classifyFile(fp);
  }

  const classifications = Object.values(files);
  const count = classifications.length;

  return {
    docsOnly: count > 0 && classifications.every((c) => c.isDocs),
    testsOnly: count > 0 && classifications.every((c) => c.isTests),
    changesWorkflows: classifications.some((c) => c.isWorkflow),
    changesDependencies: classifications.some((c) => c.isDependency),
    changesAuth: classifications.some((c) => c.isAuth),
    changesInfra: classifications.some((c) => c.isInfra),
    secretFilesDetected: classifications.some((c) => c.isSecret),
    files,
  };
}

export function detectSecretPatterns(diffContent: string): string[] {
  const matched: string[] = [];
  for (const pattern of SECRET_DIFF_PATTERNS) {
    const regex = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    if (regex.test(diffContent)) {
      matched.push(pattern);
    }
  }
  return matched;
}
