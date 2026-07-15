# AI-SDLC

An AI-assisted software development lifecycle for Claude Code. Point it at a **Jira** issue and it drives the change all the way to a merged PR:

```
Jira issue  →  generate code  →  verify the app runs  →  generate Playwright E2E
     →  trigger Jenkins to run the automation against the build
     →  Jenkins report green  →  merge to main
```

Every stage is a Claude Code **skill**, orchestrated by slash **commands**, backed by **MCP** connectors (Jira, GitHub, Jenkins, Playwright). A minimal **demo app** is bundled so you can run the whole loop end-to-end before pointing it at a real product repo.

## The pipeline

| Stage | Command | Skill | What happens |
|-------|---------|-------|--------------|
| 1. Intake | `/sdlc:intake JIRA-123` | `jira-intake` | Pull the issue from Jira, extract acceptance criteria, write a work spec |
| 2. Implement | `/sdlc:implement JIRA-123` | `code-generation` | Generate/modify code on a feature branch to satisfy the spec |
| 3. Verify | `/sdlc:verify JIRA-123` | `app-verification` | Build & boot the app, smoke-check it actually runs |
| 4. Automate | `/sdlc:automate JIRA-123` | `playwright-automation` | Generate Playwright E2E tests for the acceptance criteria |
| 5. Run CI | `/sdlc:run-ci JIRA-123` | `jenkins-integration` | Push branch, trigger the Jenkins job, poll until the report is in |
| 6. Ship | `/sdlc:ship JIRA-123` | `merge-gate` | If the Jenkins report is green, open + merge the PR to `main` |
| — Full run | `/sdlc:run JIRA-123` | `sdlc-orchestrator` | Runs stages 1→6 with a gate between each |

## Quick start

```bash
# 1. Install the demo app deps and Playwright browsers
cd demo-app && npm install && npx playwright install --with-deps chromium && cd ..

# 2. Copy env template and fill in your Jira / Jenkins / GitHub creds
cp .env.example .env      # then edit

# 3. In Claude Code, from the repo root:
/sdlc:run JIRA-123
```

See [GETTING_STARTED.md](GETTING_STARTED.md) for MCP setup and Jenkins wiring.

## Layout

```
ai-sdlc/
├── .mcp.json                     # Jira + GitHub + Jenkins + Playwright MCP servers
├── .claude/settings.json         # plugin enablement + destructive-op guard hook
├── .claude-plugin/marketplace.json
├── plugins/ai-sdlc/              # the plugin: commands, skills, agents, config
│   ├── commands/                 # /sdlc:* slash commands
│   ├── skills/                   # one skill per pipeline stage
│   ├── agents/                   # subagents (implementer, QA, release manager)
│   └── config/                   # repos.yaml, pipeline.yaml
├── mcp/                          # per-connector setup docs + example configs
├── bin/                          # validator + safety hook
└── demo-app/                     # runnable Express app + Jenkinsfile + Playwright
```

## Requirements

- Claude Code
- Node.js 20+
- A Jira Cloud site + API token
- A Jenkins server reachable from where the branch is pushed (or use the bundled `Jenkinsfile` locally)
- `gh` CLI authenticated to your GitHub account (for PR creation/merge)

## Design notes

- **No external telemetry / phone-home.** Nothing in this repo reports usage anywhere.
- Secrets are read from environment variables only — never committed. See [.env.example](.env.example).
- The Jenkins stage talks to the Jenkins REST API over `curl` by default; an MCP option is documented too.
