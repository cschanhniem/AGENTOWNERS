import { describe, it, expect } from 'vitest';
import { evaluatePolicy, evaluateRule } from '../src/evaluator.js';
import type { EvaluationInput } from '../src/evaluator.js';
import type { AgentOwnersPolicy, Rule } from '../src/types.js';
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

function baseInput(overrides: Partial<EvaluationInput> = {}): EvaluationInput {
  const policy: AgentOwnersPolicy = { version: 1 };
  return {
    policy,
    agentDetection: { confidence: 'confirmed', agentName: 'test-agent', signals: [] },
    detectedActions: ['open_pr'],
    changedFiles: [],
    filesClassification: makeClassification(),
    actor: 'test-bot[bot]',
    ...overrides,
  };
}

describe('evaluateRule', () => {
  it('returns null when files condition does not match', () => {
    const rule: Rule = {
      name: 'Block workflows',
      when: { files: ['.github/workflows/**'] },
      effect: 'block',
      reason: 'No workflow edits.',
    };
    const input = baseInput({ changedFiles: ['src/index.ts'] });
    expect(evaluateRule(rule, input)).toBeNull();
  });

  it('returns MatchedRule when files condition matches', () => {
    const rule: Rule = {
      name: 'Block workflows',
      when: { files: ['.github/workflows/**'] },
      effect: 'block',
      reason: 'No workflow edits.',
    };
    const input = baseInput({ changedFiles: ['.github/workflows/ci.yml'] });
    const result = evaluateRule(rule, input);
    expect(result).not.toBeNull();
    expect(result?.effect).toBe('block');
    expect(result?.matchedConditions?.some((c) => c.includes('.github/workflows/ci.yml'))).toBe(true);
  });

  it('returns MatchedRule when changes_workflows condition matches', () => {
    const rule: Rule = {
      name: 'Block workflow edits',
      when: { changes_workflows: true },
      effect: 'block',
      reason: 'No workflow edits.',
    };
    const input = baseInput({
      filesClassification: makeClassification({ changesWorkflows: true }),
    });
    const result = evaluateRule(rule, input);
    expect(result).not.toBeNull();
    expect(result?.effect).toBe('block');
  });

  it('returns null when changes_workflows is true but classification is false', () => {
    const rule: Rule = {
      name: 'Block workflow edits',
      when: { changes_workflows: true },
      effect: 'block',
      reason: 'No workflow edits.',
    };
    const input = baseInput({
      filesClassification: makeClassification({ changesWorkflows: false }),
    });
    expect(evaluateRule(rule, input)).toBeNull();
  });

  it('returns MatchedRule for docs_only condition', () => {
    const rule: Rule = {
      name: 'Allow docs',
      when: { docs_only: true },
      effect: 'allow',
      reason: 'Docs are low risk.',
    };
    const input = baseInput({
      filesClassification: makeClassification({ docsOnly: true }),
    });
    const result = evaluateRule(rule, input);
    expect(result).not.toBeNull();
    expect(result?.effect).toBe('allow');
  });

  it('matches diff_lines_over condition when diff exceeds threshold', () => {
    const rule: Rule = {
      name: 'Large diff',
      when: { diff_lines_over: 300 },
      effect: 'require_approval',
      reason: 'Large diff needs review.',
    };
    const match = evaluateRule(rule, baseInput({ diffLinesCount: 400 }));
    const noMatch = evaluateRule(rule, baseInput({ diffLinesCount: 300 }));
    expect(match).not.toBeNull();
    expect(noMatch).toBeNull();
  });

  it('matches actors condition', () => {
    const rule: Rule = {
      name: 'Restrict actor',
      when: { actors: ['github-copilot[bot]'] },
      effect: 'require_approval',
      reason: 'Copilot needs review.',
    };
    const match = evaluateRule(rule, baseInput({ actor: 'github-copilot[bot]' }));
    const noMatch = evaluateRule(rule, baseInput({ actor: 'renovate[bot]' }));
    expect(match).not.toBeNull();
    expect(noMatch).toBeNull();
  });

  it('matches agents condition by agentName', () => {
    const rule: Rule = {
      name: 'Unknown agent block',
      when: { agents: ['unknown'] },
      effect: 'block',
      reason: 'Unknown agents blocked.',
    };
    const match = evaluateRule(rule, baseInput({
      agentDetection: { confidence: 'unknown', agentName: 'unknown', signals: [] },
    }));
    const noMatch = evaluateRule(rule, baseInput({
      agentDetection: { confidence: 'confirmed', agentName: 'copilot', signals: [] },
    }));
    expect(match).not.toBeNull();
    expect(noMatch).toBeNull();
  });

  it('matches actions condition', () => {
    const rule: Rule = {
      name: 'Restrict edit_workflows action',
      when: { actions: ['edit_workflows'] },
      effect: 'block',
      reason: 'Workflows blocked.',
    };
    const match = evaluateRule(rule, baseInput({ detectedActions: ['open_pr', 'edit_workflows'] }));
    const noMatch = evaluateRule(rule, baseInput({ detectedActions: ['open_pr'] }));
    expect(match).not.toBeNull();
    expect(noMatch).toBeNull();
  });

  it('files_not condition blocks when a file matches the exclusion pattern', () => {
    const rule: Rule = {
      name: 'No secrets',
      when: { files_not: ['**/.env*'] },
      effect: 'allow',
      reason: 'Fine unless secrets.',
    };
    const noEnv = evaluateRule(rule, baseInput({ changedFiles: ['src/index.ts'] }));
    const withEnv = evaluateRule(rule, baseInput({ changedFiles: ['.env.local'] }));
    expect(noEnv).not.toBeNull();
    expect(withEnv).toBeNull();
  });
});

