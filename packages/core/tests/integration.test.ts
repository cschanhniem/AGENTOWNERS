import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as yaml from 'js-yaml'
import {
  parsePolicy,
  classifyFiles,
  detectAgent,
  inferActions,
  evaluatePolicy,
} from '../src/index.js'
import type { AgentDetectionResult } from '../src/types.js'
import type { GitHubEventType } from '../src/actions.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURES = join(__dirname, 'fixtures')

function runFixture(name: string) {
  const dir = join(FIXTURES, name)
  const policyYaml = readFileSync(join(dir, 'policy.yml'), 'utf8')
  const policy = parsePolicy(yaml.load(policyYaml))
  const changedFiles: string[] = JSON.parse(readFileSync(join(dir, 'changed-files.json'), 'utf8'))
  const event: { eventType: GitHubEventType; actor: string; prTitle?: string } = JSON.parse(
    readFileSync(join(dir, 'event.json'), 'utf8'),
  )
  const expected: { effect: string; riskLevel?: string } = JSON.parse(
    readFileSync(join(dir, 'expected-decision.json'), 'utf8'),
  )

  const filesClassification = classifyFiles(changedFiles)
  const agentDetection: AgentDetectionResult = detectAgent({ actor: event.actor, policy })
  const detectedActions = inferActions({
    eventType: event.eventType,
    changedFiles,
    filesClassification,
  })
  const decision = evaluatePolicy({
    policy,
    agentDetection,
    detectedActions,
    changedFiles,
    filesClassification,
    actor: event.actor,
    prTitle: event.prTitle,
  })

  return { decision, expected }
}

describe('integration: docs-only-pr', () => {
  it('allows a PR that only changes docs', () => {
    const { decision, expected } = runFixture('docs-only-pr')
    expect(decision.effect).toBe(expected.effect)
    if (expected.riskLevel) expect(decision.riskLevel).toBe(expected.riskLevel)
  })
})

describe('integration: workflow-edit-pr', () => {
  it('blocks a PR that edits a GitHub Actions workflow', () => {
    const { decision, expected } = runFixture('workflow-edit-pr')
    expect(decision.effect).toBe(expected.effect)
  })
})

describe('integration: auth-change-pr', () => {
  it('requires approval for a PR that touches auth code', () => {
    const { decision, expected } = runFixture('auth-change-pr')
    expect(decision.effect).toBe(expected.effect)
  })
})

describe('integration: dependency-change-pr', () => {
  it('requires approval for a PR that changes package.json', () => {
    const { decision, expected } = runFixture('dependency-change-pr')
    expect(decision.effect).toBe(expected.effect)
  })
})

describe('integration: unknown-agent-pr', () => {
  it('requires approval when the actor is not a known agent', () => {
    const { decision, expected } = runFixture('unknown-agent-pr')
    expect(decision.effect).toBe(expected.effect)
  })
})
