import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Command } from 'commander'
import { registerValidate } from '../src/commands/validate.js'
import { loadPolicyFile } from '@agent-owners/core'
import { ZodError, ZodIssueCode } from 'zod'

vi.mock('@agent-owners/core', async () => {
  const actual = await vi.importActual<typeof import('@agent-owners/core')>('@agent-owners/core')
  return {
    ...actual,
    loadPolicyFile: vi.fn(),
  }
})

function makeProgram(): Command {
  const p = new Command()
  p.exitOverride()
  registerValidate(p)
  return p
}

describe('validate command', () => {
  let exitSpy: ReturnType<typeof vi.spyOn>
  let stdoutSpy: ReturnType<typeof vi.spyOn>
  let stderrSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as never)
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('exits 0 and prints success message on valid policy', async () => {
    vi.mocked(loadPolicyFile).mockResolvedValue({
      version: 1,
      defaults: {},
      rules: [],
    } as never)

    const program = makeProgram()
    await program.parseAsync(['node', 'agentowners', 'validate', 'policy.yml'])

    expect(exitSpy).toHaveBeenCalledWith(0)
    expect(stdoutSpy).toHaveBeenCalledWith('AGENTOWNERS policy valid.\n')
  })

  it('uses default path when no path argument given', async () => {
    vi.mocked(loadPolicyFile).mockResolvedValue({
      version: 1,
      defaults: {},
      rules: [],
    } as never)

    const program = makeProgram()
    await program.parseAsync(['node', 'agentowners', 'validate'])

    expect(vi.mocked(loadPolicyFile)).toHaveBeenCalledWith(
      expect.stringContaining('AGENTOWNERS.yml'),
    )
  })

  it('exits 1 and prints error list on ZodError', async () => {
    const zodError = new ZodError([
      {
        code: ZodIssueCode.invalid_enum_value,
        path: ['rules', 0, 'effect'],
        message: 'must be one of allow, require_approval, block',
        options: ['allow', 'require_approval', 'block'],
        received: 'deny',
      },
    ])
    vi.mocked(loadPolicyFile).mockRejectedValue(zodError)

    const program = makeProgram()
    await program.parseAsync(['node', 'agentowners', 'validate', 'bad.yml'])

    expect(exitSpy).toHaveBeenCalledWith(1)
    expect(stderrSpy).toHaveBeenCalledWith('Invalid AGENTOWNERS policy:\n')
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining('rules.0.effect'),
    )
  })

  it('exits 1 and prints error on generic Error', async () => {
    vi.mocked(loadPolicyFile).mockRejectedValue(
      new Error('Failed to load policy from missing.yml: file not found'),
    )

    const program = makeProgram()
    await program.parseAsync(['node', 'agentowners', 'validate', 'missing.yml'])

    expect(exitSpy).toHaveBeenCalledWith(1)
    expect(stderrSpy).toHaveBeenCalledWith('Invalid AGENTOWNERS policy:\n')
  })

  it('exits 1 and surfaces inner ZodError from PolicyLoadError', async () => {
    const zodError = new ZodError([
      {
        code: ZodIssueCode.invalid_type,
        path: ['agents', 'copilot', 'match', 'actors'],
        message: 'Expected array, received string',
        expected: 'array',
        received: 'string',
      },
    ])
    const wrappedErr = Object.assign(
      new Error('Failed to load policy: Expected array, received string'),
      { cause: zodError },
    )
    vi.mocked(loadPolicyFile).mockRejectedValue(wrappedErr)

    const program = makeProgram()
    await program.parseAsync(['node', 'agentowners', 'validate', 'bad.yml'])

    expect(exitSpy).toHaveBeenCalledWith(1)
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining('agents.copilot.match.actors'),
    )
  })
})
