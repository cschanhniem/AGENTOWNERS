import { describe, it, expect } from 'vitest';
import {
  renderVerdict,
  renderAllowed,
  renderRequiresApproval,
  renderBlocked,
  renderAuditJson,
} from '../src/renderer.js';
import type { Decision } from '../src/types.js';

const allowDecision: Decision = {
  effect: 'allow',
  matchedRules: [{ name: 'Allow docs-only agent PRs', effect: 'allow', reason: 'Docs-only changes are low risk.' }],
  detectedActions: ['open_pr', 'modify_docs'],
  riskScore: 5,
  riskLevel: 'low',
  requiredReviewers: [],
  labelsToApply: [],
  explanation: 'This appears to be a low-risk docs-only AI contribution.',
};

const approvalDecision: Decision = {
  effect: 'require_approval',
  matchedRules: [
    {
      name: 'Require approval for auth changes',
      effect: 'require_approval',
      reason: 'Auth and permission changes require human review.',
      matchedFiles: ['src/auth/session.ts'],
    },
  ],
  matchedAgent: 'github-copilot',
  detectedActions: ['open_pr', 'modify_auth'],
  riskScore: 65,
  riskLevel: 'high',
  requiredReviewers: ['@maintainers/security'],
  labelsToApply: ['ai-agent', 'needs-human-review', 'risk-high'],
  explanation: 'This PR should not be merged until a human maintainer reviews the auth-related changes.',
};

const blockDecision: Decision = {
  effect: 'block',
  matchedRules: [
    {
      name: 'Block workflow edits by agents',
      effect: 'block',
      reason: 'AI agents may not modify CI/CD workflows without maintainer approval.',
    },
  ],
  detectedActions: ['open_pr', 'edit_workflows'],
  riskScore: 95,
  riskLevel: 'critical',
  requiredReviewers: [],
  labelsToApply: [],
  explanation: 'This agent action is blocked by repository policy.',
};

describe('renderVerdict', () => {
  it('allow decision renders "allowed" heading', () => {
    const result = renderVerdict(allowDecision);
    expect(result).toContain('## AGENTOWNERS verdict: allowed');
  });

  it('block decision renders "blocked" heading', () => {
    const result = renderVerdict(blockDecision);
    expect(result).toContain('## AGENTOWNERS verdict: blocked');
  });

  it('require_approval renders risk score', () => {
    const result = renderVerdict(approvalDecision);
    expect(result).toContain('65/100');
    expect(result).toContain('high');
  });

  it('require_approval renders "requires approval" heading', () => {
    const result = renderVerdict(approvalDecision);
    expect(result).toContain('## AGENTOWNERS verdict: requires approval');
  });

  it('matched rules listed with reasons', () => {
    const result = renderVerdict(approvalDecision);
    expect(result).toContain('Require approval for auth changes');
    expect(result).toContain('Auth and permission changes require human review.');
  });

  it('required reviewers listed', () => {
    const result = renderVerdict(approvalDecision);
    expect(result).toContain('@maintainers/security');
  });

  it('sticky comment marker included by default', () => {
    const result = renderVerdict(allowDecision);
    expect(result).toContain('<!-- agentowners-verdict -->');
    expect(result).toContain('<!-- /agentowners-verdict -->');
  });

  it('marker not included when includeMarker is false', () => {
    const result = renderVerdict(allowDecision, { includeMarker: false });
    expect(result).not.toContain('<!-- agentowners-verdict -->');
  });

  it('compact: true produces shorter output', () => {
    const full = renderVerdict(approvalDecision);
    const compact = renderVerdict(approvalDecision, { compact: true });
    expect(compact.length).toBeLessThan(full.length);
  });

  it('compact allow verdict is brief', () => {
    const result = renderVerdict(allowDecision, { compact: true, includeMarker: false });
    expect(result).toContain('AGENTOWNERS: allowed');
  });

  it('compact block verdict is brief', () => {
    const result = renderVerdict(blockDecision, { compact: true, includeMarker: false });
    expect(result).toContain('AGENTOWNERS: blocked');
  });

  it('actor shown in require_approval verdict when provided', () => {
    const result = renderVerdict(approvalDecision, { actor: 'github-copilot[bot]' });
    expect(result).toContain('github-copilot[bot]');
  });

  it('matched files shown in require_approval verdict', () => {
    const result = renderVerdict(approvalDecision);
    expect(result).toContain('src/auth/session.ts');
  });

  it('suggested labels shown in require_approval verdict', () => {
    const result = renderVerdict(approvalDecision);
    expect(result).toContain('ai-agent');
    expect(result).toContain('needs-human-review');
  });

  it('block verdict contains matched rule name', () => {
    const result = renderVerdict(blockDecision);
    expect(result).toContain('Block workflow edits by agents');
  });

  it('block verdict contains reason', () => {
    const result = renderVerdict(blockDecision);
    expect(result).toContain('AI agents may not modify CI/CD workflows without maintainer approval.');
  });
});

describe('renderAuditJson', () => {
  it('produces correct structure', () => {
    const record = renderAuditJson({
      actor: 'github-copilot[bot]',
      repository: 'owner/repo',
      event: 'pull_request',
      agentDetection: { matchedAgent: 'github-copilot', confidence: 'confirmed' },
      decision: approvalDecision,
      changedFiles: ['src/auth/session.ts'],
    });

    expect(record.version).toBe(1);
    expect(record.actor).toBe('github-copilot[bot]');
    expect(record.repository).toBe('owner/repo');
    expect(record.event).toBe('pull_request');
    expect(record.matchedAgent).toBe('github-copilot');
    expect(record.confidence).toBe('confirmed');
    expect(record.decision).toBe('require_approval');
    expect(record.riskScore).toBe(65);
    expect(record.riskLevel).toBe('high');
    expect(record.changedFiles).toContain('src/auth/session.ts');
    expect(record.matchedRules).toHaveLength(1);
    expect(record.matchedRules[0].name).toBe('Require approval for auth changes');
    expect(record.requiredReviewers).toContain('@maintainers/security');
    expect(typeof record.timestamp).toBe('string');
  });

  it('timestamp is an ISO string', () => {
    const record = renderAuditJson({
      actor: 'test',
      agentDetection: { confidence: 'unknown' },
      decision: allowDecision,
      changedFiles: [],
    });
    expect(() => new Date(record.timestamp)).not.toThrow();
    expect(record.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('optional fields absent when not provided', () => {
    const record = renderAuditJson({
      actor: 'test',
      agentDetection: { confidence: 'unknown' },
      decision: allowDecision,
      changedFiles: [],
    });
    expect(record.repository).toBeUndefined();
    expect(record.event).toBeUndefined();
  });
});

describe('renderAllowed', () => {
  it('includes explanation text', () => {
    const result = renderAllowed(allowDecision, {});
    expect(result).toContain('This appears to be a low-risk docs-only AI contribution.');
  });

  it('lists matched rules', () => {
    const result = renderAllowed(allowDecision, {});
    expect(result).toContain('Allow docs-only agent PRs');
  });

  it('states no approval required', () => {
    const result = renderAllowed(allowDecision, {});
    expect(result).toContain('No human approval required by AGENTOWNERS policy.');
  });
});

describe('renderBlocked', () => {
  it('includes recommended next step', () => {
    const result = renderBlocked(blockDecision, {});
    expect(result).toContain('Recommended next step:');
  });
});

describe('renderRequiresApproval', () => {
  it('shows risk level and score', () => {
    const result = renderRequiresApproval(approvalDecision, {});
    expect(result).toContain('Risk level: high');
    expect(result).toContain('Risk score: 65/100');
  });
});
