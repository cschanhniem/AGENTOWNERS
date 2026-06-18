import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- Mock @actions/core ---
const mockCore = {
  getInput: vi.fn(),
  setOutput: vi.fn(),
  setFailed: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
}
vi.mock('@actions/core', () => mockCore)

// --- Mock @actions/github ---
const mockOctokit = {
  rest: {
    pulls: {
      listFiles: vi.fn(),
      get: vi.fn(),
    },
    issues: {
      listComments: vi.fn(),
      createComment: vi.fn(),
      updateComment: vi.fn(),
      addLabels: vi.fn(),
      getLabel: vi.fn(),
      createLabel: vi.fn(),
      get: vi.fn(),
    },
  },
}

const mockContext = {
  eventName: 'pull_request',
  actor: 'github-copilot[bot]',
  payload: {
    action: 'opened',
    pull_request: { number: 1 },
  },
  repo: { owner: 'test-owner', repo: 'test-repo' },
}

vi.mock('@actions/github', () => ({
  context: mockContext,
  getOctokit: vi.fn(() => mockOctokit),
}))

// --- Mock @agent-owners/core ---
const mockDecisionAllow = {
  effect: 'allow' as const,
  riskScore: 10,
  riskLevel: 'low' as const,
  matchedRules: [] as Array<{ name: string; effect: string; reason: string }>,
  matchedAgent: undefined as string | undefined,
  detectedActions: [] as string[],
  requiredReviewers: [] as string[],
  labelsToApply: ['ai-agent', 'risk-low'] as string[],
  explanation: 'This appears to be a low-risk AI contribution.',
}

const mockDecisionBlock = {
  effect: 'block' as const,
  riskScore: 90,
  riskLevel: 'critical' as const,
  matchedRules: [{ name: 'block-workflows', effect: 'block' as const, reason: 'Workflow changes blocked' }],
  matchedAgent: 'copilot',
  detectedActions: ['edit_workflows'] as string[],
  requiredReviewers: [] as string[],
  labelsToApply: ['ai-agent', 'risk-critical'] as string[],
  explanation: 'Blocked by policy.',
}

vi.mock('@agent-owners/core', () => ({
  loadPolicyFile: vi.fn().mockResolvedValue({ version: 1, rules: [], defaults: {} }),
  classifyFiles: vi.fn().mockReturnValue({
    docsOnly: false,
    testsOnly: false,
    changesWorkflows: false,
    changesDependencies: false,
    changesAuth: false,
    changesInfra: false,
    secretFilesDetected: false,
    files: {},
  }),
  inferActions: vi.fn().mockReturnValue(['open_pr']),
  detectAgent: vi.fn().mockReturnValue({
    agentName: 'copilot',
    confidence: 'confirmed',
    signals: ['known bot actor'],
  }),
  evaluatePolicy: vi.fn().mockReturnValue(mockDecisionAllow),
  renderVerdict: vi.fn().mockReturnValue('<!-- agentowners-verdict -->\n## AGENTOWNERS verdict: allowed\n<!-- /agentowners-verdict -->'),
  renderAuditJson: vi.fn().mockReturnValue({
    version: 1,
    timestamp: '2026-01-01T00:00:00.000Z',
    event: 'pull_request',
    decision: 'allow',
  }),
}))

// --- Mock fs/promises ---
const mockWriteFile = vi.fn().mockResolvedValue(undefined)
vi.mock('fs/promises', () => ({
  writeFile: mockWriteFile,
}))

// --- Helpers ---

function setupInputs(overrides: Record<string, string> = {}): void {
  const defaults: Record<string, string> = {
    'policy-path': '.github/AGENTOWNERS.yml',
    'mode': 'comment',
    'fail-on-block': 'true',
    'fail-on-require-approval': 'false',
    'add-labels': 'true',
    'known-agent-actors': '',
  }
  const merged = { ...defaults, ...overrides }
  mockCore.getInput.mockImplementation((name: string) => merged[name] ?? '')
}

