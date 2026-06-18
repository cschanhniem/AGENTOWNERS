---
name: CMD-agents-team
description: >
  Complete self-contained protocol for running ONE cmd (Command Code) agent team
  on ONE specific task in the stophunter trading repo. Covers the entire lifecycle:
  classify → plan → bootstrap worktrees → dispatch cmd agents → poll → review →
  merge. No external skill files needed — everything is here. Read this before
  starting any non-trivial task.
---

# CMD-agents-team — One Team, One Task, cmd Agents Only

> **Why this exists.** Implementing a task in the main session reads and rewrites
> many files in-context — the most expensive thing the main loop can do. A `cmd`
> agent does that work in its own context window and reports back a small summary.
> The main session spends tokens only on planning and reviewing. **Delegation is
> the default; inline implementation is the exception.**

`cmd` is the Command Code CLI (on `PATH` as `cmd`). It runs non-interactively.
All agents in this protocol use it exclusively. (`claude -p …` accepts the same
core flags and is a drop-in fallback if `cmd` is unavailable.)

This repo is a **Python 3.11+ cryptocurrency trading system** (Binance + Hyperliquid
futures, MongoDB). The authoritative rails are `AGENTS.md`, `CLAUDE.md`, the nearest
nested `AGENTS.md`/`diagrams.md`, and `docs/START_HERE.md`. Read them first; they win
over this protocol on any conflict.

---

## Step 0 — Classify: trivial or non-trivial?

| Class | Definition | Action |
|-------|------------|--------|
| **Trivial** | One or two files, a few lines, no cross-layer reasoning. Typos, a single config flip, a one-line denylist edit, reading a file to answer a question, ≤3 tool calls. | Do it inline. No team needed. |
| **Non-trivial** | Anything else: a feature, multi-file or multi-module work, a refactor, a strategy retune, a backtest-to-live promotion, anything needing TDD, anything spanning `engine/` + `research/` + `tests/`. | **Follow this protocol in full.** Do NOT implement inline. |

When unsure, treat as non-trivial and delegate — that is the token-cheap choice.

> **Hard gate.** Live trading risk changes — sizing/notional caps, stop/TP logic,
> margin/leverage, entry gates, or any backtest-to-live promotion — are never
> "trivial." They must go through this protocol AND satisfy the mandatory rules in
> Step 6 (Oversize Position Cap, Backtest Promotion Gate, TP Drift, Diagram-First,
> 100% changed-line coverage).

---

## Step 1 — Write a sharp plan (main session only)

Before touching any file, write:
1. **The user-visible problem** — what is broken or missing?
2. **Evidence it exists** — grep, test output, live-history audit, backtest result.
3. **Smallest change that fixes it** — one sentence.
4. **Verification** — how will you know it's done? (which test, which gate)

Then decompose into **agent tasks**: each agent owns a **disjoint directory
subtree** so no two agents edit the same file. Natural disjoint surfaces in this repo:

- `engine/<strategy>/` (e.g. `engine/squeeze/`, `engine/hyperliquid_squeeze/`, `engine/chartart_bb_rsi/`, `engine/handlers/`)
- `research/<lane>/` (e.g. `research/hyperliquid_squeeze/`, `research/chartart_bb_rsi/`)
- `tests/`
- `market-making/` or `market-making-hyperliquid/`
- `config/`
- `docs/`

Write one task file per agent (≤30 lines each).

---

## Step 2 — Bootstrap (once per session)

```bash
REPO=$(git rev-parse --show-toplevel)
BASE=$(git rev-parse HEAD)

# Create coordination directory (gitignored)
mkdir -p "$REPO/.cmd-fleet"/{briefs,tasks,reports}
grep -q "^\.cmd-fleet" "$REPO/.gitignore" 2>/dev/null || echo ".cmd-fleet/" >> "$REPO/.gitignore"

# Create one worktree per agent (A, B, C, … — only as many as needed)
for X in A B C; do
  WT="$REPO/../stophunter-fleet-${X}"
  BR="feat/fleet-${X}"
  if [ -d "$WT" ]; then
    git -C "$WT" checkout "$BR" 2>/dev/null || git -C "$WT" checkout -b "$BR"
    git -C "$WT" reset --hard "$BASE"
  else
    git worktree add -B "$BR" "$WT" "$BASE"
  fi
done
```

> **No per-worktree venv.** `.venv/` is gitignored, so worktrees have no
> interpreter of their own. Agents must activate the **main repo venv by absolute
> path** before running anything:
> `source "$REPO/.venv/bin/activate"` (then `cd` into the worktree to run tests).
> If `.venv` is missing/broken, rebuild it once in the main repo:
> `python3 -m venv --clear "$REPO/.venv" && "$REPO/.venv/bin/pip" install -r "$REPO/requirements.txt"`.

