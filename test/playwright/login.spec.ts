import {expect, test} from '@playwright/test';
import {NORMAL_USER} from './global-setup';
import {isGalleryContent, loginWithUi, logoutWithUi, notLoggedIn} from './helpers';

test.use(notLoggedIn);

test.describe('Login', () => {
  test('Page opens', async ({page}) => {
    await page.goto('/');
    await expect(page.locator('.card-body')).toBeVisible();
    await expect(page.locator('.col-sm-12').filter({hasText: 'Login'}).first()).toBeVisible();
  });

  test('Login', async ({page}) => {
    const content = page.waitForResponse(res => isGalleryContent(new URL(res.url())));
    await loginWithUi(page);
    await expect(page.locator('.mb-0 > :nth-child(1) > .nav-link')).toContainText('Gallery');

    const res = await content;
    expect(res.status()).toBe(200);
    expect(await res.json(), '1st API call has data').not.toBeNull();
  });

  test('Normal user should log in, stay logged in after a reload and log out', async ({page}) => {
    const content = page.waitForResponse(res => isGalleryContent(new URL(res.url())));
    await loginWithUi(page, NORMAL_USER.name, NORMAL_USER.password);
    expect((await content).status()).toBe(200);
    await expect(page).toHaveURL(/\/gallery/);
    await expect(page.locator('app-frame nav').getByText(NORMAL_USER.name).first()).toBeAttached();

    await page.reload();
    await expect(page).toHaveURL(/\/gallery/);
    await expect(page.locator('.photo-container > img').first()).toBeVisible();

    await logoutWithUi(page);
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('#username')).toBeVisible();
    // the session is gone
    await page.goto('/gallery/');
    await expect(page).toHaveURL(/\/login/);
  });
});
