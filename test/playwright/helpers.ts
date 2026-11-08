import {expect, Locator, Page} from '@playwright/test';

// a fresh browser without the logged in admin session of global-setup.ts
export const notLoggedIn = {storageState: {cookies: [], origins: []}};

export const isGalleryContent = (url: URL): boolean => url.pathname === '/pgapi/gallery/content/';

/**
 * Logs in as admin on the login page.
 */
export const loginWithUi = async (page: Page): Promise<void> => {
  await page.goto('/');
  await expect(page.locator('.card-body')).toBeVisible();
  await expect(page.locator('.col-sm-12').filter({hasText: 'Login'}).first()).toBeVisible();
  await page.locator('#username').fill('admin');
  await page.locator('#password').fill('admin');
  const login = page.waitForResponse(res => new URL(res.url()).pathname === '/pgapi/user/login');
  await page.locator('.col-sm-12 > .btn').click();
  expect((await login).ok()).toBe(true);
};

/**
 * Scrolls down until the locator is rendered (the grid renders the photos while scrolling).
 */
export const scrollUntilAttached = async (page: Page, locator: Locator): Promise<void> => {
  await expect(async () => {
    await page.mouse.wheel(0, 9000);
    await expect(locator).toBeAttached({timeout: 500});
  }).toPass({timeout: 10000});
};
