// Policy rule evaluation — spec sections 14 and F6

import { minimatch } from 'minimatch';
import type {
  AgentDetectionResult,
  AgentOwnersPolicy,
  Decision,
  MatchedRule,
  Rule,
} from './types.js';
import type { FilesClassification } from './classifier.js';
import { computeRiskScore } from './scoring.js';

export type EvaluationInput = {
  policy: AgentOwnersPolicy;
  agentDetection: AgentDetectionResult;
  detectedActions: import('./types.js').AgentAction[];
  changedFiles: string[];
  filesClassification: FilesClassification;
  diffLinesCount?: number;
  commitsCount?: number;
  actor: string;
  prTitle?: string;
  prBody?: string;
  labels?: string[];
};

/**
 * Evaluate a single rule against the input.
 * Returns a MatchedRule if all specified conditions match, null otherwise.
 */
export function evaluateRule(rule: Rule, input: EvaluationInput): MatchedRule | null {
  const { when } = rule;
  const {
    agentDetection,
    detectedActions,
    changedFiles,
    filesClassification,
    diffLinesCount,
    commitsCount,
    actor,
    prTitle,
    prBody,
    labels,
  } = input;

  const matchedConditions: string[] = [];
  const fileMatches: string[] = [];

  // agents condition
  if (when.agents !== undefined) {
    const agentName = agentDetection.agentName ?? 'unknown';
    if (!when.agents.includes(agentName)) return null;
    matchedConditions.push('agents');
  }

  // actors condition
  if (when.actors !== undefined) {
    if (!when.actors.includes(actor)) return null;
    matchedConditions.push('actors');
  }

  // actions condition
  if (when.actions !== undefined) {
    const hasAction = when.actions.some((a) => detectedActions.includes(a));
    if (!hasAction) return null;
    matchedConditions.push('actions');
  }

  // files condition — any changed file matches any glob pattern
  if (when.files !== undefined) {
    const matched = changedFiles.filter((f) =>
      when.files!.some((pattern) => minimatch(f, pattern, { dot: true }))
    );
    if (matched.length === 0) return null;
    fileMatches.push(...matched);
    matchedConditions.push(`files: ${matched.join(', ')}`);
  }

  // files_not condition — no changed file matches any glob pattern
  if (when.files_not !== undefined) {
    const forbidden = changedFiles.some((f) =>
      when.files_not!.some((pattern) => minimatch(f, pattern, { dot: true }))
    );
    if (forbidden) return null;
    matchedConditions.push('files_not');
  }

  // labels condition
  if (when.labels !== undefined) {
    const prLabels = labels ?? [];
    const hasLabel = when.labels.some((l) => prLabels.includes(l));
    if (!hasLabel) return null;
    matchedConditions.push('labels');
  }

  // pr_title condition
  if (when.pr_title !== undefined) {
    if (!prTitle) return null;
    const matches = when.pr_title.some((pattern) => {
      try {
        return new RegExp(pattern, 'i').test(prTitle);
      } catch {
        return prTitle.includes(pattern);
      }
    });
    if (!matches) return null;
    matchedConditions.push('pr_title');
  }

  // pr_body condition
  if (when.pr_body !== undefined) {
    if (!prBody) return null;
    const matches = when.pr_body.some((pattern) => {
      try {
        return new RegExp(pattern, 'i').test(prBody);
      } catch {
        return prBody.includes(pattern);
      }
    });
    if (!matches) return null;
    matchedConditions.push('pr_body');
  }

  // diff_lines_over condition
  if (when.diff_lines_over !== undefined) {
    if (diffLinesCount === undefined || diffLinesCount <= when.diff_lines_over) return null;
    matchedConditions.push(`diff_lines_over:${when.diff_lines_over}`);
  }

  // commits_over condition
  if (when.commits_over !== undefined) {
    if (commitsCount === undefined || commitsCount <= when.commits_over) return null;
    matchedConditions.push(`commits_over:${when.commits_over}`);
  }

  // classification-based conditions
  if (when.changes_package_files === true) {
    if (!filesClassification.changesDependencies) return null;
    matchedConditions.push('changes_package_files');
  }
  if (when.changes_workflows === true) {
    if (!filesClassification.changesWorkflows) return null;
    matchedConditions.push('changes_workflows');
  }
  if (when.changes_permissions === true) {
    if (!filesClassification.changesAuth) return null;
    matchedConditions.push('changes_permissions');
  }
  if (when.changes_auth === true) {
    if (!filesClassification.changesAuth) return null;
    matchedConditions.push('changes_auth');
  }
  if (when.changes_infra === true) {
    if (!filesClassification.changesInfra) return null;
    matchedConditions.push('changes_infra');
  }
  if (when.docs_only === true) {
    if (!filesClassification.docsOnly) return null;
    matchedConditions.push('docs_only');
  }
  if (when.tests_only === true) {
    if (!filesClassification.testsOnly) return null;
    matchedConditions.push('tests_only');
  }

  return {
    name: rule.name,
    effect: rule.effect,
    reason: rule.reason,
    matchedConditions,
    ...(fileMatches.length > 0 ? { matchedFiles: fileMatches } : {}),
    ...(rule.reviewers !== undefined ? { reviewers: rule.reviewers } : {}),
    ...(rule.labels !== undefined ? { labels: rule.labels } : {}),
  };
}

