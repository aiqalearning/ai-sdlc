# DEMO-2 — Friendly empty state for the task list

- **Type:** Story
- **Status:** To Do
- **Project:** DEMO
- **Components:** demo-app

## Description

When there are no tasks, the app shows a blank area with no guidance — it looks broken
or unfinished. Add a clearly visible empty-state message so first-time users know what
to do. This is a **visible UI change**: with an empty list the message is on screen, and
it disappears as soon as a task exists.

## Acceptance Criteria

- AC1: When there are **no tasks**, a visible empty-state element (stable locator, e.g. `data-testid="empty-state"`) is shown with friendly copy such as *"No tasks yet — add your first one above."*
- AC2: When **at least one task** exists, the empty-state message is **not** shown.
- AC3: **Deleting the last remaining task** brings the empty-state message back.

## Notes

- Purely client-side — render/hide the empty-state based on the task list; no new endpoint.
- Style it so it reads as intentional (muted text, centered), not an error.
- Keep add / toggle / delete / clear-completed / remaining-count / edit-title behaviour intact.
