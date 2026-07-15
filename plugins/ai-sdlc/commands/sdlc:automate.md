---
name: sdlc:automate
description: "Stage 4 — generate Playwright E2E tests covering the acceptance criteria."
argument-hint: "<JIRA-ID>"
allowed-tools: Read, Write, Edit, Bash, mcp__playwright
---

# /sdlc:automate — Generate Playwright automation

Author Playwright E2E specs that assert each acceptance criterion, and confirm they pass locally against the running app.

## Prerequisite

Stage 3 PASS (`.sdlc/<JIRA-ID>/verify.md`).

## Steps

1. Read `.sdlc/<JIRA-ID>/spec.md` and `verify.md`.
2. Load the `playwright-automation` skill: `plugins/ai-sdlc/skills/playwright-automation/SKILL.md`. Follow it.
3. Delegate authoring to the `qa-automation-engineer` agent for non-trivial suites.
4. Write specs under the target repo's `tests/e2e/` — one describe block per acceptance criterion, stable role/label-based locators, no arbitrary sleeps.
5. Run them locally (`npx playwright test`) against the app booted in stage 3. Iterate until green locally.
6. Commit the specs on the same feature branch.

## Output contract

- Committed Playwright specs, green locally, one assertion path per acceptance criterion.
- `.sdlc/<JIRA-ID>/automation.md` lists each spec and the criterion it covers.
- Next: `/sdlc:run-ci <JIRA-ID>`.
