/**
 * These tests are only used for docs screenshot generation:
 * DOCS_SCREENSHOTS=true npm run test-e2e -- docs-screens
 * It needs the docs photos in demo/images2/docs, those are not in git (see start-docs-e2e-server in package.json).
 * The screenshots are saved to test/playwright/screenshots.
 */
import {expect, Page, test} from '@playwright/test';
import {expectLightboxPhoto, expectVisiblePhotosLoaded, isGalleryContent} from './helpers';

const WIDTH = 1600;
const HEIGHT = 900;
// the server generates the thumbnails on the first request and the map tiles come from the internet
const LOAD_TIMEOUT = 20000;

/**
 * Waits for the animations and for all images on the screen (also the map tiles).
 */
const waitUntilReady = async (page: Page): Promise<void> => {
  await page.waitForTimeout(1000);
  await expect.poll(() => page.evaluate(() => {
    const onScreen = (el: Element): boolean => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.bottom > 0 && r.top < window.innerHeight;
    };
    return [...document.images].filter(img => onScreen(img) && !img.complete).length +
      [...document.querySelectorAll('.leaflet-container')].filter(map => onScreen(map) && !map.querySelector('.leaflet-tile-loaded')).length +
      // only the fade in of the photos: the toasts and the lightbox controls disappear if we wait for all animations
      document.getAnimations().filter(a => a.playState === 'running' && (a.effect as KeyframeEffect).target?.closest('app-gallery-grid')).length;
  }), {message: 'images, map tiles and photo animations on the screen that are not ready', timeout: LOAD_TIMEOUT}).toBe(0);
  await page.waitForTimeout(500); // Leaflet fades the tiles in without a CSS animation
};

const screenshot = async (page: Page, name: string, clip?: { x: number, y: number, width: number, height: number }): Promise<void> => {
  await waitUntilReady(page);
  await page.screenshot({path: `test/playwright/screenshots/${name}.png`, clip});
};

/**
 * The lightbox hides its controls while the mouse doesn't move, that can happen while the photo is loading.
 */
const lightboxScreenshot = async (page: Page, name: string): Promise<void> => {
  await waitUntilReady(page);
  await page.mouse.move(600, 400);
  await page.waitForTimeout(1100); // fade in of the controls
  await page.screenshot({path: `test/playwright/screenshots/${name}.png`});
};