function effectPriority(effect: 'allow' | 'require_approval' | 'block'): number {
  if (effect === 'block') return 3;
  if (effect === 'require_approval') return 2;
  return 1;
}

function computeDefaultEffect(input: EvaluationInput): 'allow' | 'require_approval' | 'block' {
  const { policy, agentDetection, filesClassification } = input;
  const defaults = policy.defaults;

  // Secrets default: block
  if (filesClassification.secretFilesDetected) {
    return defaults?.secrets ?? 'block';
  }

  // Workflows default: block
  if (filesClassification.changesWorkflows) {
    return defaults?.workflows ?? 'block';
  }

  // Docs only default: allow
  if (filesClassification.docsOnly) {
    return defaults?.docs_only ?? 'allow';
  }

  // Unknown agent default: require_approval
  if (agentDetection.confidence === 'unknown') {
    return defaults?.unknown_agent ?? 'require_approval';
  }

  // Known agent default: require_approval
  return defaults?.known_agent ?? 'require_approval';
}

/**
 * Main evaluation function. Returns full Decision object.
 */
export function evaluatePolicy(input: EvaluationInput): Decision {
  const { policy, agentDetection, detectedActions, filesClassification, diffLinesCount } = input;

  const rules = policy.rules ?? [];
  const matchedRules: MatchedRule[] = [];

  for (const rule of rules) {
    const matched = evaluateRule(rule, input);
    if (matched !== null) {
      matchedRules.push(matched);
    }
  }

  // Compute effect
  let effect: 'allow' | 'require_approval' | 'block';
  if (matchedRules.length === 0) {
    effect = computeDefaultEffect(input);
  } else {
    effect = matchedRules.reduce(
      (best, mr) =>
        effectPriority(mr.effect) > effectPriority(best) ? mr.effect : best,
      'allow' as 'allow' | 'require_approval' | 'block'
    );
  }

  // Collect required reviewers from matched rules that require_approval or block
  const requiredReviewers = Array.from(
    new Set(
      matchedRules
        .filter((mr) => mr.effect === 'require_approval' || mr.effect === 'block')
        .flatMap((mr) => mr.reviewers ?? [])
    )
  );

  // Collect labels from matched rules
  const ruleLabelSet = new Set<string>(matchedRules.flatMap((mr) => mr.labels ?? []));

  // Compute risk score
  const { score, level } = computeRiskScore({
    filesClassification,
    diffLinesCount,
    detectedActions,
    agentConfidence: agentDetection.confidence,
  });

  // Add standard labels
  ruleLabelSet.add('ai-agent');
  ruleLabelSet.add(`risk-${level}`);

  const labelsToApply = Array.from(ruleLabelSet);

  const explanation = buildExplanation(effect, matchedRules, agentDetection, score, level);

  return {
    effect,
    matchedRules,
    matchedAgent: agentDetection.agentName,
    detectedActions,
    riskScore: score,
    riskLevel: level,
    requiredReviewers,
    labelsToApply,
    explanation,
  };
}

function buildExplanation(
  effect: 'allow' | 'require_approval' | 'block',
  matchedRules: MatchedRule[],
  agentDetection: AgentDetectionResult,
  score: number,
  level: string
): string {
  const agentLabel = agentDetection.agentName ?? 'an unknown agent';
  const lines: string[] = [];

  if (effect === 'block') {
    lines.push('## AGENTOWNERS verdict: blocked');
    lines.push('\nThis agent action is blocked by repository policy.');
  } else if (effect === 'require_approval') {
    lines.push('## AGENTOWNERS verdict: requires approval');
    lines.push(`\nThis PR appears to be created by \`${agentLabel}\`.`);
  } else {
    lines.push('## AGENTOWNERS verdict: allowed');
    lines.push('\nThis appears to be a low-risk AI contribution.');
  }

  lines.push(`\nRisk level: ${level}`);
  lines.push(`Risk score: ${score}/100`);

  if (matchedRules.length > 0) {
    lines.push('\nMatched rules:');
    for (const mr of matchedRules) {
      lines.push(`- \`${mr.name}\`: ${mr.reason}`);
    }
  }

  return lines.join('\n');
}
