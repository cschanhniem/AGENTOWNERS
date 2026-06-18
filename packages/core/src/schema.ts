import { z } from 'zod'
import type { AgentOwnersPolicy } from './types.js'

export const agentActionSchema = z.enum([
  'open_pr',
  'update_pr',
  'comment',
  'review_comment',
  'approve_pr',
  'request_changes',
  'label_issue',
  'close_issue',
  'reopen_issue',
  'assign_issue',
  'edit_workflows',
  'modify_tests',
  'modify_docs',
  'modify_dependencies',
  'modify_auth',
  'modify_infra',
  'touch_secrets',
  'change_permissions',
  'merge_pr',
])

export const agentDetectionConfidenceSchema = z.enum([
  'confirmed',
  'likely',
  'possible',
  'unknown',
])

const agentPolicySchema = z.object({
  match: z.object({
    actors: z.array(z.string()).optional(),
    commitEmails: z.array(z.string()).optional(),
    commitNames: z.array(z.string()).optional(),
    prTitlePatterns: z.array(z.string()).optional(),
    bodyPatterns: z.array(z.string()).optional(),
    labels: z.array(z.string()).optional(),
  }),
  allowed: z.array(agentActionSchema).optional(),
  requires_approval: z.array(agentActionSchema).optional(),
  blocked: z.array(agentActionSchema).optional(),
})

export const defaultPolicySchema = z.object({
  unknown_agent: z.enum(['allow', 'require_approval', 'block']).optional(),
  known_agent: z.enum(['allow', 'require_approval', 'block']).optional(),
  docs_only: z.enum(['allow', 'require_approval', 'block']).optional(),
  workflows: z.enum(['allow', 'require_approval', 'block']).optional(),
  secrets: z.enum(['allow', 'require_approval', 'block']).optional(),
})

const auditConfigSchema = z.object({
  enabled: z.boolean().optional(),
  output: z.string().optional(),
})

export const ruleConditionSchema = z.object({
  agents: z.array(z.string()).optional(),
  actors: z.array(z.string()).optional(),
  actions: z.array(agentActionSchema).optional(),
  files: z.array(z.string()).optional(),
  files_not: z.array(z.string()).optional(),
  labels: z.array(z.string()).optional(),
  pr_title: z.array(z.string()).optional(),
  pr_body: z.array(z.string()).optional(),
  issue_title: z.array(z.string()).optional(),
  issue_body: z.array(z.string()).optional(),
  diff_lines_over: z.number().optional(),
  commits_over: z.number().optional(),
  changes_package_files: z.boolean().optional(),
  changes_workflows: z.boolean().optional(),
  changes_permissions: z.boolean().optional(),
  changes_auth: z.boolean().optional(),
  changes_infra: z.boolean().optional(),
  docs_only: z.boolean().optional(),
  tests_only: z.boolean().optional(),
})

export const ruleSchema = z.object({
  name: z.string(),
  when: ruleConditionSchema,
  effect: z.enum(['allow', 'require_approval', 'block']),
  reviewers: z.array(z.string()).optional(),
  labels: z.array(z.string()).optional(),
  reason: z.string(),
})

export { agentPolicySchema }

export const agentOwnersPolicySchema = z.object({
  version: z.literal(1),
  agents: z.record(z.string(), agentPolicySchema).optional(),
  defaults: defaultPolicySchema.optional(),
  rules: z.array(ruleSchema).optional(),
  audit: auditConfigSchema.optional(),
})

// Keep legacy export for backward compatibility
export const AgentOwnersPolicySchema = agentOwnersPolicySchema

export function parsePolicy(input: unknown): AgentOwnersPolicy {
  return agentOwnersPolicySchema.parse(input) as AgentOwnersPolicy
}
