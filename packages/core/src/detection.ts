import type { AgentDetectionConfidence, AgentDetectionResult, AgentOwnersPolicy } from './types.js';

export type AgentDetectionInput = {
  actor: string;
  commitMessages?: string[];
  prTitle?: string;
  prBody?: string;
  labels?: string[];
  policy?: AgentOwnersPolicy;
};

export const KNOWN_BOT_ACTORS = [
  'github-copilot[bot]',
  'copilot-swe-agent[bot]',
  'dependabot[bot]',
  'renovate[bot]',
];

export const AGENT_COMMIT_SIGNATURES = [
  'Co-Authored-By: Claude',
  'Co-Authored-By: Codex',
  'Generated with',
  '🤖',
  'AI-generated',
  'Claude Code',
  'OpenAI Codex',
  'Cursor',
];

const AGENT_LABELS = ['ai-generated', 'agent', 'copilot', 'codex', 'claude'];

const PR_BODY_MARKERS = [
  '🤖 Generated with',
  '<!-- agentowners',
];

const BOT_CO_AUTHOR_PATTERN = /Co-authored-by:.*\[bot\]/i;

export function isKnownBotActor(actor: string): boolean {
  return KNOWN_BOT_ACTORS.includes(actor);
}

export function matchesAgentPolicy(
  actor: string,
  policy: AgentOwnersPolicy,
): string | null {
  if (!policy.agents) return null;
  for (const [name, agentPolicy] of Object.entries(policy.agents)) {
    if (agentPolicy.match?.actors?.includes(actor)) {
      return name;
    }
  }
  return null;
}

export function detectAgent(input: AgentDetectionInput): AgentDetectionResult {
  const { actor, commitMessages = [], prTitle, prBody, labels = [], policy } = input;
  const signals: string[] = [];

  // 1. Policy match (confirmed)
  if (policy) {
    const matchedAgent = matchesAgentPolicy(actor, policy);
    if (matchedAgent) {
      signals.push(`policy match: agents.${matchedAgent}.match.actors`);
      return { agentName: matchedAgent, confidence: 'confirmed', signals };
    }

    // 6. Configured body patterns (from policy) — checked alongside policy
    if (policy.agents) {
      for (const [name, agentPolicy] of Object.entries(policy.agents)) {
        const bodyPatterns = agentPolicy.match?.bodyPatterns ?? [];
        const titlePatterns = agentPolicy.match?.prTitlePatterns ?? [];
        for (const pattern of bodyPatterns) {
          const re = new RegExp(pattern, 'i');
          if (prBody && re.test(prBody)) {
            signals.push(`policy body pattern match: agents.${name}`);
            return { agentName: name, confidence: 'confirmed', signals };
          }
        }
        for (const pattern of titlePatterns) {
          const re = new RegExp(pattern, 'i');
          if (prTitle && re.test(prTitle)) {
            signals.push(`policy title pattern match: agents.${name}`);
            return { agentName: name, confidence: 'confirmed', signals };
          }
        }
      }
    }
  }

  // 2. Known bot actor (confirmed)
  if (isKnownBotActor(actor)) {
    signals.push(`known bot actor: ${actor}`);
    return { confidence: 'confirmed', signals };
  }

  // 3. Commit message signatures (likely)
  const allText = [...commitMessages, prBody ?? ''].join('\n');
  for (const sig of AGENT_COMMIT_SIGNATURES) {
    if (allText.includes(sig)) {
      signals.push(`commit/body signature: "${sig}"`);
    }
  }

  // 4. PR body markers (likely)
  if (prBody) {
    for (const marker of PR_BODY_MARKERS) {
      if (prBody.includes(marker)) {
        signals.push(`PR body marker: "${marker}"`);
      }
    }
    if (BOT_CO_AUTHOR_PATTERN.test(prBody)) {
      signals.push('PR body co-author [bot] pattern');
    }
  }

  if (signals.length > 0) {
    return { confidence: 'likely', signals };
  }

  // 5. Labels (possible)
  const matchedLabels = labels.filter((l) => AGENT_LABELS.includes(l));
  if (matchedLabels.length > 0) {
    for (const label of matchedLabels) {
      signals.push(`label: "${label}"`);
    }
    return { confidence: 'possible', signals };
  }

  // Fallthrough
  return { confidence: 'unknown', signals };
}
