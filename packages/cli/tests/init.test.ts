import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import { Command } from 'commander'
import { registerInit } from '../src/commands/init.js'
import { getProfile } from '@agentowners/core'

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof fs>('fs')
  return {
    ...actual,
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
  }
})

function makeProgram(): Command {
  const p = new Command()
  p.exitOverride()
  registerInit(p)
  return p
}

describe('init command', () => {
  let exitSpy: ReturnType<typeof vi.spyOn>
  let stdoutSpy: ReturnType<typeof vi.spyOn>
  let stderrSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as never)
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    vi.mocked(fs.existsSync).mockReturnValue(false)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('creates file with correct minimal profile content', async () => {
    const program = makeProgram()
    await program.parseAsync(['node', 'agentowners', 'init', '--profile', 'minimal'])

    const expectedContent = getProfile('minimal')
    const writeCall = vi.mocked(fs.writeFileSync).mock.calls[0]
    expect(writeCall).toBeDefined()
    expect(writeCall[1]).toBe(expectedContent)
  })

  it('creates file at default output path', async () => {
    const program = makeProgram()
    await program.parseAsync(['node', 'agentowners', 'init'])

    const writeCall = vi.mocked(fs.writeFileSync).mock.calls[0]
    expect(writeCall).toBeDefined()
    const writtenPath = writeCall[0] as string
    expect(writtenPath).toContain('.github')
    expect(writtenPath).toContain('AGENTOWNERS.yml')
  })

  it('creates file at custom output path', async () => {
    const program = makeProgram()
    await program.parseAsync([
      'node',
      'agentowners',
      'init',
      '--output',
      'custom/policy.yml',
    ])

    const writeCall = vi.mocked(fs.writeFileSync).mock.calls[0]
    expect(writeCall).toBeDefined()
    const writtenPath = writeCall[0] as string
    expect(writtenPath).toContain('custom/policy.yml')
  })

  it('creates directory recursively', async () => {
    const program = makeProgram()
    await program.parseAsync(['node', 'agentowners', 'init'])

    expect(vi.mocked(fs.mkdirSync)).toHaveBeenCalledWith(
      expect.stringContaining('.github'),
      { recursive: true },
    )
  })

  it('errors when file exists without --force', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)

    const program = makeProgram()
    await program.parseAsync(['node', 'agentowners', 'init'])

    expect(exitSpy).toHaveBeenCalledWith(1)
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining('already exists'),
    )
  })

  it('overwrites file when --force is passed', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)

    const program = makeProgram()
    await program.parseAsync(['node', 'agentowners', 'init', '--force'])

    expect(vi.mocked(fs.writeFileSync)).toHaveBeenCalled()
    expect(exitSpy).not.toHaveBeenCalledWith(1)
  })

  it('errors on unknown profile', async () => {
    const program = makeProgram()
    await program.parseAsync([
      'node',
      'agentowners',
      'init',
      '--profile',
      'nonexistent',
    ])

    expect(exitSpy).toHaveBeenCalledWith(1)
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining('unknown profile'),
    )
  })

  it('creates file with strict-oss profile content', async () => {
    const program = makeProgram()
    await program.parseAsync(['node', 'agentowners', 'init', '--profile', 'strict-oss'])

    const expectedContent = getProfile('strict-oss')
    const writeCall = vi.mocked(fs.writeFileSync).mock.calls[0]
    expect(writeCall[1]).toBe(expectedContent)
  })

  it('prints success message', async () => {
    const program = makeProgram()
    await program.parseAsync(['node', 'agentowners', 'init'])

    expect(stdoutSpy).toHaveBeenCalledWith(
      expect.stringContaining('Created'),
    )
  })
})
