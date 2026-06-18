// Core type definitions — spec sections 11–12

export type AgentAction =
  | 'open_pr'
  | 'update_pr'
  | 'comment'
  | 'review_comment'
  | 'approve_pr'
  | 'request_changes'
  | 'label_issue'
  | 'close_issue'
  | 'reopen_issue'
  | 'assign_issue'
  | 'edit_workflows'
  | 'modify_tests'
  | 'modify_docs'
  | 'modify_dependencies'
  | 'modify_auth'
  | 'modify_infra'
  | 'touch_secrets'
  | 'change_permissions'
  | 'merge_pr';

export type AgentDetectionConfidence = 'confirmed' | 'likely' | 'possible' | 'unknown';

export type AgentPolicy = {
  match: {
    actors?: string[];
    commitEmails?: string[];
    commitNames?: string[];
    prTitlePatterns?: string[];
    bodyPatterns?: string[];
    labels?: string[];
  };
  allowed?: AgentAction[];
  requires_approval?: AgentAction[];
  blocked?: AgentAction[];
};

export type DefaultPolicy = {
  unknown_agent?: 'allow' | 'require_approval' | 'block';
  known_agent?: 'allow' | 'require_approval' | 'block';
  docs_only?: 'allow' | 'require_approval' | 'block';
  workflows?: 'allow' | 'require_approval' | 'block';
  secrets?: 'allow' | 'require_approval' | 'block';
};

export type AuditConfig = {
  enabled?: boolean;
  output?: string;
};

export type RuleCondition = {
  agents?: string[];
  actors?: string[];
  actions?: AgentAction[];
  files?: string[];
  files_not?: string[];
  labels?: string[];
  pr_title?: string[];
  pr_body?: string[];
  issue_title?: string[];
  issue_body?: string[];
  diff_lines_over?: number;
  commits_over?: number;
  changes_package_files?: boolean;
  changes_workflows?: boolean;
  changes_permissions?: boolean;
  changes_auth?: boolean;
  changes_infra?: boolean;
  docs_only?: boolean;
  tests_only?: boolean;
};

export type Rule = {
  name: string;
  when: RuleCondition;
  effect: 'allow' | 'require_approval' | 'block';
  reviewers?: string[];
  labels?: string[];
  reason: string;
};

export type AgentOwnersPolicy = {
  version: 1;
  agents?: Record<string, AgentPolicy>;
  defaults?: DefaultPolicy;
  rules?: Rule[];
  audit?: AuditConfig;
};

export type MatchedRule = {
  name: string;
  effect: 'allow' | 'require_approval' | 'block';
  reason: string;
  matchedConditions?: string[];
  matchedFiles?: string[];
  reviewers?: string[];
  labels?: string[];
};

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type Decision = {
  effect: 'allow' | 'require_approval' | 'block';
  matchedRules: MatchedRule[];
  matchedAgent?: string;
  detectedActions: AgentAction[];
  riskScore: number;
  riskLevel: RiskLevel;
  requiredReviewers: string[];
  labelsToApply: string[];
  explanation: string;
};

export type AgentDetectionResult = {
  agentName?: string;
  confidence: AgentDetectionConfidence;
  signals: string[];
};
