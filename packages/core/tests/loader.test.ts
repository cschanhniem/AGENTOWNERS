import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'
import {
  findPolicyFile,
  loadPolicyFile,
  loadPolicy,
  PolicyNotFoundError,
  PolicyLoadError,
} from '../src/loader.js'

const FIXTURES = path.join(import.meta.dirname, 'fixtures')

async function makeTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'agentowners-test-'))
}

async function copyFixture(name: string, dest: string, destName?: string): Promise<string> {
  const target = path.join(dest, destName ?? name)
  await fs.mkdir(path.dirname(target), { recursive: true })
  await fs.copyFile(path.join(FIXTURES, name), target)
  return target
}

describe('findPolicyFile', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await makeTempDir()
  })

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  it('returns null when no policy file exists', async () => {
    const result = await findPolicyFile(tmpDir)
    expect(result).toBeNull()
  })

  it('finds AGENTOWNERS.yml in root', async () => {
    await copyFixture('valid-minimal.yml', tmpDir, 'AGENTOWNERS.yml')
    const result = await findPolicyFile(tmpDir)
    expect(result).toBe(path.join(tmpDir, 'AGENTOWNERS.yml'))
  })

  it('finds .github/AGENTOWNERS.yml first (highest priority)', async () => {
    await copyFixture('valid-minimal.yml', tmpDir, '.github/AGENTOWNERS.yml')
    await copyFixture('valid-minimal.yml', tmpDir, 'AGENTOWNERS.yml')
    const result = await findPolicyFile(tmpDir)
    expect(result).toBe(path.join(tmpDir, '.github/AGENTOWNERS.yml'))
  })

  it('finds .agentowners.yml as lowest priority', async () => {
    await copyFixture('valid-minimal.yml', tmpDir, '.agentowners.yml')
    const result = await findPolicyFile(tmpDir)
    expect(result).toBe(path.join(tmpDir, '.agentowners.yml'))
  })

  it('warns to stderr when multiple policy files exist', async () => {
    await copyFixture('valid-minimal.yml', tmpDir, 'AGENTOWNERS.yml')
    await copyFixture('valid-minimal.yml', tmpDir, '.agentowners.yml')

    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    try {
      await findPolicyFile(tmpDir)
      expect(stderrSpy).toHaveBeenCalledOnce()
      expect(stderrSpy.mock.calls[0][0]).toContain('Warning: multiple policy files found')
    } finally {
      stderrSpy.mockRestore()
    }
  })

  it('returns first match without warning when only one file exists', async () => {
    await copyFixture('valid-minimal.yml', tmpDir, 'AGENTOWNERS.yml')
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    try {
      const result = await findPolicyFile(tmpDir)
      expect(result).toBeTruthy()
      expect(stderrSpy).not.toHaveBeenCalled()
    } finally {
      stderrSpy.mockRestore()
    }
  })
})

describe('loadPolicyFile', () => {
  it('loads valid minimal policy', async () => {
    const filePath = path.join(FIXTURES, 'valid-minimal.yml')
    const policy = await loadPolicyFile(filePath)
    expect(policy.version).toBe(1)
  })

  it('loads valid full policy', async () => {
    const filePath = path.join(FIXTURES, 'valid-full.yml')
    const policy = await loadPolicyFile(filePath)
    expect(policy.version).toBe(1)
    expect(policy.agents).toBeDefined()
    expect(policy.agents?.dependabot).toBeDefined()
    expect(policy.rules).toBeInstanceOf(Array)
    expect(policy.defaults).toBeDefined()
    expect(policy.audit?.enabled).toBe(true)
  })

  it('throws PolicyLoadError on invalid YAML', async () => {
    const filePath = path.join(FIXTURES, 'invalid-yaml.yml')
    await expect(loadPolicyFile(filePath)).rejects.toThrow(PolicyLoadError)
    await expect(loadPolicyFile(filePath)).rejects.toThrow(/Failed to load policy/)
  })

  it('throws PolicyLoadError on schema violation', async () => {
    const filePath = path.join(FIXTURES, 'invalid-schema.yml')
    await expect(loadPolicyFile(filePath)).rejects.toThrow(PolicyLoadError)
  })

  it('throws PolicyLoadError when file does not exist', async () => {
    await expect(loadPolicyFile('/nonexistent/path/policy.yml')).rejects.toThrow(PolicyLoadError)
  })

  it('PolicyLoadError has filePath property', async () => {
    const filePath = path.join(FIXTURES, 'invalid-schema.yml')
    try {
      await loadPolicyFile(filePath)
      expect.fail('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(PolicyLoadError)
      expect((err as PolicyLoadError).filePath).toBe(filePath)
    }
  })
})

describe('loadPolicy', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await makeTempDir()
  })

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  it('loads policy and returns filePath', async () => {
    await copyFixture('valid-minimal.yml', tmpDir, 'AGENTOWNERS.yml')
    const { policy, filePath } = await loadPolicy(tmpDir)
    expect(policy.version).toBe(1)
    expect(filePath).toBe(path.join(tmpDir, 'AGENTOWNERS.yml'))
  })

  it('throws PolicyNotFoundError when no policy file found', async () => {
    await expect(loadPolicy(tmpDir)).rejects.toThrow(PolicyNotFoundError)
  })

  it('PolicyNotFoundError has searchedPaths property', async () => {
    try {
      await loadPolicy(tmpDir)
      expect.fail('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(PolicyNotFoundError)
      const e = err as PolicyNotFoundError
      expect(e.searchedPaths).toBeInstanceOf(Array)
      expect(e.searchedPaths.length).toBe(3)
      expect(e.searchedPaths[0]).toContain('.github/AGENTOWNERS.yml')
    }
  })

  it('loads full policy from .github/AGENTOWNERS.yml', async () => {
    await copyFixture('valid-full.yml', tmpDir, '.github/AGENTOWNERS.yml')
    const { policy, filePath } = await loadPolicy(tmpDir)
    expect(policy.version).toBe(1)
    expect(filePath).toBe(path.join(tmpDir, '.github/AGENTOWNERS.yml'))
    expect(policy.agents?.dependabot).toBeDefined()
  })
})
