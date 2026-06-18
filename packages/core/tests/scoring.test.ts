import { describe, it, expect } from 'vitest';
import { computeRiskScore } from '../src/scoring.js';
import type { FilesClassification } from '../src/classifier.js';

function makeClassification(overrides: Partial<FilesClassification> = {}): FilesClassification {
  return {
    docsOnly: false,
    testsOnly: false,
    changesWorkflows: false,
    changesDependencies: false,
    changesAuth: false,
    changesInfra: false,
    secretFilesDetected: false,
    files: {},
    ...overrides,
  };
}

describe('computeRiskScore', () => {
  it('docs-only contribution → low risk', () => {
    const { score, level } = computeRiskScore({
      filesClassification: makeClassification({ docsOnly: true }),
      diffLinesCount: 20,
      detectedActions: ['open_pr', 'modify_docs'],
      agentConfidence: 'confirmed',
    });
    expect(level).toBe('low');
    // docs_only(5) + small_diff(5) = 10
    expect(score).toBe(10);
  });

  it('tests-only contribution → low risk with small diff', () => {
    const { score, level } = computeRiskScore({
      filesClassification: makeClassification({ testsOnly: true }),
      diffLinesCount: 30,
      detectedActions: ['open_pr', 'modify_tests'],
      agentConfidence: 'confirmed',
    });
    // tests_only(10) + small_diff(5) = 15
    expect(score).toBe(15);
    expect(level).toBe('low');
  });

  it('workflow change → high risk (at minimum)', () => {
    const { score, level } = computeRiskScore({
      filesClassification: makeClassification({ changesWorkflows: true }),
      diffLinesCount: 10,
      detectedActions: ['open_pr', 'edit_workflows'],
      agentConfidence: 'confirmed',
    });
    // workflow(50) + small_diff(5) + blocked_action(100) = 155
    expect(score).toBeGreaterThanOrEqual(50);
    expect(level).toBe('critical');
  });

  it('secrets detected → critical risk', () => {
    const { score, level } = computeRiskScore({
      filesClassification: makeClassification({ secretFilesDetected: true }),
      diffLinesCount: 5,
      detectedActions: ['open_pr', 'touch_secrets'],
      agentConfidence: 'confirmed',
    });
    // secrets(80) + small_diff(5) + blocked_action(100) = 185
    expect(score).toBeGreaterThanOrEqual(80);
    expect(level).toBe('critical');
  });

  it('unknown agent confidence adds 20 points', () => {
    const confirmed = computeRiskScore({
      filesClassification: makeClassification(),
      diffLinesCount: 10,
      detectedActions: ['open_pr'],
      agentConfidence: 'confirmed',
    });
    const unknown = computeRiskScore({
      filesClassification: makeClassification(),
      diffLinesCount: 10,
      detectedActions: ['open_pr'],
      agentConfidence: 'unknown',
    });
    expect(unknown.score - confirmed.score).toBe(20);
  });

  it('diff 50-300 lines adds 15 points', () => {
    const { score } = computeRiskScore({
      filesClassification: makeClassification(),
      diffLinesCount: 150,
      detectedActions: ['open_pr'],
      agentConfidence: 'confirmed',
    });
    // diff 50-300(15) = 15
    expect(score).toBe(15);
  });

  it('diff over 300 lines adds 30 points', () => {
    const { score } = computeRiskScore({
      filesClassification: makeClassification(),
      diffLinesCount: 500,
      detectedActions: ['open_pr'],
      agentConfidence: 'confirmed',
    });
    // diff >300(30) = 30
    expect(score).toBe(30);
  });

  it('dependency changed adds 30 points', () => {
    const { score } = computeRiskScore({
      filesClassification: makeClassification({ changesDependencies: true }),
      diffLinesCount: 10,
      detectedActions: ['open_pr', 'modify_dependencies'],
      agentConfidence: 'confirmed',
    });
    // deps(30) + small_diff(5) = 35
    expect(score).toBe(35);
    expect(computeRiskScore({
      filesClassification: makeClassification({ changesDependencies: true }),
      diffLinesCount: 10,
      detectedActions: ['open_pr', 'modify_dependencies'],
      agentConfidence: 'confirmed',
    }).level).toBe('medium');
  });

  it('auth path changed adds 50 points', () => {
    const { score } = computeRiskScore({
      filesClassification: makeClassification({ changesAuth: true }),
      diffLinesCount: 10,
      detectedActions: ['open_pr', 'modify_auth'],
      agentConfidence: 'confirmed',
    });
    // auth(50) + small_diff(5) = 55
    expect(score).toBe(55);
  });

  it('infra path changed adds 40 points', () => {
    const { score } = computeRiskScore({
      filesClassification: makeClassification({ changesInfra: true }),
      diffLinesCount: 10,
      detectedActions: ['open_pr', 'modify_infra'],
      agentConfidence: 'confirmed',
    });
    // infra(40) + small_diff(5) = 45
    expect(score).toBe(45);
  });

  it('permissions changed action adds 60 points', () => {
    const { score } = computeRiskScore({
      filesClassification: makeClassification(),
      diffLinesCount: 10,
      detectedActions: ['open_pr', 'change_permissions'],
      agentConfidence: 'confirmed',
    });
    // permissions(60) + small_diff(5) + blocked_action(100) = 165
    expect(score).toBeGreaterThanOrEqual(60);
  });

  it('no diff lines count — diff score not applied', () => {
    const { score } = computeRiskScore({
      filesClassification: makeClassification(),
      detectedActions: ['open_pr'],
      agentConfidence: 'confirmed',
    });
    expect(score).toBe(0);
  });

  it('risk levels: 0-20 low, 21-49 medium, 50-79 high, 80+ critical', () => {
    const low = computeRiskScore({
      filesClassification: makeClassification({ docsOnly: true }),
      diffLinesCount: 5,
      detectedActions: ['open_pr'],
      agentConfidence: 'confirmed',
    });
    expect(low.level).toBe('low');

    const medium = computeRiskScore({
      filesClassification: makeClassification({ changesDependencies: true }),
      diffLinesCount: 5,
      detectedActions: ['open_pr'],
      agentConfidence: 'confirmed',
    });
    // deps(30) + small(5) = 35 → medium
    expect(medium.level).toBe('medium');

    const high = computeRiskScore({
      filesClassification: makeClassification({ changesAuth: true }),
      diffLinesCount: 5,
      detectedActions: ['open_pr'],
      agentConfidence: 'confirmed',
    });
    // auth(50) + small(5) = 55 → high
    expect(high.level).toBe('high');

    const critical = computeRiskScore({
      filesClassification: makeClassification({ secretFilesDetected: true }),
      diffLinesCount: 5,
      detectedActions: ['open_pr'],
      agentConfidence: 'confirmed',
    });
    expect(critical.level).toBe('critical');
  });
});