describe('evaluatePolicy', () => {
  it('block rule takes precedence over allow', () => {
    const policy: AgentOwnersPolicy = {
      version: 1,
      rules: [
        {
          name: 'Allow docs',
          when: { docs_only: true },
          effect: 'allow',
          reason: 'Docs are low risk.',
        },
        {
          name: 'Block workflows',
          when: { changes_workflows: true },
          effect: 'block',
          reason: 'No workflow edits.',
        },
      ],
    };
    const input = baseInput({
      policy,
      filesClassification: makeClassification({ docsOnly: true, changesWorkflows: true }),
    });
    const decision = evaluatePolicy(input);
    expect(decision.effect).toBe('block');
  });

  it('require_approval takes precedence over allow', () => {
    const policy: AgentOwnersPolicy = {
      version: 1,
      rules: [
        {
          name: 'Allow docs',
          when: { docs_only: true },
          effect: 'allow',
          reason: 'Docs are fine.',
        },
        {
          name: 'Require approval for large diffs',
          when: { diff_lines_over: 100 },
          effect: 'require_approval',
          reason: 'Large diff.',
        },
      ],
    };
    const input = baseInput({
      policy,
      filesClassification: makeClassification({ docsOnly: true }),
      diffLinesCount: 200,
    });
    const decision = evaluatePolicy(input);
    expect(decision.effect).toBe('require_approval');
  });

  it('unknown agent defaults to require_approval when no rules match', () => {
    const policy: AgentOwnersPolicy = { version: 1 };
    const input = baseInput({
      policy,
      agentDetection: { confidence: 'unknown', signals: [] },
      filesClassification: makeClassification(),
    });
    const decision = evaluatePolicy(input);
    expect(decision.effect).toBe('require_approval');
  });

  it('docs_only defaults to allow when no rules match', () => {
    const policy: AgentOwnersPolicy = { version: 1 };
    const input = baseInput({
      policy,
      agentDetection: { confidence: 'confirmed', agentName: 'copilot', signals: [] },
      filesClassification: makeClassification({ docsOnly: true }),
    });
    const decision = evaluatePolicy(input);
    expect(decision.effect).toBe('allow');
  });

  it('workflow file change defaults to block when no rules match', () => {
    const policy: AgentOwnersPolicy = { version: 1 };
    const input = baseInput({
      policy,
      agentDetection: { confidence: 'confirmed', agentName: 'copilot', signals: [] },
      filesClassification: makeClassification({ changesWorkflows: true }),
    });
    const decision = evaluatePolicy(input);
    expect(decision.effect).toBe('block');
  });

  it('secrets default to block when no rules match', () => {
    const policy: AgentOwnersPolicy = { version: 1 };
    const input = baseInput({
      policy,
      agentDetection: { confidence: 'confirmed', agentName: 'copilot', signals: [] },
      filesClassification: makeClassification({ secretFilesDetected: true }),
    });
    const decision = evaluatePolicy(input);
    expect(decision.effect).toBe('block');
  });

  it('no rules and known agent defaults to require_approval', () => {
    const policy: AgentOwnersPolicy = { version: 1 };
    const input = baseInput({
      policy,
      agentDetection: { confidence: 'confirmed', agentName: 'copilot', signals: [] },
      filesClassification: makeClassification(),
    });
    const decision = evaluatePolicy(input);
    expect(decision.effect).toBe('require_approval');
  });

  it('collects requiredReviewers from matched require_approval rules', () => {
    const policy: AgentOwnersPolicy = {
      version: 1,
      rules: [
        {
          name: 'Auth changes need review',
          when: { changes_auth: true },
          effect: 'require_approval',
          reviewers: ['@security-team'],
          reason: 'Auth requires review.',
        },
      ],
    };
    const input = baseInput({
      policy,
      filesClassification: makeClassification({ changesAuth: true }),
    });
    const decision = evaluatePolicy(input);
    expect(decision.effect).toBe('require_approval');
    expect(decision.requiredReviewers).toContain('@security-team');
  });

  it('includes ai-agent and risk-<level> in labelsToApply', () => {
    const policy: AgentOwnersPolicy = { version: 1 };
    const input = baseInput({
      policy,
      filesClassification: makeClassification({ docsOnly: true }),
    });
    const decision = evaluatePolicy(input);
    expect(decision.labelsToApply).toContain('ai-agent');
    expect(decision.labelsToApply.some((l) => l.startsWith('risk-'))).toBe(true);
  });

  it('multiple matched rules → highest priority effect wins (block)', () => {
    const policy: AgentOwnersPolicy = {
      version: 1,
      rules: [
        {
          name: 'Allow small diffs',
          when: { diff_lines_over: 0 },
          effect: 'allow',
          reason: 'Small diff ok.',
        },
        {
          name: 'Require approval for deps',
          when: { changes_package_files: true },
          effect: 'require_approval',
          reason: 'Deps need review.',
        },
        {
          name: 'Block workflows',
          when: { changes_workflows: true },
          effect: 'block',
          reason: 'No workflow edits.',
        },
      ],
    };
    const input = baseInput({
      policy,
      filesClassification: makeClassification({ changesDependencies: true, changesWorkflows: true }),
      diffLinesCount: 10,
    });
    const decision = evaluatePolicy(input);
    expect(decision.effect).toBe('block');
    expect(decision.matchedRules.length).toBeGreaterThanOrEqual(2);
  });

  it('risk score: workflow change → critical (due to blocked_action)', () => {
    const policy: AgentOwnersPolicy = { version: 1 };
    const input = baseInput({
      policy,
      filesClassification: makeClassification({ changesWorkflows: true }),
      detectedActions: ['open_pr', 'edit_workflows'],
      diffLinesCount: 10,
    });
    const decision = evaluatePolicy(input);
    expect(decision.riskLevel).toBe('critical');
  });

  it('risk score: secrets → critical', () => {
    const policy: AgentOwnersPolicy = { version: 1 };
    const input = baseInput({
      policy,
      filesClassification: makeClassification({ secretFilesDetected: true }),
      detectedActions: ['open_pr', 'touch_secrets'],
      diffLinesCount: 5,
    });
    const decision = evaluatePolicy(input);
    expect(decision.riskScore).toBeGreaterThanOrEqual(80);
    expect(decision.riskLevel).toBe('critical');
  });

  it('risk score: docs only → low', () => {
    const policy: AgentOwnersPolicy = { version: 1 };
    const input = baseInput({
      policy,
      agentDetection: { confidence: 'confirmed', agentName: 'copilot', signals: [] },
      filesClassification: makeClassification({ docsOnly: true }),
      detectedActions: ['open_pr', 'modify_docs'],
      diffLinesCount: 10,
    });
    const decision = evaluatePolicy(input);
    expect(decision.riskLevel).toBe('low');
  });

  it('rule with files condition matches correct paths', () => {
    const policy: AgentOwnersPolicy = {
      version: 1,
      rules: [
        {
          name: 'Block auth paths',
          when: { files: ['**/auth/**', '**/security/**'] },
          effect: 'require_approval',
          reviewers: ['@security'],
          reason: 'Sensitive paths.',
        },
      ],
    };
    const matchInput = baseInput({
      policy,
      changedFiles: ['src/auth/session.ts'],
    });
    const noMatchInput = baseInput({
      policy,
      changedFiles: ['src/utils/format.ts'],
    });
    const matchDecision = evaluatePolicy(matchInput);
    const noMatchDecision = evaluatePolicy(noMatchInput);
    expect(matchDecision.effect).toBe('require_approval');
    expect(matchDecision.matchedRules.length).toBe(1);
    expect(noMatchDecision.matchedRules.length).toBe(0);
  });

  it('custom defaults override built-in defaults', () => {
    const policy: AgentOwnersPolicy = {
      version: 1,
      defaults: {
        docs_only: 'require_approval',
        unknown_agent: 'block',
      },
    };
    const docsInput = baseInput({
      policy,
      agentDetection: { confidence: 'confirmed', agentName: 'copilot', signals: [] },
      filesClassification: makeClassification({ docsOnly: true }),
    });
    expect(evaluatePolicy(docsInput).effect).toBe('require_approval');

    const unknownInput = baseInput({
      policy,
      agentDetection: { confidence: 'unknown', signals: [] },
      filesClassification: makeClassification(),
    });
    expect(evaluatePolicy(unknownInput).effect).toBe('block');
  });

  it('decision includes explanation string', () => {
    const policy: AgentOwnersPolicy = { version: 1 };
    const input = baseInput({ policy });
    const decision = evaluatePolicy(input);
    expect(typeof decision.explanation).toBe('string');
    expect(decision.explanation.length).toBeGreaterThan(0);
  });

  it('matchedAgent is set from agentDetection.agentName', () => {
    const policy: AgentOwnersPolicy = { version: 1 };
    const input = baseInput({
      policy,
      agentDetection: { confidence: 'confirmed', agentName: 'github-copilot', signals: [] },
    });
    const decision = evaluatePolicy(input);
    expect(decision.matchedAgent).toBe('github-copilot');
  });
});