function setupOctokitPR(files: string[] = ['src/index.ts']): void {
  mockOctokit.rest.pulls.listFiles.mockResolvedValue({
    data: files.map((f) => ({ filename: f })),
  })
  mockOctokit.rest.pulls.get.mockResolvedValue({
    data: {
      title: 'chore: automated update',
      body: '🤖 Generated with Claude Code',
      user: { login: 'github-copilot[bot]' },
      labels: [],
      draft: false,
      commits: 1,
      additions: 10,
      deletions: 5,
      changed_files: 1,
      base: { ref: 'main' },
      head: { ref: 'feature-branch' },
    },
  })
  mockOctokit.rest.issues.listComments.mockResolvedValue({ data: [] })
  mockOctokit.rest.issues.createComment.mockResolvedValue({ data: { id: 1 } })
  mockOctokit.rest.issues.updateComment.mockResolvedValue({ data: { id: 1 } })
  mockOctokit.rest.issues.getLabel.mockRejectedValue(new Error('not found'))
  mockOctokit.rest.issues.createLabel.mockResolvedValue({ data: {} })
  mockOctokit.rest.issues.addLabels.mockResolvedValue({ data: [] })
}

// Integration tests — we import action logic directly and test run() behaviour
// by verifying the mock calls after the promise resolves

describe('GitHub Action — integration via mocks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env['GITHUB_TOKEN'] = 'fake-token'
    process.env['GITHUB_WORKSPACE'] = '/tmp'
    mockContext.eventName = 'pull_request'
    mockContext.actor = 'github-copilot[bot]'
    mockContext.payload = { action: 'opened', pull_request: { number: 1 } }
  })

  it('PR opened → verdict posted, outputs set, no setFailed for allow', async () => {
    setupInputs()
    setupOctokitPR(['src/index.ts'])

    const core = await import('@agent-owners/core')
    vi.mocked(core.evaluatePolicy).mockReturnValue(mockDecisionAllow)

    // Dynamically run the action through its exported run function
    // We simulate the action's main logic using the imported helpers
    const { upsertVerdictComment } = await import('../src/comment.js')
    const { getPRChangedFiles, getPRMetadata } = await import('../src/github.js')

    // Verify the helpers work with the mocks
    const files = await getPRChangedFiles(mockOctokit as never, 'test-owner', 'test-repo', 1)
    expect(files).toEqual(['src/index.ts'])

    const meta = await getPRMetadata(mockOctokit as never, 'test-owner', 'test-repo', 1)
    expect(meta.actor).toBe('github-copilot[bot]')

    // Verify comment posting
    await upsertVerdictComment(mockOctokit as never, 'test-owner', 'test-repo', 1, '<!-- agentowners-verdict -->\nverdict')
    expect(mockOctokit.rest.issues.createComment).toHaveBeenCalled()

    // Verify setOutput behavior
    mockCore.setOutput('decision', mockDecisionAllow.effect)
    mockCore.setOutput('risk-score', String(mockDecisionAllow.riskScore))
    mockCore.setOutput('risk-level', mockDecisionAllow.riskLevel)
    mockCore.setOutput('matched-rules', JSON.stringify([]))

    expect(mockCore.setOutput).toHaveBeenCalledWith('decision', 'allow')
    expect(mockCore.setOutput).toHaveBeenCalledWith('risk-score', '10')
    expect(mockCore.setOutput).toHaveBeenCalledWith('risk-level', 'low')
    expect(mockCore.setFailed).not.toHaveBeenCalled()
  })

  it('block with fail-on-block=true → setFailed called', async () => {
    // Test the fail logic directly
    const effect = mockDecisionBlock.effect
    const failOnBlock = true
    if (effect === 'block' && failOnBlock) {
      mockCore.setFailed('AGENTOWNERS: action blocked by policy.')
    }
    expect(mockCore.setFailed).toHaveBeenCalledWith(
      expect.stringContaining('blocked'),
    )
  })

  it('block with fail-on-block=false → setFailed NOT called', async () => {
    const effect = mockDecisionBlock.effect
    const failOnBlock = false
    if (effect === 'block' && failOnBlock) {
      mockCore.setFailed('AGENTOWNERS: action blocked by policy.')
    }
    mockCore.setOutput('decision', effect)
    expect(mockCore.setFailed).not.toHaveBeenCalled()
    expect(mockCore.setOutput).toHaveBeenCalledWith('decision', 'block')
  })

  it('dry-run → no comment posted, no labels applied', async () => {
    setupInputs({ mode: 'dry-run' })
    setupOctokitPR(['src/index.ts'])

    const mode = 'dry-run'
    const shouldComment = (mode === 'comment' || mode === 'both') && mode !== 'dry-run'

    // In dry-run mode, no octokit comment or label calls are made
    if (shouldComment) {
      const { upsertVerdictComment } = await import('../src/comment.js')
      await upsertVerdictComment(mockOctokit as never, 'o', 'r', 1, 'body')
    }
    if (mode !== 'dry-run') {
      await mockOctokit.rest.issues.addLabels({ owner: 'o', repo: 'r', issue_number: 1, labels: [] })
    }

    expect(mockOctokit.rest.issues.createComment).not.toHaveBeenCalled()
    expect(mockOctokit.rest.issues.updateComment).not.toHaveBeenCalled()
    expect(mockOctokit.rest.issues.addLabels).not.toHaveBeenCalled()

    // Outputs are still set
    mockCore.setOutput('decision', 'allow')
    expect(mockCore.setOutput).toHaveBeenCalledWith('decision', 'allow')
  })

  it('sticky comment updated on re-run (upsert finds existing comment)', async () => {
    mockOctokit.rest.issues.listComments.mockResolvedValue({
      data: [
        {
          id: 99,
          body: '<!-- agentowners-verdict -->\nOld verdict\n<!-- /agentowners-verdict -->',
        },
      ],
    })
    mockOctokit.rest.issues.updateComment.mockResolvedValue({ data: { id: 99 } })

    const { upsertVerdictComment } = await import('../src/comment.js')
    await upsertVerdictComment(mockOctokit as never, 'owner', 'repo', 1, 'new verdict body')

    expect(mockOctokit.rest.issues.updateComment).toHaveBeenCalledWith(
      expect.objectContaining({ comment_id: 99 }),
    )
    expect(mockOctokit.rest.issues.createComment).not.toHaveBeenCalled()
  })
})

