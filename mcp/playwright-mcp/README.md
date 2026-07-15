# Playwright MCP

Lets Claude drive a real browser during **stage 3 (`/sdlc:verify`)** to confirm the generated app actually renders and behaves, and during **stage 4 (`/sdlc:automate`)** to explore the UI while authoring E2E tests.

Backed by the official [`@playwright/mcp`](https://github.com/microsoft/playwright-mcp).

## What the pipeline uses it for

- Navigate to the locally booted app, click through the acceptance-criteria flow, and read the accessibility tree / screenshots to confirm it works before tests exist.
- Discover selectors and flows so the generated Playwright specs target real elements.

## Config

Registered in the repo-root [`.mcp.json`](../../.mcp.json). No credentials needed. Standalone example: [`claude-code-playwright.example.json`](claude-code-playwright.example.json).

## Notes

- This MCP is for **interactive verification**. The committed E2E tests (stage 4) are plain `@playwright/test` specs run by Jenkins in stage 5 — they do not depend on this MCP.
- First run downloads a browser; if sandboxed, run `npx playwright install chromium` once.
