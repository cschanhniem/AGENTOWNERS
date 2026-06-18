import { describe, it, expect } from 'vitest';
import {
  detectAgent,
  isKnownBotActor,
  matchesAgentPolicy,
  KNOWN_BOT_ACTORS,
} from '../src/detection.js';
import type { AgentOwnersPolicy } from '../src/types.js';

const basePolicy: AgentOwnersPolicy = {
  version: 1,
  agents: {
    'my-agent': {
      match: {
        actors: ['my-bot[bot]'],
      },
    },
  },
};

describe('isKnownBotActor', () => {
  it('returns true for all known bot actors', () => {
    for (const actor of KNOWN_BOT_ACTORS) {
      expect(isKnownBotActor(actor)).toBe(true);
    }
  });

  it('returns false for unknown actors', () => {
    expect(isKnownBotActor('some-human')).toBe(false);
    expect(isKnownBotActor('unknown[bot]')).toBe(false);
  });
});

describe('matchesAgentPolicy', () => {
  it('returns agent name when actor matches', () => {
    expect(matchesAgentPolicy('my-bot[bot]', basePolicy)).toBe('my-agent');
  });

  it('returns null when actor does not match', () => {
    expect(matchesAgentPolicy('other-actor', basePolicy)).toBeNull();
  });

  it('returns null when policy has no agents', () => {
    expect(matchesAgentPolicy('anyone', { version: 1 })).toBeNull();
  });
});

describe('detectAgent', () => {
  it('policy match → confirmed with agentName', () => {
    const result = detectAgent({ actor: 'my-bot[bot]', policy: basePolicy });
    expect(result.confidence).toBe('confirmed');
    expect(result.agentName).toBe('my-agent');
    expect(result.signals.some((s) => s.includes('policy match'))).toBe(true);
  });

  it('policy match takes priority over known bot actor', () => {
    const policy: AgentOwnersPolicy = {
      version: 1,
      agents: {
        'special-copilot': {
          match: { actors: ['github-copilot[bot]'] },
        },
      },
    };
    const result = detectAgent({ actor: 'github-copilot[bot]', policy });
    expect(result.confidence).toBe('confirmed');
    expect(result.agentName).toBe('special-copilot');
  });

  it('github-copilot[bot] → confirmed without policy', () => {
    const result = detectAgent({ actor: 'github-copilot[bot]' });
    expect(result.confidence).toBe('confirmed');
    expect(result.agentName).toBeUndefined();
    expect(result.signals.some((s) => s.includes('known bot actor'))).toBe(true);
  });

  it('dependabot[bot] → confirmed', () => {
    const result = detectAgent({ actor: 'dependabot[bot]' });
    expect(result.confidence).toBe('confirmed');
  });

  it('commit with Co-Authored-By: Claude → likely', () => {
    const result = detectAgent({
      actor: 'human-user',
      commitMessages: ['feat: add feature\n\nCo-Authored-By: Claude <noreply@anthropic.com>'],
    });
    expect(result.confidence).toBe('likely');
    expect(result.signals.some((s) => s.includes('Co-Authored-By: Claude'))).toBe(true);
  });

  it('PR body with 🤖 Generated with → likely', () => {
    const result = detectAgent({
      actor: 'human-user',
      prBody: 'This PR was created.\n\n🤖 Generated with Claude Code',
    });
    expect(result.confidence).toBe('likely');
  });

  it('PR body with <!-- agentowners marker → likely', () => {
    const result = detectAgent({
      actor: 'human-user',
      prBody: 'Some description\n<!-- agentowners: claude -->',
    });
    expect(result.confidence).toBe('likely');
  });

  it('PR body with Co-authored-by: somebot[bot] → likely', () => {
    const result = detectAgent({
      actor: 'human-user',
      prBody: 'Co-authored-by: mybot[bot]',
    });
    expect(result.confidence).toBe('likely');
  });

  it('label ai-generated → possible', () => {
    const result = detectAgent({
      actor: 'human-user',
      labels: ['ai-generated'],
    });
    expect(result.confidence).toBe('possible');
    expect(result.signals.some((s) => s.includes('ai-generated'))).toBe(true);
  });

  it('label claude → possible', () => {
    const result = detectAgent({ actor: 'human-user', labels: ['claude'] });
    expect(result.confidence).toBe('possible');
  });

  it('unknown actor, no signals → unknown', () => {
    const result = detectAgent({ actor: 'regular-human' });
    expect(result.confidence).toBe('unknown');
    expect(result.signals).toHaveLength(0);
  });

  it('multiple signals all reported', () => {
    const result = detectAgent({
      actor: 'human-user',
      commitMessages: ['Claude Code did this', 'Generated with AI'],
      prBody: '🤖 Generated with Claude',
      labels: ['ai-generated'],
    });
    expect(result.confidence).toBe('likely');
    expect(result.signals.length).toBeGreaterThan(1);
  });

  it('policy body pattern match → confirmed', () => {
    const policy: AgentOwnersPolicy = {
      version: 1,
      agents: {
        'code-agent': {
          match: {
            bodyPatterns: ['automated pull request'],
          },
        },
      },
    };
    const result = detectAgent({
      actor: 'human-user',
      prBody: 'This is an automated pull request from our CI system.',
      policy,
    });
    expect(result.confidence).toBe('confirmed');
    expect(result.agentName).toBe('code-agent');
  });
});