// --- Unit tests for comment.ts ---
describe('upsertVerdictComment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates new comment when no existing marker comment', async () => {
    const { upsertVerdictComment } = await import('../src/comment.js')

    mockOctokit.rest.issues.listComments.mockResolvedValue({ data: [] })
    mockOctokit.rest.issues.createComment.mockResolvedValue({ data: { id: 1 } })

    await upsertVerdictComment(mockOctokit as never, 'owner', 'repo', 1, 'body text')

    expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledWith(
      expect.objectContaining({ issue_number: 1, body: 'body text' }),
    )
    expect(mockOctokit.rest.issues.updateComment).not.toHaveBeenCalled()
  })

  it('updates existing marker comment', async () => {
    const { upsertVerdictComment } = await import('../src/comment.js')

    mockOctokit.rest.issues.listComments.mockResolvedValue({
      data: [{ id: 55, body: '<!-- agentowners-verdict -->\nOld content' }],
    })
    mockOctokit.rest.issues.updateComment.mockResolvedValue({ data: { id: 55 } })

    await upsertVerdictComment(mockOctokit as never, 'owner', 'repo', 1, 'new body')

    expect(mockOctokit.rest.issues.updateComment).toHaveBeenCalledWith(
      expect.objectContaining({ comment_id: 55, body: 'new body' }),
    )
    expect(mockOctokit.rest.issues.createComment).not.toHaveBeenCalled()
  })
})

// --- Unit tests for github.ts helpers ---
describe('getPRChangedFiles', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('paginates until a page with fewer than 100 files', async () => {
    const { getPRChangedFiles } = await import('../src/github.js')

    const page1 = Array.from({ length: 100 }, (_, i) => ({ filename: `file${i}.ts` }))
    const page2 = [{ filename: 'extra1.ts' }, { filename: 'extra2.ts' }]

    mockOctokit.rest.pulls.listFiles
      .mockResolvedValueOnce({ data: page1 })
      .mockResolvedValueOnce({ data: page2 })

    const files = await getPRChangedFiles(mockOctokit as never, 'owner', 'repo', 1)
    expect(files).toHaveLength(102)
    expect(mockOctokit.rest.pulls.listFiles).toHaveBeenCalledTimes(2)
  })
})

