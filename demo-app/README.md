# Demo app

A minimal Express task list — the runnable target for the AI-SDLC pipeline. It exists so the whole loop (verify → Playwright → Jenkins) works out of the box before you point the tooling at a real product repo.

## Run locally

```bash
npm install
npm start                 # http://localhost:3000
```

## Test

```bash
npm install
npx playwright install --with-deps chromium
npm test                  # boots the app via playwright.config webServer, runs tests/e2e
```

Reports: `test-results/junit.xml` (Jenkins reads this) and `playwright-report/` (HTML).

## Surface

| Route | Purpose |
|-------|---------|
| `GET /` | task list page |
| `GET /health` | health probe (used by verify + Playwright webServer) |
| `GET /api/tasks` | list tasks |
| `POST /api/tasks` | add a task (`{ "title": "..." }`; empty → 400) |
| `POST /api/tasks/:id/toggle` | toggle done |

State is in-memory; restarting resets it.

## Jenkins

[`Jenkinsfile`](Jenkinsfile) is a parameterized pipeline (`BRANCH`) that installs, runs Playwright, and publishes JUnit. Point your `ai-sdlc-e2e` Jenkins job at it.
