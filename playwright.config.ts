import { defineConfig, devices } from '@playwright/test';

const baseURL = (process.env.TIME_VISUAL_BASE_URL || 'http://localhost:5000').replace(/\/$/, '');

export default defineConfig({
  testDir: './tests/visual',
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  retries: 0,
  reporter: [
    ['line'],
    ['html', { open: 'never', outputFolder: 'test-results/playwright-report' }],
  ],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    viewport: { width: 1440, height: 900 },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
