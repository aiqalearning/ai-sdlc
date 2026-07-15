import { defineConfig, devices } from '@playwright/test';

const PORT = process.env.DEMO_APP_PORT || '3000';
const baseURL = `http://localhost:${PORT}`;

// Config mirrors what Jenkins runs: boot the app, run the e2e suite, emit JUnit + HTML.
export default defineConfig({
  testDir: './tests/e2e',
  // The app holds a single in-memory task list, so tests share server state.
  // Run serially with a clean slate per test (see beforeEach in the specs) to keep
  // the suite deterministic — a flaky suite can't back a 100%-pass merge gate.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ['list'],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    ['html', { open: 'never' }],
  ],
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  // Playwright boots the app itself so `npx playwright test` is self-contained.
  webServer: {
    command: 'node src/server.js',
    url: `${baseURL}/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
    env: { DEMO_APP_PORT: PORT },
  },
});
