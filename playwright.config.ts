import {defineConfig, devices} from '@playwright/test';
import {ADMIN_SESSION} from './test/playwright/global-setup';

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
  reporter: [
    ['list'],
    ['html', {open: 'never'}],
    // on CI: annotations of the failures, and results.json for the job summary (see build.yml)
    ...(process.env.CI ? [['github'], ['json', {outputFile: 'test-results/results.json'}]] as const : []),
  ],
  use: {
    baseURL: 'http://localhost:8080',
    // Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer
    trace: 'on-first-retry',
    // logged in as admin, see global-setup.ts
    storageState: ADMIN_SESSION,
  },

  globalSetup: './test/playwright/global-setup.ts',
  projects: [
    {name: 'chromium', use: {...devices['Desktop Chrome']}, testIgnore: /admin-config\.spec\.ts/},
    // the journeys that work differently on a phone (touch, small screen), with real touch events (#1316)
    {name: 'mobile', use: {...devices['Pixel 7']}, testMatch: /(lightbox|navigation)\.spec\.ts/},
    // tests that change the server config or run jobs: after all the others, so they don't change the server under them (#1315)
    {name: 'admin-config', use: {...devices['Desktop Chrome']}, testMatch: /admin-config\.spec\.ts/, dependencies: ['chromium', 'mobile']},
  ],

  // Starts the e2e server with an empty DB (test/e2e is reset) on the demo/images folder.
  webServer: {
    command: process.env.DOCS_SCREENSHOTS ? 'npm run start-docs-e2e-server' : 'npm run start-e2e-server',
    url: 'http://localhost:8080',
    reuseExistingServer: !process.env.CI,
  },
});
