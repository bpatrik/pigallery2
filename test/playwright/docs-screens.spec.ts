/**
 * These tests are only used for docs screenshot generation:
 * DOCS_SCREENSHOTS=true npx playwright test docs-screens
 * The screenshots are saved to test/playwright/screenshots.
 */
import {expect, Page, test} from '@playwright/test';
import {isGalleryContent} from './helpers';

const WIDTH = 1600;
const HEIGHT = 900;
const screenshot = (page: Page, name: string, clip?: { x: number, y: number, width: number, height: number }) =>
  page.screenshot({path: `test/playwright/screenshots/${name}.png`, clip});

test.describe('Docs generation', () => {
  test.skip(!process.env.DOCS_SCREENSHOTS, 'Only for the docs screenshots');
  test.use({viewport: {width: WIDTH, height: HEIGHT}});

  test.beforeEach(async ({page}) => {
    const content = page.waitForResponse(res => isGalleryContent(new URL(res.url())));
    await page.goto('/gallery/');
    await content;
  });

  test('Main page', async ({page}) => {
    await page.waitForTimeout(1000);
    await screenshot(page, 'main_page');
  });

  test('lightbox', async ({page}) => {
    await page.goto('/gallery/?p=IMG_4330.jpg');
    await expect(page.locator('.photo-container > img[alt="IMG_4330.jpg"]')).toBeAttached(); // the main photo should be visible
    await page.locator('div[title="info key: i"]').click();
    await page.waitForTimeout(1000);
    await screenshot(page, 'lightbox');
  });

  test('Map', async ({page}) => {
    await page.locator('app-gallery-map').click();
    await page.locator('div.leaflet-marker-icon span').filter({hasText: '9'}).first().click({force: true});
    await page.locator('img[src="/pgapi/gallery/content/./IMG_4303.jpg/icon"]').click();
    await page.waitForTimeout(1000);
    await screenshot(page, 'map');
  });

  test('Search', async ({page}) => {
    await page.locator('.search-text').pressSequentially('2-km-from:"Puerto Rico" and be');
    await page.waitForTimeout(1000);
    await screenshot(page, 'search', {x: 200, y: 0, width: WIDTH * 2 / 3, height: HEIGHT * 2 / 3});
  });

  test('Sharing', async ({page}) => {
    await page.locator('app-gallery-share').click();
    await page.locator('#getShareButton').click();
    await expect(page.locator('#shareLink')).toHaveValue(/http/);
    await page.locator('#shareLink').fill('https://<your domain>/share/c87dbe82', {force: true});
    await page.waitForTimeout(1000);
    await screenshot(page, 'sharing');
  });

  test('filters', async ({page}) => {
    await page.locator('app-gallery-navbar ng-icon[name="ionFunnelOutline"]').click();
    await page.waitForTimeout(1000);
    await screenshot(page, 'filters');
  });

  test('video', async ({page}) => {
    await page.goto('/gallery/?p=trip_video.mp4');
    await page.locator('div[title="info key: i"]').click();
    await page.locator('#swipeable-container').click();
    await page.locator('.controls-video input.video-progress').fill('73.51484960779216');
    await page.locator('#swipeable-container').click();
    await page.waitForTimeout(1000);
    await screenshot(page, 'video');
  });

  test('settings', async ({page}) => {
    await page.locator('ng-icon[name="ionMenuOutline"]').click();
    await page.locator('ng-icon[name="ionSettingsOutline"]').click();
    await page.locator('#config-priority').click({force: true});
    await page.locator('button').filter({hasText: 'Advanced'}).click({force: true});
    await page.locator('.admin-menu button').filter({hasText: /^\s*Photo\s*$/}).click();
    await page.waitForTimeout(1000);
    await screenshot(page, 'settings');
  });

  test('albums', async ({page}) => {
    const albums = page.waitForResponse(res => new URL(res.url()).pathname === '/pgapi/albums');
    await page.goto('/albums');
    await albums;
    await page.waitForTimeout(1000);
    await screenshot(page, 'albums', {x: 0, y: 0, width: WIDTH * 2 / 3, height: HEIGHT * 2 / 3});
  });

  test('faces', async ({page}) => {
    const faces = page.waitForResponse(res => new URL(res.url()).pathname === '/pgapi/person');
    await page.goto('/faces');
    await faces;
    await page.waitForTimeout(1000);
    await screenshot(page, 'faces', {x: 0, y: 0, width: WIDTH * 2 / 3, height: HEIGHT * 2 / 3});
  });

  test('random link', async ({page}) => {
    await page.locator('ng-icon[name="ionMenuOutline"]').click();
    await page.locator('ng-icon[name="ionHammerOutline"]').click();
    await page.locator('ng-icon[name="ionShuffleOutline"]').click();
    await page.locator('#randomLink').fill('https://<your domain>/pgapi/gallery/random/{"type":1,"list":[{"type":104,"text":"Landscape","matchType":1},{"type":100,"text":"vuk"}]}', {force: true});
    await page.locator('.modal-dialog .search-text').pressSequentially('keyword:"Landscape" and vuk');
    await page.waitForTimeout(1000);
    await screenshot(page, 'random_link');
  });

  test('blog', async ({page}) => {
    await page.waitForTimeout(1000);
    for (const button of await page.locator('app-gallery-blog .btn-blog-details').all()) {
      await button.click({force: true});
    }
    await screenshot(page, 'blog');
  });
});
