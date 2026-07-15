---
name: jenkins-integration
description: "Stage 5 of the AI-SDLC pipeline. Push the feature branch, trigger a Jenkins job to run the Playwright suite against it, poll the build to completion, and read the test report. Use when the user runs /sdlc:run-ci or /sdlc:run reaches the run-ci stage. Uses the Jenkins REST API over curl by default; the Jenkins MCP is optional."
allowed-tools: Read, Write, Bash, mcp__github, mcp__jenkins
---

# jenkins-integration — Run the automation on Jenkins

Hand the committed suite to Jenkins, which runs it against the branch in a clean environment, and capture an authoritative pass/fail verdict for the merge gate.

## Preconditions

- Stage 4 complete: specs committed on `feature/<JIRA-ID>-<slug>`, green locally.
- Env: `JENKINS_URL`, `JENKINS_USER`, `JENKINS_TOKEN`, and a job name (`JENKINS_JOB` or `pipeline.yaml`).

## Procedure

1. **Push the branch.** `git push -u origin feature/<JIRA-ID>-<slug>`. Record the pushed tip SHA — the merge gate compares against it. (The guard hook blocks pushes to `main`.)

2. **Trigger the job.** Prefer the Jenkins MCP if connected; otherwise use REST-over-curl:
   ```bash
   curl -fsS -X POST --user "$JENKINS_USER:$JENKINS_TOKEN" -D - \
     "$JENKINS_URL/job/$JENKINS_JOB/buildWithParameters?BRANCH=feature/<JIRA-ID>-<slug>"
   ```
   Capture the `Location:` header (queue item URL).

3. **Resolve queue → build number.** Poll the queue item until it has an `executable.number`:
   ```bash
   curl -fsS --user "$JENKINS_USER:$JENKINS_TOKEN" "$JENKINS_URL/queue/item/<id>/api/json"
   ```

4. **Poll the build to completion.** Every ~10s until `building == false`:
   ```bash
   curl -fsS --user "$JENKINS_USER:$JENKINS_TOKEN" "$JENKINS_URL/job/$JENKINS_JOB/<n>/api/json"
   ```
   Read `result` (`SUCCESS` / `FAILURE` / `UNSTABLE` / `ABORTED`). Apply a sane overall timeout (default 30 min from `pipeline.yaml`); on timeout, record `TIMEOUT` and stop — do not assume success.

5. **Read the report.**
   ```bash
   curl -fsS --user "$JENKINS_USER:$JENKINS_TOKEN" "$JENKINS_URL/job/$JENKINS_JOB/<n>/testReport/api/json"
   ```
   Extract pass/fail/skip counts and the names of any failing tests.

6. **Record.** Write `.sdlc/<JIRA-ID>/ci.md`:
   - build URL and number,
   - branch + **tip SHA the build ran against**,
   - `result`,
   - test totals + failing test names,
   - a one-line verdict: `GREEN` only if `result == SUCCESS`.

## Guardrails

- `UNSTABLE`, `FAILURE`, `ABORTED`, `TIMEOUT`, or a missing report all mean **not green**. Never round up to green.
- Do not merge here — that is stage 6. This skill only produces the verdict.
- Never print `JENKINS_TOKEN`. Use `--user` with the env var directly; keep it out of logs and `ci.md`.

## Handoff

`GREEN` → `/sdlc:ship <JIRA-ID>` (`merge-gate` skill).
Not green → stop; surface failing tests so the user can loop back to `/sdlc:implement` or `/sdlc:automate`.
