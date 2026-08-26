import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e/browser',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 8_000 },
  reporter: process.env.CI ? [['line'], ['html', { outputFolder: 'playwright-report', open: 'never' }]] : 'line',
  outputDir: 'test-results',
  use: {
    headless: process.env.E2E_HEADLESS === '1',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'browser-extension',
      testDir: './tests/e2e/browser',
    },
  ],
});
