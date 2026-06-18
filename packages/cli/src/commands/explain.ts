import * as fs from 'fs'
import * as path from 'path'
import { Command } from 'commander'
import type { Decision } from '@agent-owners/core'

export function registerExplain(program: Command): void {
  program
    .command('explain')
    .description('Explain a decision JSON file')
    .option('--decision <path>', 'Path to decision JSON file', 'decision.json')
    .action((options: { decision: string }) => {
      const filePath = path.resolve(process.cwd(), options.decision)

      let raw: string
      try {
        raw = fs.readFileSync(filePath, 'utf8')
      } catch {
        process.stderr.write(`Error: cannot read decision file at ${filePath}\n`)
        process.exit(1)
      }

      let decision: Decision
      try {
        decision = JSON.parse(raw) as Decision
      } catch {
        process.stderr.write(`Error: ${filePath} is not valid JSON\n`)
        process.exit(1)
      }

      const lines: string[] = []

      lines.push(`Decision: \x1b[1m${decision.effect.toUpperCase()}\x1b[0m`)
      lines.push('')

      if (decision.explanation) {
        lines.push(decision.explanation)
        lines.push('')
      }

      lines.push(`Risk score: ${decision.riskScore} (${decision.riskLevel})`)
      lines.push('')

      if (decision.matchedRules.length > 0) {
        lines.push('Matched rules:')
        for (const rule of decision.matchedRules) {
          lines.push(`  - ${rule.name} → ${rule.effect}`)
          if (rule.reason) lines.push(`      ${rule.reason}`)
        }
        lines.push('')
      }

      if (decision.detectedActions.length > 0) {
        lines.push(`Detected actions: ${decision.detectedActions.join(', ')}`)
        lines.push('')
      }

      if (decision.requiredReviewers.length > 0) {
        lines.push(`Required reviewers: ${decision.requiredReviewers.join(', ')}`)
        lines.push('')
      }

      if (decision.labelsToApply.length > 0) {
        lines.push(`Labels to apply: ${decision.labelsToApply.join(', ')}`)
        lines.push('')
      }

      process.stdout.write(lines.join('\n'))
    })
}