> Only create worktrees for agents you will actually dispatch. Two agents for an
> engine+research split, one for a docs-only task, three for a larger decomposition.

---

## Step 3 — Write task files

Each task file lives at `$REPO/.cmd-fleet/tasks/<X>-r<NN>.md` (≤30 lines):

```md
# Task for agent <X> — round <NN>

## What to do
<one-sentence description of the exact change>

## Files in scope (stay inside these only)
- <path/to/file or subtree/>

## Diagrams to update FIRST (Diagram-First Rule)
- <module>/diagrams.md — state machine + sequence + data-flow for the new behavior
  (create it if the module has none)

## Tests to write first (TDD — write failing tests before implementing)
- <test file> — <what it asserts>

## Verification gate (must pass before committing)
- source "$REPO/.venv/bin/activate"
- cd "$REPO/../stophunter-fleet-<X>"
- pytest tests/ --tb=short --cov=. --cov-branch --cov-report=xml -q
- diff-cover coverage.xml --compare-branch origin/main --fail-under 100
- (if engine VH paths touched) sh scripts/typecheck_vh.sh
- (targeted) pytest tests/test_<module>.py --cov=engine.<module> --cov-report=term-missing

## Done means
- Diagrams updated first; tests written first; gate green; config/docs updated in same commit
- Report written to $REPO/.cmd-fleet/reports/<X>-r<NN>.md
- Branch pushed: git push -u origin feat/fleet-<X>
- main untouched
```

---

## Step 4 — Dispatch agents (staggered, background jobs)

Launch 2–3 agents per wave, 15–30 s apart to avoid API rate-limit errors.

```bash
REPO=$(git rev-parse --show-toplevel)

# Wave 1 — first batch
for X in A B; do
  cd "$REPO/../stophunter-fleet-${X}" && \
  nohup cmd \
    -p "You are fleet agent ${X} in the stophunter trading repo. Read
$REPO/.cmd-fleet/tasks/${X}-r01.md and do exactly that task. Stay inside the files
listed there. Activate the main venv first: source $REPO/.venv/bin/activate. Follow
AGENTS.md and CLAUDE.md rails and the Mandatory Rules: (1) Diagram-First — update the
module's diagrams.md BEFORE code; (2) Unit Test Rule — TDD, 100% coverage of changed
lines (diff-cover --fail-under 100), branch coverage on stop_manager modules;
(3) TP Drift Rule — any directional strategy keeps _apply_hourly_tp_drift semantics +
tests; (4) Oversize Position Cap — adjusted per-entry notional capped at <= portfolio
value; (5) Backtest Promotion Gate — any promotion needs a Promotion Gate Evidence
section; (6) Config is single source of truth — no hardcoded params; (7) never touch
research/archived/ or scripts/archived-no-use/; (8) run from repo root. Tests first —
write failing tests, confirm they fail, then implement. Run the verification gate.
Update diagrams/config/docs in the SAME commit. Commit with a conventional message.
Push your branch. Write your report to $REPO/.cmd-fleet/reports/${X}-r01.md (<=40 lines)." \
    --add-dir "$REPO/.cmd-fleet" \
    --skip-onboarding \
    --permission-mode auto-accept \
    --yolo \
    -t \
    --max-turns 60 \
    > "/tmp/fleet-agent-${X}.log" 2>&1 &
  echo "Launched ${X} (PID $!)"
done

sleep 20

# Wave 2 — next batch
for X in C; do
  cd "$REPO/../stophunter-fleet-${X}" && \
  nohup cmd \
    -p "You are fleet agent ${X} in the stophunter trading repo. Read
$REPO/.cmd-fleet/tasks/${X}-r01.md and do exactly that task. Stay inside the files
listed there. Activate the main venv: source $REPO/.venv/bin/activate. Follow AGENTS.md
and CLAUDE.md rails and the Mandatory Rules (Diagram-First, 100% changed-line coverage,
TP Drift, Oversize Position Cap, Backtest Promotion Gate). Tests first. Run the
verification gate. Commit and push. Write your report to
$REPO/.cmd-fleet/reports/${X}-r01.md (<=40 lines)." \
    --add-dir "$REPO/.cmd-fleet" \
    --skip-onboarding \
    --permission-mode auto-accept \
    --yolo \
    -t \
    --max-turns 60 \
    > "/tmp/fleet-agent-${X}.log" 2>&1 &
  echo "Launched ${X} (PID $!)"
done
```

