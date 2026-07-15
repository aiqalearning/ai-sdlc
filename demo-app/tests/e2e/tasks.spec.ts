import { test, expect } from '@playwright/test';

// Example E2E suite — the shape the `playwright-automation` skill generates:
// one describe/test area per acceptance criterion, role/label locators,
// web-first assertions, no arbitrary sleeps.

// The app keeps a single in-memory task list; start every test from a clean slate.
test.beforeEach(async ({ request }) => {
  const tasks = await (await request.get('/api/tasks')).json();
  for (const t of tasks) await request.delete(`/api/tasks/${t.id}`);
});

test.describe('AC1 — a user can add a task', () => {
  test('adding a task shows it in the list', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('New task').fill('Write the spec');
    await page.getByRole('button', { name: 'Add' }).click();

    await expect(page.getByText('Write the spec')).toBeVisible();
  });
});

test.describe('AC2 — empty tasks are rejected', () => {
  test('submitting an empty title shows a validation message and adds nothing', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Add' }).click();

    await expect(page.getByRole('alert')).toHaveText(/required/i);
    await expect(page.getByTestId('task')).toHaveCount(0);
  });
});

test.describe('AC3 — a task can be marked done and undone', () => {
  test('toggling a task updates its state', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('New task').fill('Ship it');
    await page.getByRole('button', { name: 'Add' }).click();

    await page.getByRole('button', { name: 'Toggle Ship it' }).click();
    await expect(page.getByRole('button', { name: 'Toggle Ship it' })).toHaveText('Undo');

    await page.getByRole('button', { name: 'Toggle Ship it' }).click();
    await expect(page.getByRole('button', { name: 'Toggle Ship it' })).toHaveText('Done');
  });
});
