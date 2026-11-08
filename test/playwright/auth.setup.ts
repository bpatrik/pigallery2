import {expect, test as setup} from '@playwright/test';

// Logs in once; the other tests start with this session (storageState in playwright.config.ts).
setup('login as admin', async ({page}) => {
  const res = await page.request.post('/pgapi/user/login', {
    data: {loginCredential: {username: 'admin', password: 'admin', rememberMe: false}},
  });
  expect(res.ok()).toBe(true);
  await page.context().storageState({path: 'test/playwright/.auth/admin.json'});
});
