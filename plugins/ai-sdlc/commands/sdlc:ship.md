---
name: sdlc:ship
description: "Stage 6 — open the PR and merge to main ONLY when the Jenkins report is green."
argument-hint: "<JIRA-ID> [--squash|--merge|--rebase]"
allowed-tools: Read, Write, Bash, mcp__github, mcp__jira
---

# /sdlc:ship — Merge to main on green, after approval

The hard gate. Open the PR and merge the feature branch into `main` only if stage 5's Jenkins report is a fresh `SUCCESS` for that exact branch/commit at the required pass rate **and** a required reviewer has approved the PR.

## Prerequisite

Stage 5 complete with `SUCCESS` in `.sdlc/<JIRA-ID>/ci.md`.

## Gate — refuse to merge unless ALL hold

1. `.sdlc/<JIRA-ID>/ci.md` exists and result is `SUCCESS`.
2. Test pass rate meets `jenkins.min_pass_percent` (default `100` — no failures).
3. The Jenkins build ran against the **current tip** of the feature branch (compare the commit SHA). A stale green does not count.
4. No unpushed local commits on the branch.
5. **The PR is approved** — at least `merge.required_approvals` approving review(s), no "changes requested".

If any check fails, STOP and report which one. Awaiting approval is a **pause** (green, waiting on review), not a failure. Never merge on a red, missing, or stale report, or before approval.

## Steps

1. Load the `merge-gate` skill: `plugins/ai-sdlc/skills/merge-gate/SKILL.md`. Follow it.
2. Re-verify gate checks 1–4. If any fails, stop.
3. Open a PR (`base: main`, `head: feature/<JIRA-ID>-<slug>`) if one is not open. Title/body reference the Jira key and link the Jenkins build.
4. **Check approval (gate 5).** Not yet approved → stop and report the PR is green and awaiting review; the user gets it approved in GitHub, then re-runs `/sdlc:ship <JIRA-ID>`. Changes requested → stop and loop back.
5. Once approved: merge (default `--squash`), delete the branch. Do not override branch protection.
6. (Optional) Transition the Jira issue to Done and comment the merge commit + build URL.
7. Write `.sdlc/<JIRA-ID>/shipped.md` with the merge commit SHA, PR URL, and approving reviewer.

## Output contract

- **Awaiting approval:** PR open, green, paused pending review; nothing merged.
- **Approved + merged:** feature branch merged to `main`; branch deleted; Jira updated (if the Jira MCP is available); pipeline complete.
