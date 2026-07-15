---
name: app-verification
description: "Stage 3 of the AI-SDLC pipeline. Build and boot the app from the feature branch, health-check it, and drive the primary acceptance-criteria flow in a real browser via the Playwright MCP to confirm the change actually works before tests are written. Use when the user runs /sdlc:verify or /sdlc:run reaches the verify stage."
allowed-tools: Read, Write, Bash, mcp__playwright
---

# app-verification — Verify the app runs

Prove the generated code builds, the app boots, and the acceptance-criteria flow is reachable — before investing in E2E tests. A FAIL here stops the pipeline.

## Preconditions

- Stage 2 complete: feature branch with the change committed.
- Read `.sdlc/<JIRA-ID>/spec.md` and `implement.md`.

## Procedure

1. **Install & build.** Run the repo's install/build scripts (demo app: `npm install`). Capture failures verbatim — a build break is an immediate FAIL.

2. **Boot.** Start the app in the background on a known port (demo app: `npm start`, `DEMO_APP_PORT` or 3000). Record the PID/URL so you can stop it afterward.

3. **Health check.** Poll the base URL until it responds `200` (timeout ~30s). No response → FAIL with the server log tail.

4. **Drive the primary flow.** Use the Playwright MCP to:
   - navigate to the app,
   - walk the main acceptance-criteria path (the highest-value AC),
   - assert the expected UI/state appears,
   - capture the accessibility snapshot and any console/network errors.
   No Playwright MCP available → fall back to `curl`/HTTP assertions on the key endpoints and note the reduced coverage.

5. **Stop the app.** Kill the process you started. Leave no orphan servers.

6. **Report.** Write `.sdlc/<JIRA-ID>/verify.md`:
   - overall `PASS` / `FAIL`,
   - per-AC reachability (PASS/FAIL/not-verifiable-here),
   - console/network errors,
   - the exact commands used to build/boot (so Jenkins can mirror them).

## Guardrails

- Do not write or commit test files here — that is stage 4.
- A build break, boot failure, or unhandled error on the primary flow is a hard FAIL. Stop the pipeline and report; do not proceed to automation on a FAIL.

## Handoff

PASS → `/sdlc:automate <JIRA-ID>` (`playwright-automation` skill).
FAIL → return to `/sdlc:implement <JIRA-ID>` with the failure detail.
