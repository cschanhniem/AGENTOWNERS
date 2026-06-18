// F7: Verdict Renderer — spec section 15 and f7-verdict-renderer.md

import type { Decision, AgentDetectionConfidence, AgentAction } from './types.js';

export type RenderOptions = {
  actor?: string;
  includeMarker?: boolean; // default true
  compact?: boolean;       // shorter output for CI check output
};

export type AuditRecord = {
  version: 1;
  timestamp: string;
  repository?: string;
  event?: string;
  actor: string;
  matchedAgent?: string;
  confidence: AgentDetectionConfidence;
  decision: Decision['effect'];
  riskScore: number;
  riskLevel: string;
  detectedActions: AgentAction[];
  changedFiles: string[];
  matchedRules: Array<{ name: string; effect: string; reason: string }>;
  requiredReviewers: string[];
};

export type AuditContext = {
  actor: string;
  repository?: string;
  event?: string;
  agentDetection: {
    matchedAgent?: string;
    confidence: AgentDetectionConfidence;
  };
  decision: Decision;
  changedFiles: string[];
};

const MARKER_OPEN = '<!-- agentowners-verdict -->';
const MARKER_CLOSE = '<!-- /agentowners-verdict -->';

function wrapWithMarker(content: string): string {
  return `${MARKER_OPEN}\n${content}\n${MARKER_CLOSE}`;
}

export function renderAllowed(decision: Decision, options: RenderOptions): string {
  if (options.compact) {
    const ruleNames = decision.matchedRules.map((r) => `\`${r.name}\``).join(', ');
    return `AGENTOWNERS: allowed${ruleNames ? ` — ${ruleNames}` : ''}`;
  }

  const lines: string[] = [];
  lines.push('## AGENTOWNERS verdict: allowed');
  lines.push('');
  lines.push(decision.explanation || 'This appears to be a low-risk AI contribution.');
  lines.push('');

  if (decision.matchedRules.length > 0) {
    lines.push('Matched rule:');
    lines.push('');
    for (const mr of decision.matchedRules) {
      lines.push(`- \`${mr.name}\``);
    }
    lines.push('');
  }

  lines.push('No human approval required by AGENTOWNERS policy.');

  return lines.join('\n');
}

export function renderRequiresApproval(decision: Decision, options: RenderOptions): string {
  if (options.compact) {
    return `AGENTOWNERS: requires approval — risk ${decision.riskLevel} (${decision.riskScore}/100)`;
  }

  const lines: string[] = [];
  lines.push('## AGENTOWNERS verdict: requires approval');
  lines.push('');

  if (options.actor) {
    lines.push(`This PR appears to be created by \`${options.actor}\`.`);
    lines.push('');
  }

  lines.push(`Risk level: ${decision.riskLevel}  `);
  lines.push(`Risk score: ${decision.riskScore}/100`);
  lines.push('');

  if (decision.matchedRules.length > 0) {
    lines.push('Matched rules:');
    lines.push('');
    decision.matchedRules.forEach((mr, idx) => {
      lines.push(`${idx + 1}. \`${mr.name}\``);
      const fileConditions = (mr.matchedConditions ?? []).filter((c) => c.startsWith('files:'));
      const matchedFiles = mr.matchedFiles ?? fileConditions.flatMap((c) => c.replace('files: ', '').split(', '));
      if (matchedFiles.length > 0) {
        lines.push(`   - matched files: ${matchedFiles.map((f) => `\`${f}\``).join(', ')}`);
      }
      lines.push(`   - reason: ${mr.reason}`);
      lines.push('');
    });
  }

  if (decision.requiredReviewers.length > 0) {
    lines.push('Required reviewers:');
    lines.push('');
    for (const reviewer of decision.requiredReviewers) {
      lines.push(`- ${reviewer}`);
    }
    lines.push('');
  }

  if (decision.labelsToApply.length > 0) {
    lines.push('Suggested labels:');
    lines.push('');
    for (const label of decision.labelsToApply) {
      lines.push(`- ${label}`);
    }
    lines.push('');
  }

  if (decision.explanation) {
    lines.push('Decision:');
    lines.push('');
    lines.push(decision.explanation);
  }

  return lines.join('\n');
}

export function renderBlocked(decision: Decision, options: RenderOptions): string {
  if (options.compact) {
    const ruleNames = decision.matchedRules.map((r) => `\`${r.name}\``).join(', ');
    return `AGENTOWNERS: blocked${ruleNames ? ` — ${ruleNames}` : ''}`;
  }

  const lines: string[] = [];
  lines.push('## AGENTOWNERS verdict: blocked');
  lines.push('');
  lines.push('This agent action is blocked by repository policy.');
  lines.push('');

  const blockRules = decision.matchedRules.filter((r) => r.effect === 'block');
  const rulesToShow = blockRules.length > 0 ? blockRules : decision.matchedRules;

  if (rulesToShow.length > 0) {
    lines.push('Matched rule:');
    lines.push('');
    for (const mr of rulesToShow) {
      lines.push(`- \`${mr.name}\``);
    }
    lines.push('');
  }

  const firstRule = rulesToShow[0];
  if (firstRule) {
    lines.push('Reason:');
    lines.push('');
    lines.push(firstRule.reason);
    lines.push('');
  }

  lines.push('Recommended next step:');
  lines.push('');
  lines.push(
    'Ask a maintainer to make this change manually or open a new PR with explicit human ownership.',
  );

  return lines.join('\n');
}

export function renderVerdict(decision: Decision, options?: RenderOptions): string {
  const opts: RenderOptions = { includeMarker: true, ...options };

  let content: string;
  switch (decision.effect) {
    case 'allow':
      content = renderAllowed(decision, opts);
      break;
    case 'require_approval':
      content = renderRequiresApproval(decision, opts);
      break;
    case 'block':
      content = renderBlocked(decision, opts);
      break;
    default:
      content = `## AGENTOWNERS verdict: unknown\n\nUnrecognized decision effect.`;
  }

  if (opts.includeMarker === false) {
    return content;
  }

  return wrapWithMarker(content);
}

export function renderAuditJson(context: AuditContext): AuditRecord {
  const { actor, repository, event, agentDetection, decision, changedFiles } = context;

  return {
    version: 1,
    timestamp: new Date().toISOString(),
    repository,
    event,
    actor,
    matchedAgent: agentDetection.matchedAgent ?? decision.matchedAgent,
    confidence: agentDetection.confidence,
    decision: decision.effect,
    riskScore: decision.riskScore,
    riskLevel: decision.riskLevel,
    detectedActions: decision.detectedActions,
    changedFiles,
    matchedRules: decision.matchedRules.map((mr) => ({
      name: mr.name,
      effect: mr.effect,
      reason: mr.reason,
    })),
    requiredReviewers: decision.requiredReviewers,
  };
}
