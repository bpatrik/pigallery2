// The about page and the "What's new" popup. Only admins learn the app version.
import {expect, Page, test} from '@playwright/test';
import {
  ADMIN_SESSION,
  asNormalUser,
  createUserWithApi,
  deleteUserWithApi,
  desktopViewport,
  expectApiOk,
  expectNoHorizontalScroll,
  loginWithUi,
  notLoggedIn
} from './helpers';

const isReleaseNotes = (url: string): boolean => new URL(url).pathname === '/pgapi/admin/release-notes';

/**
 * Opens the about page with the menu of the navbar, from the loaded gallery
 * (the gallery's own navigation would otherwise override the click).
 */
const openAboutWithMenu = async (page: Page): Promise<void> => {
  await expect(page.locator('app-gallery-grid, app-gallery-directories').first()).toBeVisible();
  await page.locator('button#button-frame-menu').click();
  await page.locator('#menu-about').click();
  await expect(page).toHaveURL(url => url.pathname === '/about');
};

test.describe('About', () => {
  test.use(desktopViewport({width: 1200, height: 800}));

  test('About page should look right for an admin', {tag: '@sanity'}, async ({page}) => {
    const releaseNotes = page.waitForResponse(res => isReleaseNotes(res.url()));
    await page.goto('/gallery/');
    await expectApiOk(await releaseNotes, 'loading the release notes');
    // global-setup.ts confirmed the release notes of the admin
    await expect.soft(page.locator('.modal-content'), 'no popup').toHaveCount(0);

    await openAboutWithMenu(page);
    await expect.soft(page.locator('h1'), 'title').toContainText('PiGallery2');
    await expect.soft(page.locator('header app-icon svg'), 'app icon').toBeVisible();
    await expect.soft(page.locator('#about-app-version'), 'app version').toHaveText(/^v\d+\.\d+\.\d+/);
    // the e2e server runs from a git checkout (or a release with the commit in its package.json)
    await expect.soft(page.locator('#about-commit'), 'short git commit').toHaveText(/^[0-9a-f]{7}$/);
    await expect.soft(page.locator('#about-runtime'), 'runtime').toContainText('Node.js v');
    await expect.soft(page.locator('a[href="https://github.com/sponsors/bpatrik"]'), 'GitHub Sponsors link').toBeVisible();
    await expect.soft(page.locator('a[href="https://ko-fi.com/pigallery2"]'), 'Ko-fi link').toBeVisible();
    await expect.soft(page.locator('a[href="https://github.com/bpatrik/pigallery2/releases"]'), 'release notes link').toBeVisible();
    await expectNoHorizontalScroll(page, 'about');

    // the release notes, opened from the about page
    await page.locator('#about-whats-new').click();
    const popup = page.locator('.modal-content');
    await expect(popup.locator('.modal-title')).toHaveText(/^PiGallery2 v\d/);
    await expect.soft(popup.locator('markdown li').first(), 'the notes').toBeVisible();
    // the empty sections of a release in progress are not shown
    await expect.soft(popup.locator('markdown h2', {hasText: 'Breaking changes'}), 'no empty section').toHaveCount(0);
    await expectNoHorizontalScroll(page, 'about with the release notes');
    await popup.locator('#release-notes-ok').click();
    await expect(popup).toHaveCount(0);
  });

  test('the about page should reload as it is', async ({page}) => {
    await page.goto('/about');
    await expect(page.locator('#about-app-version')).toHaveText(/^v\d/);
  });

  test.describe('as a normal user', () => {
    test.use(asNormalUser);

    test('About page should look right for a normal user', {tag: '@sanity'}, async ({page, playwright, baseURL}) => {
      const admin = await playwright.request.newContext({baseURL, storageState: ADMIN_SESSION});
      const version: string = (await (await admin.get('/pgapi/admin/release-notes')).json()).result.build.appVersion;
      await admin.dispose();
      const consoleLines: string[] = [];
      page.on('console', msg => consoleLines.push(msg.text()));

      await page.goto('/gallery/');
      await openAboutWithMenu(page);
      await expect.soft(page.locator('h1'), 'title').toHaveText('PiGallery2');
      await expect.soft(page.locator('a[href="https://github.com/sponsors/bpatrik"]'), 'GitHub Sponsors link').toBeVisible();
      await expect.soft(page.locator('#about-version'), 'no version').toHaveCount(0);
      await expectNoHorizontalScroll(page, 'about');

      // not on the page, not in what the server sent, not in the console
      expect.soft(await page.content(), 'the version in the page').not.toContain(version);
      expect.soft(await page.evaluate(() => (window as unknown as { ServerInject: { buildInfo: unknown } }).ServerInject.buildInfo),
        'injected build info').toBe(null);
      expect.soft(consoleLines.filter(l => l.includes(version)), 'the version in the console').toEqual([]);
    });
  });

  test.describe('a new admin', () => {
    test.use(notLoggedIn);

    // An admin of its own: the popup shows only once per version and admin.
    test('should see the What\'s new popup once', async ({page, playwright, baseURL}) => {
      const admin = await playwright.request.newContext({baseURL, storageState: ADMIN_SESSION});
      const version: string = (await (await admin.get('/pgapi/admin/release-notes')).json()).result.build.appVersion;
      test.skip(version.includes('-edge'), 'edge never opens the popup by itself');

      const user = await createUserWithApi(admin, 'whats-new', 4);
      try {
        await loginWithUi(page, user.name, user.password);
        const popup = page.locator('.modal-content');
        await expect(popup.locator('.modal-title')).toHaveText(/^PiGallery2 v\d/);
        const seen = page.waitForResponse(res => new URL(res.url()).pathname === '/pgapi/admin/release-notes/seen');
        await popup.locator('#release-notes-ok').click();
        await expectApiOk(await seen, 'confirming the release notes');
        await expect(popup).toHaveCount(0);

        const releaseNotes = page.waitForResponse(res => isReleaseNotes(res.url()));
        await page.reload();
        await expectApiOk(await releaseNotes, 'loading the release notes');
        await expect(page.locator('app-gallery')).toBeVisible();
        await expect(popup, 'not again after a reload').toHaveCount(0);
      } finally {
        await deleteUserWithApi(admin, user.name);
        await admin.dispose();
      }
    });
  });
});
