// Policy profiles — spec section 18

export const PROFILES: Record<string, string> = {
  minimal: `version: 1

defaults:
  known_agent: require_approval
  unknown_agent: require_approval
  docs_only: allow
  workflows: block
  secrets: block

rules:
  - name: "Allow docs-only changes"
    when:
      docs_only: true
    effect: allow
    reason: "Docs-only changes are low risk."

  - name: "Block workflow edits"
    when:
      files:
        - ".github/workflows/**"
    effect: block
    reason: "Agents may not modify GitHub Actions workflows."

  - name: "Require approval for dependency changes"
    when:
      changes_package_files: true
    effect: require_approval
    reason: "Dependency changes require maintainer review."
`,

  'strict-oss': `version: 1

defaults:
  known_agent: require_approval
  unknown_agent: require_approval
  docs_only: require_approval
  workflows: block
  secrets: block

rules:
  - name: "Block sensitive paths"
    when:
      files:
        - ".github/workflows/**"
        - ".github/actions/**"
        - "**/auth/**"
        - "**/security/**"
        - "**/permissions/**"
        - "infra/**"
        - "terraform/**"
        - "k8s/**"
    effect: block
    reason: "Agents may not modify sensitive operational or security paths."

  - name: "Require approval for large diffs"
    when:
      diff_lines_over: 300
    effect: require_approval
    reason: "Large AI-generated diffs are hard to review safely."

  - name: "Require approval for dependencies"
    when:
      changes_package_files: true
    effect: require_approval
    reason: "Dependency changes can affect supply-chain risk."
`,

  'security-sensitive': `version: 1

defaults:
  known_agent: require_approval
  unknown_agent: block
  docs_only: require_approval
  workflows: block
  secrets: block

rules:
  - name: "Block unknown agents"
    when:
      agents:
        - "unknown"
    effect: block
    reason: "Unknown agents cannot act in this repository."

  - name: "Block all workflow edits"
    when:
      files:
        - ".github/workflows/**"
    effect: block
    reason: "CI/CD workflows must be edited by humans."

  - name: "Block auth/security edits"
    when:
      files:
        - "**/auth/**"
        - "**/security/**"
        - "**/permissions/**"
    effect: block
    reason: "Security-sensitive code must be changed by accountable humans."

  - name: "Require approval for test changes"
    when:
      files:
        - "**/*.test.*"
        - "**/*.spec.*"
        - "tests/**"
    effect: require_approval
    reason: "Agents may weaken tests accidentally."
`,
};

export function getProfile(name: string): string | null {
  return PROFILES[name] ?? null;
}
