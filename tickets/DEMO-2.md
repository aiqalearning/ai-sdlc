# DEMO-2 — Clear all completed tasks

- **Type:** Story
- **Status:** To Do
- **Project:** DEMO
- **Components:** demo-app

## Description

Once a few tasks are marked done, the list gets noisy. Give users a single control to
clear every completed task at once, leaving the not-done tasks untouched.

## Acceptance Criteria

- AC1: A "Clear completed" control is visible. Clicking it removes all tasks marked done.
- AC2: Tasks that are not done remain in the list after clearing.
- AC3: When there are no completed tasks, clicking "Clear completed" changes nothing (no error).

## Notes

- Backend: `POST /api/tasks/clear-completed` removes done tasks and returns the remaining list.
- Keep add / toggle / delete behaviour intact.
