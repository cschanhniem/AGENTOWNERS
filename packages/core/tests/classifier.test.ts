import { describe, it, expect } from 'vitest';
import {
  classifyFile,
  classifyFiles,
  detectSecretPatterns,
  matchGlob,
} from '../src/classifier';

describe('classifyFile', () => {
  it('classifies README.md as docs', () => {
    const r = classifyFile('README.md');
    expect(r.isDocs).toBe(true);
    expect(r.isTests).toBe(false);
    expect(r.isDependency).toBe(false);
    expect(r.isWorkflow).toBe(false);
    expect(r.isInfra).toBe(false);
    expect(r.isAuth).toBe(false);
    expect(r.isSecret).toBe(false);
  });

  it('classifies src/auth/login.ts as auth', () => {
    const r = classifyFile('src/auth/login.ts');
    expect(r.isAuth).toBe(true);
  });

  it('classifies .github/workflows/ci.yml as workflow', () => {
    const r = classifyFile('.github/workflows/ci.yml');
    expect(r.isWorkflow).toBe(true);
  });

  it('classifies package.json as dependency', () => {
    const r = classifyFile('package.json');
    expect(r.isDependency).toBe(true);
  });

  it('classifies Dockerfile as infra', () => {
    const r = classifyFile('Dockerfile');
    expect(r.isInfra).toBe(true);
  });

  it('classifies tests/foo.test.ts as tests', () => {
    const r = classifyFile('tests/foo.test.ts');
    expect(r.isTests).toBe(true);
  });

  it('classifies src/main.ts with no special classification', () => {
    const r = classifyFile('src/main.ts');
    expect(r.isDocs).toBe(false);
    expect(r.isTests).toBe(false);
    expect(r.isDependency).toBe(false);
    expect(r.isWorkflow).toBe(false);
    expect(r.isInfra).toBe(false);
    expect(r.isAuth).toBe(false);
    expect(r.isSecret).toBe(false);
  });

  it('classifies .env as secret', () => {
    const r = classifyFile('.env');
    expect(r.isSecret).toBe(true);
  });
});

describe('classifyFiles', () => {
  it('docsOnly is true when all files are docs', () => {
    const result = classifyFiles(['README.md', 'docs/guide.md']);
    expect(result.docsOnly).toBe(true);
  });

  it('docsOnly is false for mixed files', () => {
    const result = classifyFiles(['README.md', 'src/main.ts']);
    expect(result.docsOnly).toBe(false);
  });

  it('docsOnly is false for empty list', () => {
    const result = classifyFiles([]);
    expect(result.docsOnly).toBe(false);
  });

  it('testsOnly is false for empty list', () => {
    const result = classifyFiles([]);
    expect(result.testsOnly).toBe(false);
  });

  it('secretFilesDetected is true for .env', () => {
    const result = classifyFiles(['.env', 'src/main.ts']);
    expect(result.secretFilesDetected).toBe(true);
  });

  it('secretFilesDetected is false when no secret files', () => {
    const result = classifyFiles(['src/main.ts', 'README.md']);
    expect(result.secretFilesDetected).toBe(false);
  });
});

describe('detectSecretPatterns', () => {
  it('detects GITHUB_TOKEN in diff content', () => {
    const diff = 'GITHUB_TOKEN=ghp_abc123xyz';
    const matches = detectSecretPatterns(diff);
    expect(matches).toContain('GITHUB_TOKEN');
  });

  it('returns pattern names not values', () => {
    const diff = 'AWS_SECRET_ACCESS_KEY=AKIASECRETVALUE';
    const matches = detectSecretPatterns(diff);
    expect(matches).toContain('AWS_SECRET_ACCESS_KEY');
    expect(matches.join('')).not.toContain('AKIASECRETVALUE');
  });

  it('returns empty array when no secrets found', () => {
    const diff = 'const x = 1; function foo() {}';
    const matches = detectSecretPatterns(diff);
    expect(matches).toHaveLength(0);
  });
});

describe('matchGlob', () => {
  it('matches ** patterns correctly', () => {
    expect(matchGlob('**/*.test.*', 'src/utils/foo.test.ts')).toBe(true);
    expect(matchGlob('**/*.test.*', 'src/utils/foo.ts')).toBe(false);
  });

  it('handles dot files with dot: true option', () => {
    expect(matchGlob('.env.*', '.env.local')).toBe(true);
    expect(matchGlob('.github/workflows/**', '.github/workflows/ci.yml')).toBe(true);
  });
});
