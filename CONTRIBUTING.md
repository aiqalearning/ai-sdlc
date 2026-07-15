# Contributing

## Structure

- `plugins/ai-sdlc/commands/*.md` — slash-command entry points (thin).
- `plugins/ai-sdlc/skills/*/SKILL.md` — stage logic (where the real procedure lives).
- `plugins/ai-sdlc/agents/*.md` — subagents skills may delegate to.
- `plugins/ai-sdlc/config/*.yaml` — repo registry + pipeline gates.
- `mcp/*` — connector setup docs + example configs.
- `demo-app/` — runnable target for the pipeline.

## Adding a stage

1. Create `plugins/ai-sdlc/skills/<stage>/SKILL.md` with frontmatter (`name`, `description`, `allowed-tools`).
2. Create `plugins/ai-sdlc/commands/sdlc:<stage>.md` that hands off to the skill.
3. Wire it into `sdlc-orchestrator` and `pipeline.yaml` if it belongs in the default run.
4. `node bin/validate.js` must pass.

## Conventions

- Frontmatter keys use the same shape as the reference: `name`, `description`, and (for skills) `allowed-tools`.
- No secrets in files — env vars only.
- No telemetry, analytics, or network calls back to any vendor. Keep it self-contained.
- Generated product code goes to feature branches; `main` is protected by the merge gate.

## Validation

```bash
node bin/validate.js
cd demo-app && npm test
```
