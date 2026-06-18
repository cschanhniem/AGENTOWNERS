import { describe, it, expect } from 'vitest';
import { inferActions, inferFileBasedActions } from '../src/actions.js';
import type { FilesClassification } from '../src/actions.js';

describe('inferFileBasedActions', () => {
  it('docs only → modify_docs', () => {
    const c: FilesClassification = { docsOnly: true };
    expect(inferFileBasedActions(c)).toContain('modify_docs');
  });

  it('tests → modify_tests', () => {
    expect(inferFileBasedActions({ hasTests: true })).toContain('modify_tests');
  });

  it('dependencies → modify_dependencies', () => {
    expect(inferFileBasedActions({ hasDependencies: true })).toContain('modify_dependencies');
  });

  it('workflows → edit_workflows', () => {
    expect(inferFileBasedActions({ hasWorkflows: true })).toContain('edit_workflows');
  });

  it('auth → modify_auth', () => {
    expect(inferFileBasedActions({ hasAuth: true })).toContain('modify_auth');
  });

  it('infra → modify_infra', () => {
    expect(inferFileBasedActions({ hasInfra: true })).toContain('modify_infra');
  });

  it('secrets → touch_secrets', () => {
    expect(inferFileBasedActions({ hasSecrets: true })).toContain('touch_secrets');
  });

  it('empty classification → no file actions', () => {
    expect(inferFileBasedActions({})).toHaveLength(0);
  });
});

describe('inferActions', () => {
  it('PR opened with docs files → [open_pr, modify_docs]', () => {
    const result = inferActions({
      eventType: 'pull_request.opened',
      changedFiles: ['README.md', 'docs/guide.md'],
    });
    expect(result).toContain('open_pr');
    expect(result).toContain('modify_docs');
    expect(result).toHaveLength(2);
  });

  it('PR opened with workflow files → [open_pr, edit_workflows]', () => {
    const result = inferActions({
      eventType: 'pull_request.opened',
      changedFiles: ['.github/workflows/ci.yml'],
    });
    expect(result).toContain('open_pr');
    expect(result).toContain('edit_workflows');
  });

  it('PR opened with auth files → [open_pr, modify_auth]', () => {
    const result = inferActions({
      eventType: 'pull_request.opened',
      changedFiles: ['src/auth/login.ts'],
    });
    expect(result).toContain('open_pr');
    expect(result).toContain('modify_auth');
  });

  it('PR opened with package.json → [open_pr, modify_dependencies]', () => {
    const result = inferActions({
      eventType: 'pull_request.opened',
      changedFiles: ['package.json'],
    });
    expect(result).toContain('open_pr');
    expect(result).toContain('modify_dependencies');
  });

  it('PR opened with test files → [open_pr, modify_tests]', () => {
    const result = inferActions({
      eventType: 'pull_request.opened',
      changedFiles: ['src/utils.test.ts'],
    });
    expect(result).toContain('open_pr');
    expect(result).toContain('modify_tests');
  });

  it('PR opened with filesClassification override', () => {
    const result = inferActions({
      eventType: 'pull_request.opened',
      filesClassification: { hasWorkflows: true },
    });
    expect(result).toContain('open_pr');
    expect(result).toContain('edit_workflows');
  });

  it('PR synchronize → update_pr + file-based actions', () => {
    const result = inferActions({
      eventType: 'pull_request.synchronize',
      changedFiles: ['src/auth/session.ts'],
    });
    expect(result).toContain('update_pr');
    expect(result).toContain('modify_auth');
    expect(result).not.toContain('open_pr');
  });

  it('PR reopened → open_pr', () => {
    const result = inferActions({ eventType: 'pull_request.reopened' });
    expect(result).toContain('open_pr');
  });

  it('PR ready_for_review → open_pr', () => {
    const result = inferActions({ eventType: 'pull_request.ready_for_review' });
    expect(result).toContain('open_pr');
  });

  it('issue comment created → [comment]', () => {
    const result = inferActions({ eventType: 'issue_comment.created' });
    expect(result).toEqual(['comment']);
  });

  it('issue comment edited → [comment]', () => {
    const result = inferActions({ eventType: 'issue_comment.edited' });
    expect(result).toEqual(['comment']);
  });

  it('review approved → [review_comment, approve_pr]', () => {
    const result = inferActions({
      eventType: 'pull_request_review.submitted',
      reviewState: 'APPROVED',
    });
    expect(result).toContain('review_comment');
    expect(result).toContain('approve_pr');
    expect(result).not.toContain('request_changes');
  });

  it('review changes_requested → [review_comment, request_changes]', () => {
    const result = inferActions({
      eventType: 'pull_request_review.submitted',
      reviewState: 'CHANGES_REQUESTED',
    });
    expect(result).toContain('review_comment');
    expect(result).toContain('request_changes');
    expect(result).not.toContain('approve_pr');
  });

  it('review commented → [review_comment] only', () => {
    const result = inferActions({
      eventType: 'pull_request_review.submitted',
      reviewState: 'COMMENTED',
    });
    expect(result).toEqual(['review_comment']);
  });

  it('issue labeled → [label_issue]', () => {
    const result = inferActions({ eventType: 'issues.labeled' });
    expect(result).toEqual(['label_issue']);
  });

  it('issue closed → [close_issue]', () => {
    const result = inferActions({ eventType: 'issues.closed' });
    expect(result).toEqual(['close_issue']);
  });

  it('issue reopened → [reopen_issue]', () => {
    const result = inferActions({ eventType: 'issues.reopened' });
    expect(result).toEqual(['reopen_issue']);
  });

  it('no duplicates when multiple signals match', () => {
    const result = inferActions({
      eventType: 'pull_request.opened',
      changedFiles: [
        'README.md',
        'docs/api.md',
        'src/auth.ts',
        'src/auth.test.ts',
        'package.json',
        '.github/workflows/ci.yml',
      ],
    });
    const unique = new Set(result);
    expect(unique.size).toBe(result.length);
  });
});
