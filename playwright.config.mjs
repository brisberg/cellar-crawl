import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests',
  testMatch: '**/*.spec.mjs',
  globalSetup: './tests/global-setup.mjs',
  outputDir: 'test-output/results',
  // Full playthroughs are ~40 clicks at ~0.7 s each (Harlowe's transitions), well past the 30 s default.
  timeout: 90_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI, // a stray test.only must not silently skip the suite in CI
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    ...devices['Desktop Chrome'],
    trace: 'retain-on-failure',
  },
});
