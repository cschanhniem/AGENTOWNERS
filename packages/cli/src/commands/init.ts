import * as fs from 'fs'
import * as path from 'path'
import { Command } from 'commander'
import { getProfile } from '@agent-owners/core'

export function registerInit(program: Command): void {
  program
    .command('init')
    .description('Create a new AGENTOWNERS policy file from a profile')
    .option(
      '--profile <name>',
      'Policy profile: minimal | strict-oss | security-sensitive',
      'minimal',
    )
    .option('--output <path>', 'Output path', '.github/AGENTOWNERS.yml')
    .option('--force', 'Overwrite existing file', false)
    .action((options: { profile: string; output: string; force: boolean }) => {
      const { profile, output, force } = options

      const content = getProfile(profile)
      if (content === null) {
        process.stderr.write(
          `Error: unknown profile "${profile}". Valid profiles: minimal, strict-oss, security-sensitive\n`,
        )
        process.exit(1)
      }

      const outputPath = path.resolve(process.cwd(), output)

      if (fs.existsSync(outputPath) && !force) {
        process.stderr.write(
          `Error: ${outputPath} already exists. Use --force to overwrite.\n`,
        )
        process.exit(1)
      }

      const dir = path.dirname(outputPath)
      fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(outputPath, content, 'utf8')

      process.stdout.write(`\x1b[32m✓\x1b[0m Created ${outputPath} (profile: ${profile})\n`)
    })
}
