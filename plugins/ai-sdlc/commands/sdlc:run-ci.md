---
name: sdlc:run-ci
description: "Stage 5 — push the branch, trigger Jenkins to run the automation, poll until the report is in."
argument-hint: "<JIRA-ID>"
allowed-tools: Read, Write, Bash, mcp__github, mcp__jenkins
---

# /sdlc:run-ci — Run the automation on Jenkins

Push the feature branch and have Jenkins run the Playwright suite against it, then wait for the verdict.

## Prerequisite

Stage 4 complete (committed specs, green locally).

## Steps

1. Read `.sdlc/<JIRA-ID>/spec.md` for the branch name and target repo.
2. Load the `jenkins-integration` skill: `plugins/ai-sdlc/skills/jenkins-integration/SKILL.md`. Follow it.
3. Push `feature/<JIRA-ID>-<slug>` to the remote.
4. Trigger the Jenkins job (`$JENKINS_JOB`, default from `pipeline.yaml`) with `BRANCH=<feature branch>`.
5. Poll the build until it finishes. Read the test report.
6. Write `.sdlc/<JIRA-ID>/ci.md` with the build URL, result (`SUCCESS`/`FAILURE`/`UNSTABLE`), and pass/fail counts.

## Output contract

- `.sdlc/<JIRA-ID>/ci.md` records a terminal Jenkins result and the build URL.
- Green (`SUCCESS`) → next: `/sdlc:ship <JIRA-ID>`.
- Not green → stop; report the failing tests so the user can loop back to `/sdlc:implement` or `/sdlc:automate`.
