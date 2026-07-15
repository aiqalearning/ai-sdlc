# Getting started

This guide wires up the four MCP connectors and the Jenkins job, then runs the pipeline against the demo app repo ([aiqalearning/ai-sdlc-demo-app](https://github.com/aiqalearning/ai-sdlc-demo-app)).

## 1. Prerequisites

| Tool | Why | Check |
|------|-----|-------|
| Claude Code | runs the plugin | `claude --version` |
| Node.js 20+ | demo app + Playwright | `node -v` |
| `gh` CLI | PR create/merge | `gh auth status` |
| `uvx` (optional) | Jenkins MCP server | `uvx --version` |
| Jenkins | runs the automation | reachable URL |

## 2. Environment variables

Copy the template and fill it in. Nothing here is committed — `.env` is git-ignored.

```bash
cp .env.example .env
```

| Variable | Used by | Example |
|----------|---------|---------|
| `JIRA_URL` | Jira MCP | `https://your-site.atlassian.net` |
| `JIRA_EMAIL` | Jira MCP | `you@company.com` |
| `JIRA_TOKEN` | Jira MCP | Atlassian API token |
| `GITHUB_TOKEN` | GitHub MCP + PRs | fine-grained PAT with `repo` scope |
| `JENKINS_URL` | Jenkins stage | `https://jenkins.company.com` |
| `JENKINS_USER` | Jenkins stage | your Jenkins user |
| `JENKINS_TOKEN` | Jenkins stage | Jenkins API token |
| `JENKINS_JOB` | Jenkins stage | job name, e.g. `ai-sdlc-e2e` |

Load them into your shell before launching Claude Code (e.g. `set -a; source .env; set +a`).

## 3. MCP connectors

`.mcp.json` at the repo root registers four servers. Claude Code reads it automatically when you open the repo. Per-connector notes and standalone example configs are in `mcp/`:

- **Jira** — [`mcp/jira-mcp/README.md`](mcp/jira-mcp/README.md) (uses `mcp-atlassian`)
- **GitHub** — [`mcp/github-mcp/README.md`](mcp/github-mcp/README.md)
- **Jenkins** — [`mcp/jenkins-mcp/README.md`](mcp/jenkins-mcp/README.md) (MCP optional; REST-over-curl is the default)
- **Playwright** — [`mcp/playwright-mcp/README.md`](mcp/playwright-mcp/README.md) (drives a real browser for verification)

Confirm they loaded with `/mcp` inside Claude Code.

## 4. Demo app + Playwright

The demo app is its own repo — [aiqalearning/ai-sdlc-demo-app](https://github.com/aiqalearning/ai-sdlc-demo-app). Clone it, then register its local path in [`plugins/ai-sdlc/config/repos.yaml`](plugins/ai-sdlc/config/repos.yaml).

```bash
git clone https://github.com/aiqalearning/ai-sdlc-demo-app.git
cd ai-sdlc-demo-app
npm install
npx playwright install --with-deps chromium
npx playwright test   # runs the e2e suite locally to confirm your setup
cd ..
```

## 5. Jenkins job

Create a Pipeline job (name it to match `JENKINS_JOB`, default `ai-sdlc-e2e`) that:

1. Checks out the branch passed as the `BRANCH` parameter, from the app repo.
2. Runs the app repo's root `Jenkinsfile` (Pipeline script from SCM).

The [`Jenkinsfile`](https://github.com/aiqalearning/ai-sdlc-demo-app/blob/main/Jenkinsfile) installs deps, boots the app, runs Playwright, and publishes a JUnit + HTML report. The `jenkins-integration` skill triggers this job and polls until it finishes, then reads the test result. See [SETUP.md](SETUP.md) for the exact `config.xml` used here.

## 6. Run it

From the repo root, in Claude Code:

```
/sdlc:run DEMO-1          # full pipeline against the demo app
```

or step by step:

```
/sdlc:intake DEMO-1
/sdlc:implement DEMO-1
/sdlc:verify DEMO-1
/sdlc:automate DEMO-1
/sdlc:run-ci DEMO-1
/sdlc:ship DEMO-1
```

## Pointing at a real repo

Register the target repo in [`plugins/ai-sdlc/config/repos.yaml`](plugins/ai-sdlc/config/repos.yaml) and set its Jenkins job in [`plugins/ai-sdlc/config/pipeline.yaml`](plugins/ai-sdlc/config/pipeline.yaml). The commands take the Jira ID; the repo is resolved from the issue's project or an explicit `--repo` flag.
