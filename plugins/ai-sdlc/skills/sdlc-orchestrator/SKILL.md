---
name: sdlc-orchestrator
description: "Orchestrates the full AI-SDLC pipeline for a Jira issue: intake -> implement -> verify -> automate -> run-ci -> ship, evaluating a gate between every stage and stopping on the first failure. Use when the user runs /sdlc:run. Owns stage sequencing, gate evaluation, and the run status log."
allowed-tools: Read, Write, Edit, Bash, mcp__jira, mcp__github, mcp__jenkins, mcp__playwright
---

# sdlc-orchestrator — Full pipeline driver

Run all six stages in order for one Jira issue, gating between each. Delegate each stage to its own skill; this skill only sequences, gates, and reports.

## Stage map

| # | Stage | Skill | Success artifact | Gate to advance |
|---|-------|-------|------------------|-----------------|
| 1 | intake | `jira-intake` | `.sdlc/<ID>/spec.md` | spec exists with ≥1 acceptance criterion |
| 2 | implement | `code-generation` | feature branch + `implement.md` | branch committed; project still builds |
| 3 | verify | `app-verification` | `verify.md` | overall `PASS` |
| 4 | automate | `playwright-automation` | `automation.md` | suite green locally; every AC covered |
| 5 | run-ci | `jenkins-integration` | `ci.md` | verdict `GREEN` (Jenkins `SUCCESS`) |
| 6 | ship | `merge-gate` | `shipped.md` | green + 100% pass + fresh + **PR approved**; PR merged to `main` |

Gate thresholds are configurable in `plugins/ai-sdlc/config/pipeline.yaml`.

## Procedure

1. **Resolve inputs.** Jira key from the argument; target repo from `--repo` or `repos.yaml`. Create `.sdlc/<ID>/` and initialize `run.md` (status table).

2. **Run stages 1→6.** For each stage:
   - load and follow the stage skill,
   - on completion, evaluate the gate from the table above,
   - update `run.md` (stage, status, artifact, timestamp),
   - **gate fails → STOP.** Print the failing gate, the artifact to inspect, and the suggested loop-back command. Do not continue.
   - gate passes and not `--auto` → pause and show the checkpoint summary before the next stage. With `--auto`, continue automatically (the stage-6 gate is still hard).

3. **Honor `--stop-before <stage>`.** Run up to but excluding that stage (e.g. `--stop-before ship` = full dry run through CI, no merge).

4. **Finish.** When stage 6 completes, print the PR URL, merge SHA, Jenkins build URL, and Jira status. If the run stopped early, print exactly where and why.

## Loop-back rules

- Stage 3 FAIL or stage 5 failing tests that are **product** defects → loop to stage 2 (`code-generation`).
- Stage 5 failing tests that are **test** defects (bad locator/assertion) → loop to stage 4 (`playwright-automation`).
- Re-run only from the failed stage forward; do not redo passed stages unless their inputs changed.

## Non-negotiables

- Feature branches only; `main` is touched solely by stage 6's gated, approved merge.
- The stage-6 gate requires a fresh green Jenkins report for the branch tip **and** a human PR approval — no exceptions, including `--auto`. Under `--auto`, stage 6 opens the PR and **pauses** at "awaiting approval" rather than merging; the run completes when someone approves and re-runs `/sdlc:ship`.
- Never fabricate a stage result to advance. A missing/failed artifact is a stop, not a warning.

See `references/pipeline-flow.md` for the end-to-end diagram and the gate rationale.
