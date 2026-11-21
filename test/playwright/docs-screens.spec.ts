/**
 * These tests are only used for docs screenshot generation:
 * DOCS_SCREENSHOTS=true npm run test-e2e -- docs-screens
 * It runs on the demo photos in demo/images (see start-docs-e2e-server in package.json).
 * The screenshots are saved to test/playwright/screenshots.
 */
import {expect, Page, test} from '@playwright/test';
import {expectLightboxPhoto, expectVisiblePhotosLoaded} from './helpers';

const WIDTH = 1600;
const HEIGHT = 900;
// the server generates the thumbnails on the first request and the map tiles come from the internet
const LOAD_TIMEOUT = 20000;
// its first screen is four of the best photos, so it is the background of most screenshots
const SHOWCASE_FOLDER = '/gallery/Yosemite%20NP';

const SEARCH_AND = 1; // SearchQueryTypes.AND
const SEARCH_RATING = 12; // SearchQueryTypes.rating
const SEARCH_DIRECTORY = 102; // SearchQueryTypes.directory
const SEARCH_KEYWORD = 104; // SearchQueryTypes.keyword
const SEARCH_PERSON = 105; // SearchQueryTypes.person
const EXACT_MATCH = 1; // TextSearchQueryMatchTypes.exact_match

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