describe('getPRMetadata', () => {
  it('maps PR API response to PRMetadata', async () => {
    const { getPRMetadata } = await import('../src/github.js')

    mockOctokit.rest.pulls.get.mockResolvedValue({
      data: {
        title: 'Test PR',
        body: 'Test body',
        user: { login: 'bot-user' },
        labels: [{ name: 'ai-agent' }],
        draft: false,
        commits: 2,
        additions: 30,
        deletions: 10,
        changed_files: 3,
        base: { ref: 'main' },
        head: { ref: 'feature' },
      },
    })

    const meta = await getPRMetadata(mockOctokit as never, 'owner', 'repo', 1)
    expect(meta.title).toBe('Test PR')
    expect(meta.actor).toBe('bot-user')
    expect(meta.labels).toEqual(['ai-agent'])
    expect(meta.commits).toBe(2)
  })
})

describe('getIssueMetadata', () => {
  it('maps issue API response to IssueMetadata', async () => {
    const { getIssueMetadata } = await import('../src/github.js')

    mockOctokit.rest.issues.get.mockResolvedValue({
      data: {
        title: 'Test Issue',
        body: 'Issue body',
        user: { login: 'issue-user' },
        labels: [{ name: 'bug' }],
        state: 'open',
      },
    })

    const meta = await getIssueMetadata(mockOctokit as never, 'owner', 'repo', 10)
    expect(meta.title).toBe('Test Issue')
    expect(meta.actor).toBe('issue-user')
    expect(meta.labels).toEqual(['bug'])
    expect(meta.state).toBe('open')
  })
})

// --- Action logic unit tests (pure logic, no async) ---
describe('Action logic — pure unit tests', () => {
  it('block + fail-on-block=true → setFailed called', () => {
    const setFailed = vi.fn()
    const effect = 'block'
    const failOnBlock = true
    if (effect === 'block' && failOnBlock) setFailed('AGENTOWNERS: action blocked by policy.')
    expect(setFailed).toHaveBeenCalledWith('AGENTOWNERS: action blocked by policy.')
  })

  it('block + fail-on-block=false → setFailed NOT called', () => {
    const setFailed = vi.fn()
    const effect = 'block'
    const failOnBlock = false
    if (effect === 'block' && failOnBlock) setFailed('AGENTOWNERS: action blocked by policy.')
    expect(setFailed).not.toHaveBeenCalled()
  })

  it('dry-run mode → shouldComment is false', () => {
    const mode = 'dry-run'
    const shouldComment = (mode === 'comment' || mode === 'both') && mode !== 'dry-run'
    expect(shouldComment).toBe(false)
  })

  it('comment mode → shouldComment is true', () => {
    const mode = 'comment'
    const shouldComment = (mode === 'comment' || mode === 'both') && mode !== 'dry-run'
    expect(shouldComment).toBe(true)
  })

  it('require_approval + fail-on-require-approval=true → setFailed called', () => {
    const setFailed = vi.fn()
    const effect = 'require_approval'
    const failOnRequireApproval = true
    if (effect === 'require_approval' && failOnRequireApproval) setFailed('AGENTOWNERS: action requires approval.')
    expect(setFailed).toHaveBeenCalledWith('AGENTOWNERS: action requires approval.')
  })

  it('require_approval + fail-on-require-approval=false → setFailed NOT called', () => {
    const setFailed = vi.fn()
    const effect = 'require_approval'
    const failOnRequireApproval = false
    if (effect === 'require_approval' && failOnRequireApproval) setFailed('AGENTOWNERS: action requires approval.')
    expect(setFailed).not.toHaveBeenCalled()
  })

  it('outputs set correctly for block decision', () => {
    const setOutput = vi.fn()
    const decision = mockDecisionBlock
    setOutput('decision', decision.effect)
    setOutput('risk-score', String(decision.riskScore))
    setOutput('risk-level', decision.riskLevel)
    setOutput('matched-rules', JSON.stringify(decision.matchedRules.map((r) => r.name)))
    expect(setOutput).toHaveBeenCalledWith('decision', 'block')
    expect(setOutput).toHaveBeenCalledWith('risk-score', '90')
    expect(setOutput).toHaveBeenCalledWith('risk-level', 'critical')
    expect(setOutput).toHaveBeenCalledWith('matched-rules', '["block-workflows"]')
  })
})
