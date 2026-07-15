# Claude Code — AI-SDLC repo notes

This repo is an AI-assisted SDLC plugin for Claude Code. The pipeline is:

```
Jira issue → code → verify → Playwright E2E → Jenkins run → merge to main (on green)
```

## How the pieces fit

- **Commands** (`plugins/ai-sdlc/commands/sdlc:*.md`) are the entry points. Each maps to one pipeline stage; `/sdlc:run` orchestrates all of them.
- **Skills** (`plugins/ai-sdlc/skills/*/SKILL.md`) hold the actual procedure for each stage. Commands are thin; skills are the logic.
- **Agents** (`plugins/ai-sdlc/agents/*.md`) are subagents a skill can delegate to (implementer, QA automation, release manager).
- **Config** (`plugins/ai-sdlc/config/`): `repos.yaml` registers target product repos; `pipeline.yaml` sets gates and Jenkins job names.
- **MCP** (`.mcp.json`, `mcp/`): Jira (requirements), GitHub (PRs), Jenkins (CI), Playwright (browser verification).

## Working rules

- **Never commit secrets.** All creds come from env vars (`JIRA_*`, `JENKINS_*`, `GITHUB_TOKEN`). `.env` is git-ignored.
- **Feature branches only.** Generated code lands on `feature/<JIRA-ID>-<slug>`, never directly on `main`.
- **The merge gate is hard.** `/sdlc:ship` merges to `main` only when the Jenkins report for the branch is green. If the report is missing, red, or stale, stop and report — do not merge.
- **Verify before you trust.** After generating code, actually build and boot the app (stage 3) before writing/depending on E2E tests.

## Safety

A `PreToolUse` hook (`bin/hooks/guard-destructive.py`, wired in `.claude/settings.json`) discourages destructive shell commands against `demo-app/` and target repos. It is a speed bump, not a security boundary — confirm destructive intent with the user.

## Validation

```bash
node bin/validate.js        # checks plugin.json, marketplace.json, skill/command frontmatter, .mcp.json
```

## Demo app

`demo-app/` is a minimal Express app with a `Jenkinsfile`, `playwright.config.ts`, and an e2e test, so the full loop is runnable without a real product repo. Run its tests with `cd demo-app && npm test`.
