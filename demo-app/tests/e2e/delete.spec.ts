import { test, expect } from '@playwright/test';

// DEMO-1 — a user can delete a task. One area per acceptance criterion,
// role/label locators, web-first assertions, no arbitrary sleeps.

// The app keeps a single in-memory task list; start every test from a clean slate.
test.beforeEach(async ({ request }) => {
  const tasks = await (await request.get('/api/tasks')).json();
  for (const t of tasks) await request.delete(`/api/tasks/${t.id}`);
});

async function addTask(page, title: string) {
  await page.getByLabel('New task').fill(title);
  await page.getByRole('button', { name: 'Add' }).click();
  // exact match: getByText is a case-insensitive substring match, so a bare
  // getByText('One') would also hit the "Done" toggle button.
  await expect(page.getByText(title, { exact: true })).toBeVisible();
}

test.describe('AC1 — a user can delete a task', () => {
  test('clicking Delete removes that task from the list', async ({ page }) => {
    await page.goto('/');
    await addTask(page, 'Delete me');

    await page.getByRole('button', { name: 'Delete Delete me' }).click();

    await expect(page.getByText('Delete me')).toHaveCount(0);
    await expect(page.getByTestId('task')).toHaveCount(0);
  });
});

test.describe('AC2 — deleting one task leaves the others', () => {
  test('other tasks remain visible after deleting one', async ({ page }) => {
    await page.goto('/');
    await addTask(page, 'Keep A');
    await addTask(page, 'Remove B');
    await addTask(page, 'Keep C');

    await page.getByRole('button', { name: 'Delete Remove B' }).click();

    await expect(page.getByText('Remove B')).toHaveCount(0);
    await expect(page.getByText('Keep A')).toBeVisible();
    await expect(page.getByText('Keep C')).toBeVisible();
    await expect(page.getByTestId('task')).toHaveCount(2);
  });
});

test.describe('AC3 — deleting every task empties the list', () => {
  test('no task rows remain after deleting all', async ({ page }) => {
    await page.goto('/');
    await addTask(page, 'One');
    await addTask(page, 'Two');

    await page.getByRole('button', { name: 'Delete One' }).click();
    await page.getByRole('button', { name: 'Delete Two' }).click();

    await expect(page.getByTestId('task')).toHaveCount(0);
  });
});
