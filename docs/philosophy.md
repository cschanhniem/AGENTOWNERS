# Philosophy

## The missing governance layer

AI coding agents are becoming normal contributors in GitHub repositories. They can open PRs, comment on issues, review code, propose fixes, and trigger automation.

The missing layer is not another AI reviewer. The missing layer is **repo-native governance**:

- Which agent is acting?
- What action is it trying to perform?
- Which files, labels, issues, or PRs are affected?
- Is the action allowed?
- Does it require human approval?
- Who should review it?
- Was the decision auditable later?

## CODEOWNERS as the mental model

`CODEOWNERS` answers: *Who owns this code path?*

`AGENTOWNERS` answers: *Which agents may act here, and under what constraints?*

`AGENTS.md` answers: *How should agents work in this repo?*

These three files together give maintainers a complete picture of AI agent activity in their repository.

## Design principles

1. **Policy over prompts** — define constraints in config, not in every agent prompt
2. **Constraints over suggestions** — hard rules, not advisory guidelines
3. **Deterministic first, AI optional later** — same inputs always produce same output
4. **Maintainer control over agent autonomy** — humans set the bounds
5. **Repo-native over SaaS** — the policy lives in the repo, not in a dashboard
6. **Small config over dashboard** — one YAML file, not a UI
7. **Fail safely on sensitive actions** — unknown = require_approval, not allow
8. **Audit every decision** — every verdict is logged and explainable
9. **Complement AGENTS.md, do not replace it** — AGENTS.md is for agents, AGENTOWNERS is for maintainers
10. **First install useful in under five minutes**

## What AGENTOWNERS is not

- It is not an AI code reviewer
- It is not a hosted SaaS product
- It is not a new agent protocol
- It is not a replacement for human judgment
- It is not a silver bullet for AI security

AGENTOWNERS is a governance primitive. It gives maintainers a tool to define bounds. What agents do within those bounds is still up to the agents and their maintainers.

## The 10-year horizon

AI agents will become more capable, more autonomous, and more common in software development. The governance problem will not go away — it will grow.

AGENTOWNERS is designed to be durable:

- The policy format is versioned (`version: 1`) — future versions are additive
- The core engine is deterministic — no model drift, no API changes
- The file format is repo-native — it moves with the repo, not with a vendor
- The permission model is conservative — defaults fail closed, not open

In 2030, there will be agents that write better code than most humans. AGENTOWNERS is designed to still be useful then — because the governance problem (who may do what, where, under what conditions) does not change as agents get smarter.
