---
name: sdlc:run
description: "Run the full pipeline for a Jira issue: intake -> implement -> verify -> automate -> run-ci -> ship, gated between stages."
argument-hint: "<JIRA-ID> [--repo <name>] [--auto] [--stop-before ship]"
allowed-tools: Read, Write, Edit, Bash, mcp__jira, mcp__github, mcp__jenkins, mcp__playwright
---

# /sdlc:run — Full pipeline orchestration

Drive a Jira issue end-to-end to a merged PR, running each stage in order with a gate between them.

```
intake → implement → verify → automate → run-ci → ship
```

## Steps

1. Parse the Jira key. Load the `sdlc-orchestrator` skill: `plugins/ai-sdlc/skills/sdlc-orchestrator/SKILL.md`. Follow it — it owns stage sequencing, gate evaluation, and failure handling.
2. Run the six stages in order, each by loading its stage skill (same skills the individual commands use).
3. **Between every stage, evaluate the gate** defined in `plugins/ai-sdlc/config/pipeline.yaml`. A failed gate stops the run with a clear reason and the artifact to inspect.
4. Maintain a live status table in `.sdlc/<JIRA-ID>/run.md` (stage, status, artifact, timestamp).

## Flags

| Flag | Effect |
|------|--------|
| `--repo <name>` | Force the target repo (else resolved from the Jira project) |
| `--auto` | Do not pause for confirmation between passing stages (still stops on any gate failure) |
| `--stop-before <stage>` | Run up to but not including `<stage>` (e.g. `--stop-before ship` for a dry run) |

## Non-negotiables

- Feature branches only; `main` is touched solely by the stage-6 merge gate.
- The merge gate requires a fresh green Jenkins report for the branch tip. No exceptions in `--auto` mode.
- On any stage failure, stop and report; do not silently skip ahead.
