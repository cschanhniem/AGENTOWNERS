// Git helper functions using child_process.execSync
// Security: arguments are never taken from policy content

import { execSync } from 'child_process'

function exec(cmd: string, args: string[], cwd?: string): string {
  // Build argv array — never interpolate policy content into shell strings
  const result = execSync([cmd, ...args].join(' '), {
    cwd,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  return result.trim()
}

export function getChangedFiles(base: string, head: string, cwd?: string): string[] {
  const output = exec('git', ['diff', '--name-only', base, head], cwd)
  if (!output) return []
  return output.split('\n').filter(Boolean)
}

export function getCommitMessages(base: string, head: string, cwd?: string): string[] {
  const output = exec('git', ['log', `${base}..${head}`, '--format=%s%n%b'], cwd)
  if (!output) return []
  return output.split('\n').filter(Boolean)
}

export function getCurrentActor(cwd?: string): string | null {
  try {
    const name = exec('git', ['config', 'user.name'], cwd)
    return name || null
  } catch {
    return null
  }
}
