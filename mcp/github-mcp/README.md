# GitHub MCP

Used across stages for branch/PR operations and to let the merge gate (`/sdlc:ship`) open and merge PRs. Points at the hosted GitHub MCP endpoint (`https://api.githubcopilot.com/mcp/`).

## What the pipeline uses it for

- Create the feature branch and push commits (stage 2).
- Open the PR (stage 6) and read its checks/mergeability.
- Merge to `main` once the Jenkins gate is green.

## Config

Registered in the repo-root [`.mcp.json`](../../.mcp.json). Standalone example: [`claude-code-github.example.json`](claude-code-github.example.json).

### Environment variables

| Variable | Description |
|----------|-------------|
| `GITHUB_TOKEN` | A fine-grained PAT with `contents` + `pull_requests` write on the target repo |

## `gh` CLI fallback (no MCP required)

The skills are written to work **without** this MCP by falling back to the `gh` CLI over Bash:

```bash
gh pr create --base main --head feature/JIRA-123-slug --title "..." --body "..."
gh pr merge <num> --squash --delete-branch
```

Authenticate once with `gh auth login`. If both are available, MCP is preferred for reads and `gh` for the final merge.
