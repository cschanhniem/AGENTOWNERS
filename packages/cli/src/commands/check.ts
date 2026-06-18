import * as path from 'path'
import { Command } from 'commander'
import {
  loadPolicyFile,
  classifyFiles,
  inferActions,
  detectAgent,
  evaluatePolicy,
  renderVerdict,
} from '@agent-owners/core'
import { getChangedFiles, getCommitMessages, getCurrentActor } from '../git.js'

type CheckOptions = {
  policy: string
  base: string
  head: string
  actor?: string
  output: 'text' | 'json'
  mode: 'advisory' | 'enforcement' | 'dry-run'
}

export function registerCheck(program: Command): void {
  program
    .command('check')
    .description('Analyze changed files against AGENTOWNERS policy')
    .option('--policy <path>', 'Path to policy file', '.github/AGENTOWNERS.yml')
    .option('--base <ref>', 'Base git ref', 'main')
    .option('--head <ref>', 'Head git ref', 'HEAD')
    .option('--actor <name>', 'Actor name for agent detection')
    .option('--output <format>', 'Output format: text | json', 'text')
    .option('--mode <mode>', 'Mode: advisory | enforcement | dry-run', 'advisory')
    .action(async (options: CheckOptions) => {
      const policyPath = path.resolve(process.cwd(), options.policy)

      let policy
      try {
        policy = await loadPolicyFile(policyPath)
      } catch (err: unknown) {
        process.stderr.write(
          `Error loading policy: ${err instanceof Error ? err.message : String(err)}\n`,
        )
        process.exit(1)
      }

      const cwd = process.cwd()
      let changedFiles: string[] = []
      let commitMessages: string[] = []

      try {
        changedFiles = getChangedFiles(options.base, options.head, cwd)
      } catch {
        // not in a git repo or diff failed — continue with empty list
      }

      try {
        commitMessages = getCommitMessages(options.base, options.head, cwd)
      } catch {
        // ignore
      }

      const actor =
        options.actor ?? getCurrentActor(cwd) ?? 'unknown'

      const filesClassification = classifyFiles(changedFiles)

      const detectedActions = inferActions({
        eventType: 'pull_request.opened',
        changedFiles,
      })

      const agentDetection = detectAgent({
        actor,
        commitMessages,
        policy,
      })

      const decision = evaluatePolicy({
        policy,
        agentDetection,
        detectedActions,
        changedFiles,
        filesClassification,
        actor,
      })

      if (options.output === 'json') {
        process.stdout.write(JSON.stringify(decision, null, 2) + '\n')
      } else {
        const text = renderVerdict(decision, { actor })
        process.stdout.write(text + '\n')
      }

      // Exit code logic
      const isBlock = decision.effect === 'block'
      if (isBlock && options.mode === 'enforcement') {
        process.exit(1)
      }
      process.exit(0)
    })
}
