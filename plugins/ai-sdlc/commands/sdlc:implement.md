---
name: sdlc:implement
description: "Stage 2 — generate/modify code on a feature branch to satisfy the work spec."
argument-hint: "<JIRA-ID> [--repo <name>]"
allowed-tools: Read, Write, Edit, Bash, mcp__github
---

# /sdlc:implement — Generate code from the spec

Take the work spec from stage 1 and implement it as code on a dedicated feature branch.

## Prerequisite

`.sdlc/<JIRA-ID>/spec.md` must exist (run `/sdlc:intake <JIRA-ID>` first). If missing, stop and say so.

## Steps

1. Parse the Jira key. Read `.sdlc/<JIRA-ID>/spec.md`.
2. Load the `code-generation` skill: `plugins/ai-sdlc/skills/code-generation/SKILL.md`. Follow it.
3. In the target repo, create/switch to `feature/<JIRA-ID>-<slug>`. Never work on `main`.
4. Implement the change to satisfy every acceptance criterion. Delegate to the `code-implementer` agent for larger changes.
5. Commit with a message referencing the Jira key. Update `.sdlc/<JIRA-ID>/spec.md` with the branch name and a per-criterion implementation note.

## Output contract

- A committed feature branch in the target repo.
- Each acceptance criterion mapped to the code that addresses it.
- Next: `/sdlc:verify <JIRA-ID>`.
