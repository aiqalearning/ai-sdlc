# DEMO-1 — Let a user delete a task

- **Type:** Story
- **Status:** To Do
- **Project:** DEMO
- **Components:** demo-app

## Description

The task list can add and complete tasks, but there is no way to remove one. Users
end up with a cluttered list of tasks they no longer care about. Add the ability to
delete a task from the list.

## Acceptance Criteria

- AC1: Each task row has a **Delete** control labelled for that task (e.g. an accessible
  name like "Delete <title>"). Clicking it removes that task from the list.
- AC2: Deleting one task leaves the other tasks untouched and still visible.
- AC3: After the last task is deleted, the list is empty (no task rows remain).

## Notes

- Backend: a `DELETE /api/tasks/:id` endpoint that removes the task and returns `204`;
  deleting an unknown id returns `404`.
- Keep the existing add / toggle behaviour working.
