---
name: merge-gate
description: "Stage 6 of the AI-SDLC pipeline — the hard merge gate. Open a PR and merge the feature branch to main ONLY when a fresh Jenkins SUCCESS exists for the branch tip. Optionally transition the Jira issue. Use when the user runs /sdlc:ship or /sdlc:run reaches the ship stage."
allowed-tools: Read, Write, Bash, mcp__github, mcp__jira
---

# merge-gate — Merge to main on green

The pipeline's protected gate. Merging `main` is allowed **only** through this skill, and only when the automation is genuinely green for the exact code being merged.

## The gate (ALL must hold — else STOP, do not merge)

1. `.sdlc/<JIRA-ID>/ci.md` exists and its verdict is `GREEN` (`result == SUCCESS`).
2. **Pass rate:** the Jenkins test report meets `jenkins.min_pass_percent` from `pipeline.yaml` (default `100` — every test passed, zero failures/errors). Read the pass ratio from the build's test report, not just the overall result.
3. **Freshness:** the Jenkins build ran against the current tip of `feature/<JIRA-ID>-<slug>`. Compare the SHA in `ci.md` to `git rev-parse origin/feature/<JIRA-ID>-<slug>`. Mismatch → stale → STOP.
4. No unpushed commits: `git status` shows the branch is in sync with its remote.
5. The PR (once opened) is mergeable — no conflicts with `main`.
6. **Human approval** (when `merge.require_pr_approval` is true, the default): the open PR carries at least `merge.required_approvals` approving review(s) and has **no** outstanding "changes requested". Awaiting approval is a **pause**, not a failure — stop and report that the PR is green and waiting on review; do not merge.

If any check fails, print exactly which one and stop. Do not offer to bypass. (A human may still choose to run the underlying git/gh commands themselves; this skill will not.)

## Procedure

1. Re-run gate checks 1–5.
2. **Open the PR** if none is open. Prefer the GitHub MCP; fall back to `gh`:
   ```bash
   gh pr create --base main --head feature/<JIRA-ID>-<slug> \
     --title "<JIRA-ID>: <summary>" \
     --body "Implements <JIRA-ID>. Jenkins: <build URL> (SUCCESS, 100% pass). ACs: <checklist>. Awaiting review approval before merge."
   ```
3. **Check the approval gate (6).** Read the PR's review state (GitHub MCP, or `gh pr view <num> --json reviewDecision,reviews`):
   - `reviewDecision == APPROVED` and approvals ≥ `required_approvals` → proceed to merge.
   - `CHANGES_REQUESTED` → STOP; report the requested changes; loop back to stage 2/4 as appropriate.
   - `REVIEW_REQUIRED` / pending → **STOP and pause.** Report: "PR #<num> is green and awaiting approval — merge will proceed once approved. Re-run `/sdlc:ship <JIRA-ID>` after approval." Do not merge.
4. **Merge** (only once approved + green), default squash:
   ```bash
   gh pr merge <num> --squash --delete-branch
   ```
   Rely on branch protection to enforce the same review + status-check requirements server-side; never merge past a protection rule.
5. **Update Jira** (if the Jira MCP is available): transition the issue to Done and comment with the merge commit SHA + Jenkins build URL + approving reviewer. Skip silently if unavailable.
6. **Record.** Write `.sdlc/<JIRA-ID>/shipped.md`: PR URL, merge commit SHA, Jenkins build URL, approving reviewer, timestamp. Tick the AC checklist in `spec.md`.

## Guardrails

- Never merge on a red, missing, stale, or `UNSTABLE` report, or below `min_pass_percent` — including under `/sdlc:run --auto`.
- Never merge without the required approval when `require_pr_approval` is true — `--auto` does not bypass human review; it pauses at the approval gate like any other run.
- Never force-merge or override branch protection.
- Never touch `main` except via the merge of a gated, approved PR.

## Handoff

- **Awaiting approval:** report the PR URL, the green Jenkins build, and that the merge is paused pending review. The run resumes when someone re-runs `/sdlc:ship <JIRA-ID>` after approval.
- **Merged:** pipeline complete. Report the PR URL, merge SHA, approving reviewer, and Jira status to the user.
