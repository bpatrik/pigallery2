import {defineConfig, devices} from '@playwright/test';

/**
 * E2E tests. They need a frontend build in dist (e.g.: npm run build).
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './test/playwright',
  fullyParallel: true,
  // Fail the build on CI if you accidentally left test.only in the source code.
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['html', {open: 'never'}]],
  use: {
    baseURL: 'http://localhost:8080',
    // Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer
    trace: 'on-first-retry',
  },

  projects: [
    {name: 'setup', testMatch: /.*\.setup\.ts/},
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // logged in as admin, see auth.setup.ts
        storageState: 'test/playwright/.auth/admin.json',
      },
      dependencies: ['setup'],
    },
  ],

  // Starts the e2e server with an empty DB (test/e2e is reset) on the demo/images folder.
  webServer: {
    command: 'npm run start-e2e-server',
    url: 'http://localhost:8080',
    reuseExistingServer: !process.env.CI,
  },
});