test.describe('Docs generation', () => {
  test.skip(!process.env.DOCS_SCREENSHOTS, 'Only for the docs screenshots');
  test.use({viewport: {width: WIDTH, height: HEIGHT}});
  // one after the other: the first requests generate the thumbnails
  test.describe.configure({mode: 'default', timeout: 40000});

  // albums, faces and the search hints need all folders in the DB: global-setup.ts indexes them

  test.beforeEach(async ({page}) => {
    const content = page.waitForResponse(res => isGalleryContent(new URL(res.url())));
    await page.goto('/gallery/');
    await content;
    await expectVisiblePhotosLoaded(page, LOAD_TIMEOUT);
  });

  test('Main page', async ({page}) => {
    await screenshot(page, 'main_page');
  });

  test('lightbox', async ({page}) => {
    await page.goto('/gallery/?p=IMG_4330.jpg');
    await expect(page.locator('.photo-link > img[alt="IMG_4330.jpg"]')).toBeAttached(); // the main photo should be visible
    await page.locator('div[title="info key: i"]').click();
    await expectLightboxPhoto(page, 'IMG_4330.jpg', LOAD_TIMEOUT);
    await lightboxScreenshot(page, 'lightbox');
  });

  test('Map', async ({page}) => {
    await page.locator('app-gallery-map').click();
    await page.waitForTimeout(1000); // the markers move until the map is zoomed to the photos
    // a path marker covers the cluster, a real click would land on that
    await page.locator('div.leaflet-marker-icon span').filter({hasText: '9'}).first().dispatchEvent('click');
    await page.waitForTimeout(1000);
    await page.locator('img[src="/pgapi/gallery/content/./IMG_4303.jpg/icon"]').click();
    await screenshot(page, 'map');
  });

  test('Search', async ({page}) => {
    await page.locator('.search-text').pressSequentially('2-km-from:"Puerto Rico" and be');
    await expect(page.locator('.autocomplete-item').first()).toBeVisible();
    await screenshot(page, 'search', {x: 200, y: 0, width: WIDTH * 2 / 3, height: HEIGHT * 2 / 3});
  });

  test('Sharing', async ({page}) => {
    await page.locator('app-gallery-share').click();
    await page.locator('#getShareButton').click();
    await expect(page.locator('#shareLink')).toHaveValue(/http/);
    // the input is readonly, Playwright can't type into it
    await page.locator('#shareLink').evaluate((input: HTMLInputElement) => input.value = 'https://<your domain>/share/c87dbe82');
    await screenshot(page, 'sharing');
  });

  test('filters', async ({page}) => {
    await page.locator('app-gallery-navbar ng-icon[name="ionFunnelOutline"]').click();
    await screenshot(page, 'filters');
  });

  test('video', async ({page}) => {
    await page.goto('/gallery/?p=trip_video.mp4');
    await page.locator('div[title="info key: i"]').click();
    await page.locator('#swipeable-container').click();
    // seeking needs the length of the video
    await expect.poll(() => page.locator('video').evaluate((v: HTMLVideoElement) => v.duration > 0), {timeout: LOAD_TIMEOUT}).toBe(true);
    await page.locator('.controls-video input.video-progress').fill('73.51484960779216');
    await page.locator('#swipeable-container').click();
    await lightboxScreenshot(page, 'video');
  });

  test('settings', async ({page}) => {
    await page.locator('ng-icon[name="ionMenuOutline"]').click();
    await page.locator('ng-icon[name="ionSettingsOutline"]').click();
    await page.locator('#config-priority').click({force: true});
    await page.locator('button').filter({hasText: 'Advanced'}).click({force: true});
    await page.waitForTimeout(2000); // scrolling to the anchor would be off while the page renders the new settings
    await page.locator('.admin-menu button').filter({hasText: /^\s*Photo\s*$/}).click();
    await screenshot(page, 'settings');
  });

  test('albums', async ({page}) => {
    const albums = page.waitForResponse(res => new URL(res.url()).pathname === '/pgapi/albums');
    await page.goto('/albums');
    await albums;
    await screenshot(page, 'albums', {x: 0, y: 0, width: WIDTH * 2 / 3, height: HEIGHT * 2 / 3});
  });

  test('faces', async ({page}) => {
    const faces = page.waitForResponse(res => new URL(res.url()).pathname === '/pgapi/person');
    await page.goto('/faces');
    await faces;
    await screenshot(page, 'faces', {x: 0, y: 0, width: WIDTH * 2 / 3, height: HEIGHT * 2 / 3});
  });

  test('random link', async ({page}) => {
    await page.locator('ng-icon[name="ionMenuOutline"]').click();
    await page.locator('ng-icon[name="ionHammerOutline"]').click();
    await page.locator('ng-icon[name="ionShuffleOutline"]').click();
    await page.locator('#randomLink').fill('https://<your domain>/pgapi/gallery/random/{"type":1,"list":[{"type":104,"text":"Landscape","matchType":1},{"type":100,"text":"vuk"}]}', {force: true});
    await page.locator('.modal-dialog .search-text').pressSequentially('keyword:"Landscape" and vuk');
    await expect(page.locator('.modal-dialog .autocomplete-item').first()).toBeVisible();
    await screenshot(page, 'random_link');
  });

  test('blog', async ({page}) => {
    for (const button of await page.locator('app-gallery-blog .btn-blog-details').all()) {
      await button.dispatchEvent('click'); // a real click would scroll the page to the button
    }
    await screenshot(page, 'blog');
  });
});