const openFolder = async (page: Page, url: string): Promise<void> => {
  const folder = new URL(url, 'http://host').pathname.replace(/^\/gallery\//, '');
  const content = page.waitForResponse(res => new URL(res.url()).pathname === '/pgapi/gallery/content/' + folder);
  await page.goto(url);
  await content;
  await expectVisiblePhotosLoaded(page, LOAD_TIMEOUT);
};

test.describe('Docs generation', () => {
  test.skip(!process.env.DOCS_SCREENSHOTS, 'Only for the docs screenshots');
  test.use({viewport: {width: WIDTH, height: HEIGHT}});
  // one after the other: the first requests generate the thumbnails
  test.describe.configure({mode: 'default', timeout: 40000});

  // albums, faces and the search hints need all folders in the DB: global-setup.ts indexes them

  test('Main page', async ({page}) => {
    await openFolder(page, SHOWCASE_FOLDER);
    await screenshot(page, 'main_page');
  });

  test('lightbox', async ({page}) => {
    await openFolder(page, '/gallery/?p=IMG_1148.jpg');
    await expect(page.locator('.photo-link > img[alt="IMG_1148.jpg"]')).toBeAttached(); // the main photo should be visible
    await page.locator('div[title="info key: i"]').click();
    await expectLightboxPhoto(page, 'IMG_1148.jpg', LOAD_TIMEOUT);
    await lightboxScreenshot(page, 'lightbox');
  });

  test('Map', async ({page}) => {
    // the whole road trip with its GPX tracks
    await openFolder(page, '/gallery/');
    await page.locator('app-gallery-map').click();
    await page.waitForTimeout(1000); // the markers move until the map is zoomed to the photos
    // the popup of the Grand Teton photo
    await page.locator('img.photo-icon[src="/pgapi/gallery/content/./IMG_7925.jpg/icon"]').click();
    await expect(page.locator('.leaflet-popup')).toBeVisible();
    await screenshot(page, 'map');
  });

  test('Search', async ({page}) => {
    await openFolder(page, SHOWCASE_FOLDER);
    await page.locator('.search-text').clear();
    // the hints show keywords, a place and faces
    await page.locator('.search-text').pressSequentially('keyword:"Arizona" and be');
    await expect(page.locator('.autocomplete-item').first()).toBeVisible();
    await screenshot(page, 'search', {x: 200, y: 0, width: WIDTH * 2 / 3, height: HEIGHT * 2 / 3});
  });

  test('Sharing', async ({page}) => {
    await openFolder(page, SHOWCASE_FOLDER);
    await page.locator('app-gallery-share').click();
    await page.locator('#getShareButton').click();
    await expect(page.locator('#shareLink')).toHaveValue(/http/);
    // the input is readonly, Playwright can't type into it
    await page.locator('#shareLink').evaluate((input: HTMLInputElement) => input.value = 'https://<your domain>/share/c87dbe82');
    await screenshot(page, 'sharing');
  });

  test('filters', async ({page}) => {
    await openFolder(page, '/gallery/');
    await page.locator('app-gallery-navbar ng-icon[name="ionFunnelOutline"]').click();
    await screenshot(page, 'filters');
  });

  test('video', async ({page}) => {
    await openFolder(page, '/gallery/?p=bunny.mp4');
    await page.locator('div[title="info key: i"]').click();
    await page.locator('#swipeable-container').click();
    // seeking needs the length of the video
    await expect.poll(() => page.locator('video').evaluate((v: HTMLVideoElement) => v.duration > 0), {timeout: LOAD_TIMEOUT}).toBe(true);
    // at 26.1 s the bunny stares right at you
    await page.locator('video').evaluate((v: HTMLVideoElement) => new Promise(resolve => {
      v.pause();
      v.addEventListener('seeked', resolve, {once: true});
      v.currentTime = 26.1;
    }));
    await lightboxScreenshot(page, 'video');
  });

  test('settings', async ({page}) => {
    await openFolder(page, '/gallery/');
    await page.locator('ng-icon[name="ionMenuOutline"]').click();
    await page.locator('ng-icon[name="ionSettingsOutline"]').click();
    await page.locator('#config-priority').click({force: true});
    await page.locator('button').filter({hasText: 'Advanced'}).click({force: true});
    await page.waitForTimeout(2000); // scrolling to the anchor would be off while the page renders the new settings
    await page.locator('.admin-menu button').filter({hasText: /^\s*Photo\s*$/}).click();
    await screenshot(page, 'settings');
  });

  test('albums', async ({page}) => {
    // demo/images/.saved_searches.pg2conf adds "Animals" and "Group photos" (both with a bear cover);
    // these show other photos. The docs server starts with an empty DB on every run.
    const albums = [
      {name: 'Best of the trip', searchQuery: {type: SEARCH_RATING, min: 5}},
      {name: 'Antelope Canyon', searchQuery: {type: SEARCH_KEYWORD, value: 'Antelope canyon', matchType: EXACT_MATCH}},
      {name: 'Yellowstone', searchQuery: {type: SEARCH_DIRECTORY, value: 'Yellowstone NP', matchType: EXACT_MATCH}},
    ];
    for (const album of albums) {
      expect((await page.request.put('/pgapi/albums/saved-searches', {data: album})).ok()).toBe(true);
    }
    const res = page.waitForResponse(r => new URL(r.url()).pathname === '/pgapi/albums');
    await page.goto('/albums');
    await res;
    await screenshot(page, 'albums', {x: 0, y: 0, width: WIDTH * 2 / 3, height: HEIGHT * 2 / 3});
  });

  test('faces', async ({page}) => {
    const faces = page.waitForResponse(res => new URL(res.url()).pathname === '/pgapi/person');
    await page.goto('/faces');
    await faces;
    await screenshot(page, 'faces', {x: 0, y: 0, width: WIDTH * 2 / 3, height: HEIGHT * 2 / 3});
  });

  test('random link', async ({page}) => {
    await openFolder(page, '/gallery/');
    await page.locator('ng-icon[name="ionMenuOutline"]').click();
    await page.locator('ng-icon[name="ionHammerOutline"]').click();
    await page.locator('ng-icon[name="ionShuffleOutline"]').click();
    const query = {
      type: SEARCH_AND, list: [
        {type: SEARCH_KEYWORD, value: 'Bearizona', matchType: EXACT_MATCH},
        {type: SEARCH_PERSON, value: 'Balu the bear', matchType: EXACT_MATCH}]
    };
    await page.locator('#randomLink').fill('https://<your domain>/pgapi/gallery/random/' + JSON.stringify(query), {force: true});
    // the dialog starts with the opened folder (#1313)
    await page.locator('.modal-dialog .search-text').clear();
    await page.locator('.modal-dialog .search-text').pressSequentially('keyword:"Bearizona" and be');
    await expect(page.locator('.modal-dialog .autocomplete-item').first()).toBeVisible();
    await screenshot(page, 'random_link');
  });

  test('blog', async ({page}) => {
    await openFolder(page, SHOWCASE_FOLDER);
    for (const button of await page.locator('app-gallery-blog .btn-blog-details').all()) {
      await button.dispatchEvent('click'); // a real click would scroll the page to the button
    }
    await screenshot(page, 'blog');
  });
});
