import { describe, it, expect } from 'vitest'
import { ZodError } from 'zod'
import { parsePolicy, agentOwnersPolicySchema } from '../src/schema.js'

describe('parsePolicy', () => {
  it('parses a minimal policy with only version', () => {
    const result = parsePolicy({ version: 1 })
    expect(result.version).toBe(1)
    expect(result.agents).toBeUndefined()
    expect(result.rules).toBeUndefined()
    expect(result.defaults).toBeUndefined()
    expect(result.audit).toBeUndefined()
  })

  it('parses a full policy with agents, rules, and defaults', () => {
    const input = {
      version: 1,
      defaults: {
        unknown_agent: 'require_approval',
        known_agent: 'require_approval',
        docs_only: 'allow',
        workflows: 'block',
        secrets: 'block',
      },
      agents: {
        'github-copilot': {
          match: {
            actors: ['github-copilot[bot]'],
            labels: ['ai-generated'],
          },
          allowed: ['open_pr', 'comment'],
          requires_approval: ['modify_tests'],
          blocked: ['merge_pr', 'touch_secrets'],
        },
      },
      rules: [
        {
          name: 'Block workflow edits',
          when: {
            files: ['.github/workflows/**'],
            changes_workflows: true,
          },
          effect: 'block',
          reason: 'Agents may not modify CI/CD workflows.',
        },
        {
          name: 'Require approval for auth',
          when: {
            files: ['**/auth/**'],
            changes_auth: true,
            diff_lines_over: 50,
          },
          effect: 'require_approval',
          reviewers: ['@maintainers/security'],
          labels: ['needs-human-review'],
          reason: 'Auth changes require human review.',
        },
      ],
      audit: {
        enabled: true,
        output: 'agentowners-decision.json',
      },
    }

    const result = parsePolicy(input)
    expect(result.version).toBe(1)
    expect(result.defaults?.unknown_agent).toBe('require_approval')
    expect(result.agents?.['github-copilot'].match.actors).toEqual(['github-copilot[bot]'])
    expect(result.agents?.['github-copilot'].allowed).toContain('open_pr')
    expect(result.agents?.['github-copilot'].blocked).toContain('merge_pr')
    expect(result.rules).toHaveLength(2)
    expect(result.rules?.[0].name).toBe('Block workflow edits')
    expect(result.rules?.[0].effect).toBe('block')
    expect(result.rules?.[1].reviewers).toEqual(['@maintainers/security'])
    expect(result.audit?.enabled).toBe(true)
    expect(result.audit?.output).toBe('agentowners-decision.json')
  })

  it('throws ZodError when version is 2', () => {
    expect(() => parsePolicy({ version: 2 })).toThrow(ZodError)
  })

  it('throws ZodError for an invalid effect value', () => {
    const input = {
      version: 1,
      rules: [
        {
          name: 'Bad rule',
          when: {},
          effect: 'approve', // not a valid effect
          reason: 'test',
        },
      ],
    }
    expect(() => parsePolicy(input)).toThrow(ZodError)
  })

  it('throws ZodError for an unknown action name in allowed list', () => {
    const input = {
      version: 1,
      agents: {
        bot: {
          match: { actors: ['bot[bot]'] },
          allowed: ['fly_rocket'], // not a valid AgentAction
        },
      },
    }
    expect(() => parsePolicy(input)).toThrow(ZodError)
  })

  it('throws ZodError when a rule is missing the required reason field', () => {
    const input = {
      version: 1,
      rules: [
        {
          name: 'No reason rule',
          when: {},
          effect: 'block',
          // reason is missing
        },
      ],
    }
    expect(() => parsePolicy(input)).toThrow(ZodError)
  })

  it('throws ZodError when version field is missing entirely', () => {
    expect(() => parsePolicy({})).toThrow(ZodError)
  })
})

describe('agentOwnersPolicySchema', () => {
  it('passes through unknown top-level fields (passthrough behavior)', () => {
    // By default zod strips unknown keys from z.object — that is fine for forward compat
    const result = agentOwnersPolicySchema.safeParse({ version: 1, unknownField: 'ignored' })
    expect(result.success).toBe(true)
  })
})
