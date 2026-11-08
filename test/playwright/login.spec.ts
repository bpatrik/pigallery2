import {expect, test} from '@playwright/test';
import {isGalleryContent, loginWithUi, notLoggedIn} from './helpers';

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
});
