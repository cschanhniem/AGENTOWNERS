import * as path from 'path'
import { Command } from 'commander'
import { loadPolicyFile } from '@agentowners/core'
import { ZodError } from 'zod'

export function registerValidate(program: Command): void {
  program
    .command('validate [policy-path]')
    .description('Validate an AGENTOWNERS policy file')
    .action(async (policyPath?: string) => {
      const resolved = path.resolve(
        process.cwd(),
        policyPath ?? '.github/AGENTOWNERS.yml',
      )

      try {
        await loadPolicyFile(resolved)
        process.stdout.write('AGENTOWNERS policy valid.\n')
        process.exit(0)
      } catch (err: unknown) {
        process.stderr.write('Invalid AGENTOWNERS policy:\n')

        if (err instanceof ZodError) {
          for (const issue of err.issues) {
            process.stderr.write(`- ${issue.path.join('.')} ${issue.message}\n`)
          }
        } else if (err instanceof Error) {
          // PolicyLoadError wraps the ZodError in its message; unwrap if possible
          const inner = (err as { cause?: unknown }).cause
          if (inner instanceof ZodError) {
            for (const issue of inner.issues) {
              process.stderr.write(`- ${issue.path.join('.')} ${issue.message}\n`)
            }
          } else {
            process.stderr.write(`- ${err.message}\n`)
          }
        } else {
          process.stderr.write(`- ${String(err)}\n`)
        }

        process.exit(1)
      }
    })
}
