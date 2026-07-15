---
name: jira-intake
description: "Stage 1 of the AI-SDLC pipeline. Fetch a Jira issue via the Jira MCP, extract acceptance criteria, resolve the target repo, and write a machine-actionable work spec to .sdlc/<JIRA-ID>/spec.md. Use when the user runs /sdlc:intake or /sdlc:run, or asks to pull a requirement from Jira."
allowed-tools: Read, Write, Bash, mcp__jira
---

# jira-intake — Requirement intake from Jira

Turn a Jira issue into `.sdlc/<JIRA-ID>/spec.md`, the single source of truth for the rest of the pipeline.

## Inputs

- A Jira issue key (`[A-Z]+-\d+`).
- `plugins/ai-sdlc/config/repos.yaml` (project → repo mapping).

## Source resolution (in order)

The issue text comes from the first source that resolves — this lets the pipeline run
with or without a live Jira:

1. **Local ticket file** — if `tickets/<JIRA-ID>.md` exists at the repo root, use it as
   the authoritative issue (summary, description, acceptance criteria). This is the
   "simulated Jira" mode for local/offline runs and demos.
2. **Jira MCP** — otherwise fetch via the Jira MCP (`getJiraIssue` /
   `searchJiraIssuesUsingJql`, or `mcp-atlassian`'s issue tools).
3. **Paste** — if neither resolves, ask the user to paste the issue text and continue.

Record which source was used in the spec's `Jira:` line (e.g. `local:tickets/DEMO-1.md`).

## Procedure

1. **Fetch the issue** from the resolved source above. Retrieve: summary, description,
   issue type, status, labels, components, and (for Jira) comments.

2. **Extract acceptance criteria.** Look, in order, for:
   - a "Acceptance Criteria" / "AC" section in the description,
   - Gherkin (`Given/When/Then`) blocks,
   - a checklist in the description or a comment.
   Normalize each into a single testable statement. If none exist, derive 3–6 criteria from the description and **flag them as inferred** for the user to confirm.

3. **Resolve the target repo.** Precedence: explicit `--repo` → `repos.yaml` mapping for the issue's project key → ask the user. Record repo name, path, and default branch.

4. **Derive the branch name.** `feature/<JIRA-ID>-<slug>` where `<slug>` is a kebab-cased, ≤6-word summary.

5. **Write the spec.** Create `.sdlc/<JIRA-ID>/spec.md` using the template below. Overwrite only after showing a diff if it already exists.

6. **Report.** Print the spec path and a 3-line summary (title, criteria count, target repo). Do not write code.

## Spec template

```markdown
# <JIRA-ID> — <summary>

- **Jira:** <issue URL>
- **Type / status:** <type> / <status>
- **Target repo:** <name> (<path>), base branch `<default>`
- **Feature branch:** feature/<JIRA-ID>-<slug>

## Context
<2–4 sentences distilled from the description>

## Acceptance criteria
- [ ] AC1: <testable statement>
- [ ] AC2: <testable statement>
- [ ] ...

## Out of scope
- <anything the issue explicitly excludes, or "none stated">

## Open questions
- <blocking ambiguities, or "none">

## Pipeline notes
<!-- later stages append: branch, per-AC impl notes, verify/automation/ci status -->
```

## Guardrails

- Never invent acceptance criteria silently — inferred ones must be labeled and confirmed.
- Do not modify the Jira issue in this stage (transitions/comments happen in `merge-gate`).
- Stop with a clear message if the issue key is invalid or the issue cannot be fetched and the user provides no text.

## Handoff

Success → `/sdlc:implement <JIRA-ID>` (`code-generation` skill) consumes `spec.md`.
