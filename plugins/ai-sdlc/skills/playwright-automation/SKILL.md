---
name: playwright-automation
description: "Stage 4 of the AI-SDLC pipeline. Generate Playwright E2E specs that assert each acceptance criterion, run them locally against the booted app until green, and commit them to the feature branch. Use when the user runs /sdlc:automate or /sdlc:run reaches the automate stage."
allowed-tools: Read, Write, Edit, Bash, mcp__playwright
---

# playwright-automation — Generate the E2E suite

Author `@playwright/test` specs that encode the acceptance criteria as executable checks, prove them green locally, and commit them. These specs are what Jenkins runs in stage 5.

## Preconditions

- Stage 3 `PASS` (`.sdlc/<JIRA-ID>/verify.md`).
- Read `spec.md` (criteria) and `verify.md` (working flow + selectors observed).

## Procedure

1. **Confirm the test harness.** Ensure the target repo has `@playwright/test`, a `playwright.config`, and a `tests/e2e/` dir. If missing, scaffold them to match the demo app's setup (config with `baseURL`, `webServer` to boot the app, `reporter` including `junit` + `html`).

2. **One spec area per criterion.** For each AC, write a `test.describe`/`test` that:
   - navigates via `baseURL`,
   - drives the flow with **role/label/text locators** (`getByRole`, `getByLabel`, `getByText`) — never brittle CSS/nth-child chains,
   - asserts the observable outcome with `expect` (web-first assertions, auto-waiting),
   - uses **no arbitrary `waitForTimeout`**; rely on Playwright's auto-wait.

3. **Author with real UI.** Use the Playwright MCP to discover accurate locators and confirm each assertion path against the running app. Delegate larger suites to the `qa-automation-engineer` agent, passing the ACs and the verify report.

4. **Run locally until green.** `npx playwright test`. Fix flakiness at the source (locators, assertions), not with sleeps. Every AC must have at least one passing assertion path.

5. **Commit** the specs + any config on the feature branch (Jira-key-prefixed message). Do not push yet.

6. **Record.** Write `.sdlc/<JIRA-ID>/automation.md`: a table of spec file → AC covered, and the local run summary (N passed / 0 failed).

## Guardrails

- Tests assert behaviour from the spec — do not weaken an assertion just to make it pass. If an AC cannot be satisfied, that is a stage-2 defect: stop and report.
- Ensure `junit` reporter output is configured so Jenkins can publish results (stage 5 depends on it).
- Deterministic tests only — no reliance on network flakiness, wall-clock, or test ordering.

## Handoff

Green locally → `/sdlc:run-ci <JIRA-ID>` (`jenkins-integration` skill) runs the same suite on Jenkins.
