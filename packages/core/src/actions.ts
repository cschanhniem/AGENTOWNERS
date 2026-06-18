import type { AgentAction } from './types.js';
import type { FilesClassification } from './classifier.js';

export type GitHubEventType =
  | 'pull_request.opened'
  | 'pull_request.synchronize'
  | 'pull_request.reopened'
  | 'pull_request.ready_for_review'
  | 'issue_comment.created'
  | 'issue_comment.edited'
  | 'pull_request_review.submitted'
  | 'issues.labeled'
  | 'issues.closed'
  | 'issues.reopened'
  | 'issues.opened';

type LocalFilesClassification = {
  docsOnly?: boolean;
  hasTests?: boolean;
  hasDependencies?: boolean;
  hasWorkflows?: boolean;
  hasAuth?: boolean;
  hasInfra?: boolean;
  hasSecrets?: boolean;
};

export type ActionInferenceInput = {
  eventType: GitHubEventType;
  changedFiles?: string[];
  diffContent?: string;
  reviewState?: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED';
  filesClassification?: LocalFilesClassification | FilesClassification;
};

const DOC_PATTERNS = [/\.md$/i, /\.mdx$/i, /\.rst$/i, /\.txt$/i, /^docs\//i];
const TEST_PATTERNS = [/\.test\.[jt]sx?$/, /\.spec\.[jt]sx?$/, /\/__tests__\//];
const DEPENDENCY_PATTERNS = [
  /^package\.json$/,
  /^package-lock\.json$/,
  /^yarn\.lock$/,
  /^pnpm-lock\.yaml$/,
  /^Cargo\.toml$/,
  /^Cargo\.lock$/,
  /^go\.mod$/,
  /^go\.sum$/,
  /^requirements.*\.txt$/,
  /^pyproject\.toml$/,
  /^Pipfile/,
  /^Gemfile/,
];
const WORKFLOW_PATTERNS = [/^\.github\/workflows\//];
const AUTH_PATTERNS = [/auth/i, /login/i, /oauth/i, /jwt/i, /session/i, /password/i, /credential/i];
const INFRA_PATTERNS = [/^terraform\//i, /\.tf$/, /^infra\//i, /^deploy\//i, /dockerfile$/i, /docker-compose/i, /^k8s\//i, /^kubernetes\//i, /^helm\//i];
const SECRET_PATTERNS = [/\.env/, /secret/i, /\.pem$/, /\.key$/, /private/i];

function classifyFilesLocal(files: string[]): LocalFilesClassification {
  if (files.length === 0) return {};

  const hasWorkflows = files.some((f) => WORKFLOW_PATTERNS.some((p) => p.test(f)));
  const hasAuth = files.some((f) => AUTH_PATTERNS.some((p) => p.test(f)));
  const hasInfra = files.some((f) => INFRA_PATTERNS.some((p) => p.test(f)));
  const hasSecrets = files.some((f) => SECRET_PATTERNS.some((p) => p.test(f)));
  const hasDependencies = files.some((f) => DEPENDENCY_PATTERNS.some((p) => p.test(f)));
  const hasTests = files.some((f) => TEST_PATTERNS.some((p) => p.test(f)));

  const nonDocFiles = files.filter((f) => !DOC_PATTERNS.some((p) => p.test(f)));
  const docsOnly = nonDocFiles.length === 0 && files.length > 0;

  return { docsOnly, hasTests, hasDependencies, hasWorkflows, hasAuth, hasInfra, hasSecrets };
}

export function inferFileBasedActions(classification: LocalFilesClassification): AgentAction[] {
  const actions: AgentAction[] = [];
  if (classification.docsOnly) actions.push('modify_docs');
  if (classification.hasTests) actions.push('modify_tests');
  if (classification.hasDependencies) actions.push('modify_dependencies');
  if (classification.hasWorkflows) actions.push('edit_workflows');
  if (classification.hasAuth) actions.push('modify_auth');
  if (classification.hasInfra) actions.push('modify_infra');
  if (classification.hasSecrets) actions.push('touch_secrets');
  return actions;
}

export function inferActions(input: ActionInferenceInput): AgentAction[] {
  const { eventType, changedFiles, reviewState, filesClassification } = input;
  const actions = new Set<AgentAction>();

  const fc = filesClassification as Record<string, unknown> | undefined;
  const classification: LocalFilesClassification = fc
    ? {
        docsOnly: (fc['docsOnly'] as boolean | undefined) ?? (fc['changesWorkflows'] === undefined && false),
        hasTests: (fc['hasTests'] as boolean | undefined) ?? !(fc['testsOnly'] as boolean | undefined),
        hasDependencies: (fc['hasDependencies'] as boolean | undefined) ?? (fc['changesDependencies'] as boolean | undefined),
        hasWorkflows: (fc['hasWorkflows'] as boolean | undefined) ?? (fc['changesWorkflows'] as boolean | undefined),
        hasAuth: (fc['hasAuth'] as boolean | undefined) ?? (fc['changesAuth'] as boolean | undefined),
        hasInfra: (fc['hasInfra'] as boolean | undefined) ?? (fc['changesInfra'] as boolean | undefined),
        hasSecrets: (fc['hasSecrets'] as boolean | undefined) ?? (fc['secretFilesDetected'] as boolean | undefined),
      }
    : (changedFiles ? classifyFilesLocal(changedFiles) : {});

  switch (eventType) {
    case 'pull_request.opened':
    case 'pull_request.reopened':
    case 'pull_request.ready_for_review': {
      actions.add('open_pr');
      for (const a of inferFileBasedActions(classification)) actions.add(a);
      break;
    }
    case 'pull_request.synchronize': {
      actions.add('update_pr');
      for (const a of inferFileBasedActions(classification)) actions.add(a);
      break;
    }
    case 'issue_comment.created':
    case 'issue_comment.edited': {
      actions.add('comment');
      break;
    }
    case 'pull_request_review.submitted': {
      actions.add('review_comment');
      if (reviewState === 'APPROVED') actions.add('approve_pr');
      if (reviewState === 'CHANGES_REQUESTED') actions.add('request_changes');
      break;
    }
    case 'issues.labeled': {
      actions.add('label_issue');
      break;
    }
    case 'issues.closed': {
      actions.add('close_issue');
      break;
    }
    case 'issues.reopened': {
      actions.add('reopen_issue');
      break;
    }
    case 'issues.opened': {
      break;
    }
  }

  return Array.from(actions);
}
