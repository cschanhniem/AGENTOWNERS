#!/usr/bin/env node
// @agent-owners/cli entry point

import { Command } from 'commander'
import { registerInit } from './commands/init.js'
import { registerValidate } from './commands/validate.js'
import { registerCheck } from './commands/check.js'
import { registerExplain } from './commands/explain.js'
import { registerFingerprint } from './commands/fingerprint.js'

const program = new Command()

program
  .name('agentowners')
  .description('CODEOWNERS for AI agents')
  .version('0.1.0')

registerInit(program)
registerValidate(program)
registerCheck(program)
registerExplain(program)
registerFingerprint(program)

program.parse(process.argv)
