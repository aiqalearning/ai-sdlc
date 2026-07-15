# <!-- JIRA-ID -->: <summary>

**Jira:** <!-- link -->
**Feature branch:** feature/<JIRA-ID>-<slug>
**Jenkins build:** <!-- build URL (must be SUCCESS for the branch tip) -->

## Acceptance criteria
<!-- one line per AC, ticked when its E2E assertion passes -->
- [ ] AC1:
- [ ] AC2:

## Pipeline evidence
- [ ] `/sdlc:verify` PASS (app boots, primary flow reachable)
- [ ] `/sdlc:automate` — Playwright specs cover every AC, green locally
- [ ] `/sdlc:run-ci` — Jenkins `SUCCESS` for this branch tip
- [ ] Merge gate freshness: Jenkins-tested SHA == branch tip

## Notes
<!-- new deps, migrations, config/env, follow-ups -->
