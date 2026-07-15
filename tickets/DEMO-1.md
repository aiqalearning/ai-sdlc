# DEMO-1 — Edit a task's title

- **Type:** Story
- **Status:** To Do
- **Project:** DEMO
- **Components:** demo-app

## Description

Users sometimes mistype a task or want to refine its wording. Let a user edit an
existing task's title in place, without deleting and re-adding it.

## Acceptance Criteria

- AC1: Each task row has an **Edit** control (accessible name like "Edit <title>"). Activating it lets the user change the title and save it; the updated title is then shown in the list.
- AC2: Saving an empty/whitespace-only title is rejected — the task keeps its original title and a validation message is shown.
- AC3: Editing one task's title does not change any other task.

## Notes

- Backend: `PATCH /api/tasks/:id` with `{ "title": "<new>" }` → `200` with the updated task; `400` if the title is empty; `404` if the id is unknown.
- Give the edit control and its input stable, accessible locators (e.g. `aria-label`, `data-testid`).
- Keep the existing add / toggle / delete / clear-completed / remaining-count behaviour intact.
