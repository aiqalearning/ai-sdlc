# Jira MCP

Provides the requirements source for stage 1 (`/sdlc:intake`). Backed by [`mcp-atlassian`](https://github.com/sooperset/mcp-atlassian), which exposes Jira (and Confluence) over MCP.

## What the pipeline uses it for

- Fetch an issue by key (`JIRA-123`): summary, description, acceptance criteria, status, labels, linked issues.
- Read comments for extra context.
- (Optional) transition the issue and post a comment when the PR merges.

## Config

Registered in the repo-root [`.mcp.json`](../../.mcp.json). Standalone example: [`claude-code-jira.example.json`](claude-code-jira.example.json).

### Environment variables

| Variable | Description |
|----------|-------------|
| `JIRA_URL` | Your Atlassian Cloud base URL, e.g. `https://your-site.atlassian.net` |
| `JIRA_EMAIL` | The account email for the API token |
| `JIRA_TOKEN` | An [Atlassian API token](https://id.atlassian.com/manage-profile/security/api-tokens) |

## Verify

In Claude Code run `/mcp` and confirm `jira` is connected, then ask it to fetch a known issue.

## Alternative

If your org uses the hosted **Atlassian Rovo** connector on claude.ai instead, you can drop this stdio server and authorize Rovo in your connector settings; the `jira-intake` skill works with either as long as issue-fetch tools are available.
