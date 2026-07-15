---
name: code-generation
description: "Stage 2 of the AI-SDLC pipeline. Implement the work spec as code on a feature branch in the target repo, mapping each acceptance criterion to concrete changes, then commit. Use when the user runs /sdlc:implement or /sdlc:run reaches the implement stage."
allowed-tools: Read, Write, Edit, Bash, mcp__github
---

# code-generation — Generate code from the spec

Implement `.sdlc/<JIRA-ID>/spec.md` as working code on `feature/<JIRA-ID>-<slug>`.

## Preconditions

- `.sdlc/<JIRA-ID>/spec.md` exists with acceptance criteria. If not, stop and tell the user to run `/sdlc:intake`.
- The target repo path is known (from the spec). Confirm it is a git repo with a clean or understood working tree.

## Procedure

1. **Branch.** In the target repo: fetch, then create/switch to `feature/<JIRA-ID>-<slug>` off the base branch. Never commit to `main`/`master`.

2. **Locate the change surface.** Read the relevant existing code first. Match the repo's language, framework, structure, naming, and test conventions — do not impose new patterns.

3. **Implement per criterion.** Work criterion-by-criterion. Keep the change minimal and focused on the spec; avoid unrelated refactors. For substantial work, delegate to the `code-implementer` agent with the spec and the specific criteria as its brief.

4. **Keep it runnable.** After each meaningful change, ensure the project still builds / type-checks / lints with its existing tooling. Fix what you break.

5. **Commit.** One or a few coherent commits, each message prefixed with the Jira key, e.g. `<JIRA-ID>: add password-strength meter (AC2, AC3)`. Do not push yet — push happens in stage 5.

6. **Record.** Append to `spec.md` under "Pipeline notes": the branch name, and for each AC the file(s)/function(s) that implement it. Write `.sdlc/<JIRA-ID>/implement.md` summarizing the diff (files touched, new deps, migration/config needs).

## Guardrails

- No secrets in code — read config from env. If a criterion needs a credential, document the env var; do not hardcode.
- No direct commits to `main`. The guard hook will also block force-push to protected branches.
- If a criterion is ambiguous or blocked, stop and surface it rather than guessing.

## Handoff

Success → `/sdlc:verify <JIRA-ID>` (`app-verification` skill) boots the app and checks the flow.
