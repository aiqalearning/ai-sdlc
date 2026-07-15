---
name: sdlc:intake
description: "Stage 1 — pull a Jira issue, extract acceptance criteria, and write the work spec."
argument-hint: "<JIRA-ID> [--repo <name>]"
allowed-tools: Read, Write, Bash, mcp__jira
---

# /sdlc:intake — Requirement intake from Jira

Pull the Jira issue given as the argument and turn it into a machine-actionable **work spec** that the rest of the pipeline consumes.

## Steps

1. Parse the argument for a Jira key matching `[A-Z]+-\d+`. If none, ask the user for the issue key and stop.
2. Load the `jira-intake` skill: `plugins/ai-sdlc/skills/jira-intake/SKILL.md`. Follow it exactly. It resolves the issue from `tickets/<JIRA-ID>.md` (simulated-Jira / local mode) if present, otherwise the Jira MCP, otherwise pasted text.
3. Resolve the target repo: `--repo <name>` if given, else map from the issue's project via `plugins/ai-sdlc/config/repos.yaml`. If unresolved, ask and stop.
4. The skill writes `.sdlc/<JIRA-ID>/spec.md` (summary, acceptance criteria as a checklist, scope, target repo, branch name). Print the spec path and a 3-line summary.

## Output contract

- `.sdlc/<JIRA-ID>/spec.md` exists with a non-empty acceptance-criteria checklist.
- Next: `/sdlc:implement <JIRA-ID>`.

Do not generate code in this stage.
