---
name: sdlc:verify
description: "Stage 3 — build and boot the app, smoke-check that the change actually runs."
argument-hint: "<JIRA-ID>"
allowed-tools: Read, Write, Bash, mcp__playwright
---

# /sdlc:verify — Verify the app runs

Before writing E2E tests, confirm the generated code builds, the app boots, and the acceptance-criteria flow is reachable in a real browser.

## Prerequisite

Stage 2 complete (feature branch with the change).

## Steps

1. Read `.sdlc/<JIRA-ID>/spec.md`.
2. Load the `app-verification` skill: `plugins/ai-sdlc/skills/app-verification/SKILL.md`. Follow it.
3. Install deps, build, and start the app (per the target repo's scripts; for the demo app: `npm install`, `npm start`).
4. Health-check the running app (HTTP probe), then use the Playwright MCP to click through the primary acceptance-criteria flow and confirm it renders/behaves.
5. Write `.sdlc/<JIRA-ID>/verify.md` with PASS/FAIL per criterion and any console/network errors observed.

## Output contract

- App boots and the primary flow is reachable, OR a clear FAIL report.
- On FAIL: stop the pipeline and report — do not proceed to automation.
- Next (on PASS): `/sdlc:automate <JIRA-ID>`.