**Verified flags:** `-p "<prompt>"` (non-interactive), `--max-turns <n>`,
`--yolo` (skip tool prompts), `--add-dir <dir>`, `--skip-onboarding`,
`--permission-mode auto-accept`, `-t` / `--trust` (trust new worktree dir —
**required**, else agent blocks on the project-trust prompt and exits with 0 edits).

**Do NOT use `-m`** unless you know the model is in the account plan.
**Do NOT use `tmux`** — `cmd` hangs in detached tmux sessions (no live PTY).

---

## Step 5 — Poll for completion

The report file at `$REPO/.cmd-fleet/reports/<X>-r<NN>.md` is the completion
signal. Poll manually — do not busy-wait.

```bash
REPO=$(git rev-parse --show-toplevel)

# Which agents are still alive?
ps aux | grep "[c]md" | grep -v grep | awk '{printf "PID %-6s CPU %s%%\n", $2, $3}'

# Files each agent has touched (empty = not started writing yet — NOT dead)
for X in A B C; do
  echo "--- fleet-${X} ---"
  git -C "$REPO/../stophunter-fleet-${X}" diff --stat 2>/dev/null | tail -1
done

# Reports = agent finished
ls -l "$REPO/.cmd-fleet/reports/"*-r*.md 2>/dev/null
```

### Liveness rules (hard-won — check ALL before concluding an agent "died")

1. **`-p` mode buffers stdout until exit.** The log file stays 0 bytes for the
   entire run and only fills when the agent exits. **Never infer "dead" from an
   empty log.** Use the worktree diff as the liveness signal.

2. **An agent is alive iff its PID exists AND its worktree diff grows.** Check
   both. A PID with a frozen diff for >4 min = hung agent.

3. **Poll-grep must match a string actually in the process args.** The worktree
   path is NOT in `ps` output — only the `-p "…"` prompt text and `--add-dir`
   paths are. Grep for a token you embedded in the task file path (e.g. the round
   tag `r01`) to identify which agents belong to this dispatch.

4. **Confirm liveness two ways before relaunching:** (a) `ps aux | grep "[c]md" |
   grep r01` shows the PID, AND (b) `git -C <worktree> diff --stat` is non-empty/
   growing. A false "dead" that triggers a relaunch puts two agents on the same
   branch — a collision. If you accidentally relaunch, `kill` the duplicate
   immediately and keep the original.

5. **`-t` / `--trust` is mandatory for fresh worktrees.** Without it the agent
   blocks on the project-trust prompt and exits with 0 bytes output and 0 edits.
   Symptom: empty log + empty `git diff` within 30 s of launch.

### Stuck / looping agent recovery

Signs:
- Diff unchanged across two polls AND no report → **hung**.
- Same file rewritten repeatedly, test re-run with no diff → **looping**.
- Process gone, no report → **crashed**.
- Process gone, report says "capped at max-turns" → **capped** (cmd exits 8).

Response:
1. `kill <PID>` (or let it time out).
2. Diagnose from `git log` + `git diff`, not by reading implementation files.
3. Write a tighter task file (`tasks/<X>-r02.md`) — smaller scope, exact next
   step, explicit "skip X, do only Y."
4. Fix env blockers (raise `--max-turns`, rebuild `.venv`, pre-create a missing
   dir) before re-dispatching.
5. Three strikes → do the one-line change yourself and move on.

---

## Step 6 — Review (main session only — keep it cheap)

When a report appears, read **only**:

1. `$REPO/.cmd-fleet/reports/<X>-r<NN>.md` — the agent's self-report.
2. `git -C "$REPO/../stophunter-fleet-${X}" log --oneline origin/main..HEAD` — what
   the agent actually committed (real signal vs worktree noise).
3. **Re-run the gate yourself** — never trust the self-report for green. Read
   only the tail (~15 lines):

```bash
WT="$REPO/../stophunter-fleet-${X}"
source "$REPO/.venv/bin/activate"

# Coverage gate (changed lines must be 100%)
cd "$WT" && \
  pytest tests/ --tb=line --cov=. --cov-branch --cov-report=xml -q 2>&1 | tail -15 && \
  diff-cover coverage.xml --compare-branch origin/main --fail-under 100 2>&1 | tail -15

# VH typecheck (only if engine VH paths touched)
cd "$WT" && sh scripts/typecheck_vh.sh 2>&1 | tail -15

# Docs/config-only agents: confirm only the intended subtree changed
git -C "$WT" diff origin/main --stat
```

