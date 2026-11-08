import {expect, FullConfig, request} from '@playwright/test';

export const ADMIN_SESSION = 'test/playwright/.auth/admin.json';

/**
 * Logs in once; the tests start with this session (storageState in playwright.config.ts).
 * Global setup (unlike a setup project) also runs in UI mode.
 */
export default async function globalSetup(config: FullConfig): Promise<void> {
  const context = await request.newContext({baseURL: config.projects[0].use.baseURL});
  const res = await context.post('/pgapi/user/login', {
    data: {loginCredential: {username: 'admin', password: 'admin', rememberMe: false}},
  });
  expect(res.ok(), 'admin login (is your own server running on port 8080?)').toBe(true);
  await context.storageState({path: ADMIN_SESSION});
  await context.dispose();
}
