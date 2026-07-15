# Jenkins MCP

Stage 5 (`/sdlc:run-ci`) triggers a Jenkins job to run the Playwright automation against the pushed branch, then polls for the result.

**The default path is the Jenkins REST API over `curl`** — no MCP server required, works everywhere. An MCP option is provided for richer interaction.

## REST-over-curl (default)

The `jenkins-integration` skill uses these calls. All auth is `--user "$JENKINS_USER:$JENKINS_TOKEN"`.

```bash
# 1. Trigger a parameterized build (BRANCH param → the feature branch)
curl -fsS -X POST \
  --user "$JENKINS_USER:$JENKINS_TOKEN" \
  "$JENKINS_URL/job/$JENKINS_JOB/buildWithParameters?BRANCH=feature/JIRA-123-slug" \
  -D -            # response headers include the queue item Location

# 2. Resolve the queue item → build number
curl -fsS --user "$JENKINS_USER:$JENKINS_TOKEN" \
  "$JENKINS_URL/queue/item/<id>/api/json"

# 3. Poll the build until it stops
curl -fsS --user "$JENKINS_USER:$JENKINS_TOKEN" \
  "$JENKINS_URL/job/$JENKINS_JOB/<buildNumber>/api/json"
#   → { "building": false, "result": "SUCCESS" | "FAILURE" | "UNSTABLE" }

# 4. Read the test report
curl -fsS --user "$JENKINS_USER:$JENKINS_TOKEN" \
  "$JENKINS_URL/job/$JENKINS_JOB/<buildNumber>/testReport/api/json"
```

`SUCCESS` → green gate. Anything else (`FAILURE`, `UNSTABLE`, `ABORTED`, missing) → the gate stays closed and `/sdlc:ship` refuses to merge.

## MCP option

Registered in the repo-root [`.mcp.json`](../../.mcp.json) as the `jenkins` server via [`mcp-jenkins`](https://pypi.org/project/mcp-jenkins/) (`uvx mcp-jenkins`). Standalone example: [`claude-code-jenkins.example.json`](claude-code-jenkins.example.json).

### Environment variables

| Variable | Used by | Description |
|----------|---------|-------------|
| `JENKINS_URL` | both | Base URL of the Jenkins server |
| `JENKINS_USER` | both | Jenkins username |
| `JENKINS_TOKEN` | both | Jenkins API token (User → Configure → API Token) |
| `JENKINS_JOB` | curl path | Job name to trigger (default `ai-sdlc-e2e`) |

## The job

Point the Jenkins job at [`demo-app/Jenkinsfile`](../../demo-app/Jenkinsfile) (or model your product job on it). It must:
- accept a `BRANCH` string parameter,
- check out that branch,
- run the Playwright suite,
- publish JUnit results so `testReport/api/json` is populated.
