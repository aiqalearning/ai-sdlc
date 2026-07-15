# Pipeline flow & gate rationale

## End to end

```
             ┌──────────┐   spec.md    ┌────────────┐  feature branch  ┌──────────┐
 Jira issue ─▶  intake   ├────────────▶│  implement  ├─────────────────▶│  verify  │
             │(jira-     │              │(code-       │                  │(app-     │
             │ intake)   │              │ generation) │                  │verify..) │
             └──────────┘              └────────────┘                  └────┬─────┘
                                                                    PASS │  │ FAIL → back to implement
                                                                         ▼  │
                          ┌──────────┐   ci.md GREEN  ┌────────────┐  automation.md  ┌──────────┐
                merged ◀──┤   ship    │◀───────────────┤   run-ci    │◀────────────────┤ automate │
                to main   │(merge-    │  (Jenkins       │(jenkins-   │  green locally  │(playwright│
                          │ gate)     │   SUCCESS)      │ integration)│                 │-automation)│
                          └──────────┘                └─────┬──────┘                 └──────────┘
                                                    not green │→ back to implement (product bug)
                                                              │  or automate (test bug)
```

## Why gate between every stage

- **intake → implement:** no code without a spec + acceptance criteria. Prevents building the wrong thing.
- **implement → verify:** never write E2E tests against code that does not build or boot. Cheap failure first.
- **verify → automate:** only automate flows confirmed reachable, so tests assert real behaviour, not scaffolding.
- **automate → run-ci:** local green is necessary but not sufficient; Jenkins runs in a clean, reproducible environment.
- **run-ci → ship:** the merge gate. `main` only ever advances behind an authoritative green report for the exact commit.

## Freshness rule (the important one)

The merge gate compares the SHA Jenkins tested against the current branch tip. A green build for an older commit does **not** authorize merging newer commits. This is what stops "it was green yesterday" merges.

## State

All run state lives under `.sdlc/<JIRA-ID>/` (git-ignored): `spec.md`, `implement.md`, `verify.md`, `automation.md`, `ci.md`, `shipped.md`, and the `run.md` status table. Deleting the folder resets the pipeline for that issue.