4. Spot-check **one or two risk hunks only** — look for Mandatory-Rule violations:
   - **Oversize Position Cap**: new sizing path that doesn't cap adjusted per-entry
     notional at ≤ portfolio/collateral value (and adjust qty down, not reject)?
   - **TP Drift**: new directional strategy missing `_apply_hourly_tp_drift` or its tests?
   - **Config single source of truth**: hardcoded param that belongs in a YAML?
   - **Diagram-First**: structural change without a `diagrams.md` update in the same commit?
   - **Backtest Promotion Gate**: a promotion lacking a `Promotion Gate Evidence` section,
     or promoted on raw PnL while primary quality factors regress?
   - **Deprecated code**: edits under `research/archived/` or `scripts/archived-no-use/`?

### Acceptance checklist (reject unless ALL hold)

- [ ] Work confined to the subtree assigned in the task file.
- [ ] Diagrams updated first; tests written before/with code; bug fix has a failing-first regression test.
- [ ] Coverage gate: `diff-cover --fail-under 100` passes; branch coverage on any touched `stop_manager.py`; zero test failures.
- [ ] VH typecheck clean if `engine/run_vh.py`, `engine/positions/bracket_orders.py`, or `engine/handlers/variance_harvest.py` were touched.
- [ ] Mandatory Rules hold (Diagram-First, Unit Test, TP Drift, Oversize Position Cap, Backtest Promotion Gate, config single source of truth).
- [ ] No params hardcoded that belong in `config/*.yaml`; flow `YAML → Config → Executor → Handler` preserved.
- [ ] Every cited path/command/test actually exists — no hallucination.
- [ ] Branch pushed; `main` untouched.

**Stale-base overwrite check (run on every docs/spec-touching agent):**
```bash
git -C "$REPO/../stophunter-fleet-${X}" diff origin/main -- docs/ AGENTS.md \
  | grep "^-" | grep -E "^-## |^-### "
```
Unexpected deletions of section headings = stale-base overwrite → **reject**.

### Verdict

- **APPROVE** → proceed to merge.
- **REJECT** → write `tasks/<X>-r<NN+1>.md` with the precise fix required; same
  agent fixes it.
- **SUGGEST** → accept direction, request sharpening (add the regression test,
  cover the edge case, update the diagram).

---

## Step 7 — Merge

```bash
REPO=$(git rev-parse --show-toplevel)
BRANCH="feat/fleet-${X}"
WT="$REPO/../stophunter-fleet-${X}"

# Rebase onto latest main before merging
git fetch origin main
git -C "$WT" rebase origin/main   # resolve any conflict here

# Re-run the gate after rebase (rebase may have broken something)
# (same gate commands as Step 6)

# Fast-forward merge
git checkout main
git merge --ff-only "$BRANCH"
git push origin main

echo "Merged $BRANCH"
```

Merge agents in dependency order (e.g. `engine/` changes before the `research/`
parity that depends on them). Resolve hot-file combinations (`AGENTS.md`,
`config/*.yaml`, shared `tests/` files, `engine/risk/`) by hand during rebase —
keep both agents' additions.

**Never merge a branch you have not gated.** Local hooks (`core.hooksPath .hooks`)
run the VH typecheck on commit/push — keep them enabled.

---

## Step 8 — Re-assign or close

After each merge, immediately assign the agent its next task from the plan, OR
close out the round when the plan is complete.

To clean up a finished worktree:
```bash
git worktree remove "$REPO/../stophunter-fleet-${X}" --force 2>/dev/null
git branch -D "feat/fleet-${X}" 2>/dev/null
```

---

## Quick reference

| Situation | Action |
|-----------|--------|
| One/two-file trivial change | Inline edit — skip this protocol |
| Live trading risk change / backtest promotion | Always this protocol + Mandatory Rules gate |
| Non-trivial task on one surface | Follow this protocol (one team) |
| Task needs 2+ disjoint surfaces | Run multiple parallel agents (A=`engine/x`, B=`research/x`, C=`tests/`), each with its own task file and worktree |
| Agent shows empty log at 2 min | Check git diff, NOT the log — `-p` mode buffers until exit |
| Agent shows empty git diff at 2 min AND PID exists | Likely stuck on trust prompt — verify `-t` was passed |
| Agent errors on `pip`/imports | `.venv` not activated by absolute path, or venv broken — rebuild in main repo |
| Two polls with zero diff growth + no report | Hung — kill, tighten task, relaunch |
| Gate passes but diagrams/coverage missing | Mandatory-Rule violation — reject, do not merge |
