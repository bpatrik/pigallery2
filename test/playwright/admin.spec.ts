// The admin page (#1315). Read-only: the tests that change the config or run jobs are in admin-config.spec.ts.
import {expect, test} from '@playwright/test';
import {asNormalUser, desktopViewport, expectNoHorizontalScroll, expectVisiblePhotosLoaded} from './helpers';

test.describe('Admin', () => {
  test.use(desktopViewport({width: 1200, height: 800}));

  test('Admin page should look right for an admin', {tag: '@sanity'}, async ({page}) => {
    const settingsLoaded = page.waitForResponse(res => new URL(res.url()).pathname === '/pgapi/settings');
    await page.goto('/admin');
    expect((await settingsLoaded).ok()).toBe(true);

    await expect(page).toHaveURL(url => url.pathname === '/admin');
    await expect.soft(page.locator('.version'), 'app version').toContainText(/v\d/);
    await expect.soft(page.locator('#config-priority'), 'mode switch').toBeVisible();
    // the basic settings
    for (const section of ['Server', 'Users', 'Media', 'Database']) {
      await expect.soft(page.locator('form#' + section), section + ' settings').toBeVisible();
    }
    await expect.soft(page.locator('.admin-menu'), 'menu').toContainText('Server');
    // no error on a fresh page
    await expect.soft(page.locator('app-settings-template .alert-danger:visible'), 'no error').toHaveCount(0);

    // the user list: the logged in admin can't delete their own row
    const ownRow = page.locator('app-settings-users tr').filter({has: page.locator('td', {hasText: /^admin$/})});
    await expect.soft(ownRow, 'own row in the user list').toHaveCount(1);
    await expect.soft(ownRow.locator('button:has(ng-icon[name="ionTrashOutline"])'), 'no delete on the own row').toBeDisabled();
    await expectNoHorizontalScroll(page, 'admin');
  });

  // CUJ 41: the demo has big_ben_only_time.jpg in timestamps and in dupl, the same file
  test('Duplicates should look right for an admin', {tag: '@sanity'}, async ({page}) => {
    const duplicates = page.waitForResponse(res => new URL(res.url()).pathname === '/pgapi/admin/duplicates');
    await page.goto('/duplicates');
    expect((await duplicates).ok()).toBe(true);

    await expect.soft(page.locator('app-duplicate .alert'), 'summary').toContainText(/Listing \d+ duplicates/);
    const pair = page.locator('app-duplicate .card').filter({hasText: 'big_ben_only_time.jpg'});
    await expect(pair.first()).toBeVisible();
    await expect.soft(pair.first(), 'copy in dupl').toContainText('/dupl/big_ben_only_time.jpg');
    await expect.soft(pair.first(), 'copy in timestamps').toContainText('/timestamps/big_ben_only_time.jpg');
    await expect.soft(pair.first().locator('app-duplicates-photo img').first(), 'thumbnail').toBeVisible();
    await expectNoHorizontalScroll(page, 'duplicates');

    // a row opens the folder of that copy
    await pair.first().locator('a').filter({hasText: '/dupl/'}).click();
    await expect(page).toHaveURL(url => url.pathname === '/gallery/dupl');
    await expect(page.locator('.photo-container > img[alt="big_ben_only_time.jpg"]')).toBeVisible();
    await expectVisiblePhotosLoaded(page);
  });

  test.describe('as a normal user', () => {
    test.use(asNormalUser);

    test('should not get the admin page', async ({page}) => {
      await page.goto('/admin');
      await expect(page).not.toHaveURL(url => url.pathname === '/admin');
      await expect(page.locator('app-settings-template')).toHaveCount(0);
      // the admin API refuses it too
      const res = await page.request.get('/pgapi/settings');
      expect(res.ok()).toBe(false);
      expect((await res.json()).result).toBeFalsy();
    });

    test('should be redirected to the gallery with a warning toast', async ({page}) => {
      test.fail(true, 'Not implemented yet #1315');
      await page.goto('/admin');
      await expect(page).toHaveURL(url => url.pathname === '/gallery/');
      await expect(page.locator('app-toast-card[role="status"]')).toBeVisible();
    });

    test('should get 403 from the admin API', async ({page}) => {
      test.fail(true, 'Not implemented yet #1315: answers 401');
      const res = await page.request.get('/pgapi/settings');
      expect(res.status()).toBe(403);
    });
  });
});
