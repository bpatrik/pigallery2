/**
 * These tests are only used for docs screenshot generation:
 * DOCS_SCREENSHOTS=true npm run test-e2e -- docs-screens
 * It runs on the demo photos in demo/images (see start-docs-e2e-server in package.json).
 * The screenshots (and the demo.gif / demo.mp4 of the docs main page) are saved to test/playwright/screenshots.
 */
import {Browser, expect, Locator, Page, test} from '@playwright/test';
import {spawnSync} from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';
import * as fs from 'node:fs';
import {clickNavbarTab, expectLightboxPhoto, expectVisiblePhotosLoaded} from './helpers';

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

  test('demo video', async ({browser}) => {
    test.setTimeout(240000);
    await recordTour(browser);
  });
});

const VIDEO = {width: 1280, height: 720};
const GIF_WIDTH = 800;
const GIF_FPS = 8;

/**
 * Playwright's video has no mouse pointer: this draws one, with a ring on every click.
 */
const fakeCursor = (): void => {
  window.addEventListener('DOMContentLoaded', () => {
    const style = document.createElement('style');
    style.textContent = `
      #demo-cursor {position: fixed; z-index: 2147483647; pointer-events: none; width: 24px; height: 24px;
        left: -100px; top: -100px; filter: drop-shadow(0 1px 2px rgba(0,0,0,.5));}
      .demo-click {position: fixed; z-index: 2147483646; pointer-events: none; width: 36px; height: 36px; margin: -18px 0 0 -18px;
        border-radius: 50%; border: 3px solid rgba(255,193,7,.9); animation: demo-click .5s ease-out forwards;}
      @keyframes demo-click {from {transform: scale(.3); opacity: 1;} to {transform: scale(1.3); opacity: 0;}}`;
    document.head.appendChild(style);
    const cursor = document.createElement('div');
    cursor.id = 'demo-cursor';
    cursor.innerHTML = '<svg viewBox="0 0 24 24" width="24" height="24"><path d="M3 2l7 19 2.6-7.4L20 11z" fill="#fff" stroke="#000" stroke-width="1.5" stroke-linejoin="round"/></svg>';
    document.body.appendChild(cursor);
    document.addEventListener('mousemove', e => {
      cursor.style.left = (e.clientX - 3) + 'px';
      cursor.style.top = (e.clientY - 2) + 'px';
    }, true);
    document.addEventListener('mousedown', e => {
      const ring = document.createElement('div');
      ring.className = 'demo-click';
      ring.style.left = e.clientX + 'px';
      ring.style.top = e.clientY + 'px';
      document.body.appendChild(ring);
      setTimeout(() => ring.remove(), 600);
    }, true);
  });
};

/**
 * Moves the mouse to the element like a person would (Playwright jumps there), then clicks it.
 */
const glideAndClick = async (page: Page, target: Locator, pause = 300): Promise<void> => {
  await target.scrollIntoViewIfNeeded({timeout: LOAD_TIMEOUT});
  const box = await target.boundingBox();
  if (!box) {
    throw new Error('not on the screen: ' + target);
  }
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, {steps: 25});
  await page.waitForTimeout(pause);
  await page.mouse.down();
  await page.mouse.up();
};

/**
 * Scrolls the page to y in an eased animation (mouse.wheel jumps, and the video catches half drawn frames).
 */
const smoothScrollTo = (page: Page, y: number, ms: number): Promise<void> => page.evaluate(({y, ms}) =>
  new Promise<void>(resolve => {
    const from = window.scrollY;
    const start = performance.now();
    const step = (now: number): void => {
      const t = ms > 0 ? Math.min(1, (now - start) / ms) : 1;
      const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; // easeInOutCubic
      // instant: the page has scroll-behavior: smooth, that would restart a smooth scroll on every frame
      window.scrollTo({top: from + (y - from) * eased, behavior: 'instant'});
      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        resolve();
      }
    };
    requestAnimationFrame(step);
  }), {y, ms});

const typeSlowly = async (page: Page, text: string): Promise<void> => {
  await page.keyboard.type(text, {delay: 120});
};

/**
 * Records the tour twice in one browser and keeps only the second one: the first one generates the thumbnails
 * and fills the browser cache (e.g.: map tiles), so the video doesn't show spinners or empty maps.
 */
const recordTour = async (browser: Browser): Promise<void> => {
  const context = await browser.newContext({
    viewport: VIDEO,
    storageState: test.info().project.use.storageState,
    baseURL: test.info().project.use.baseURL,
    recordVideo: {dir: 'test-results/demo-video', size: VIDEO},
  });
  await context.addInitScript(fakeCursor);
  const page = await context.newPage();
  const recordingStarted = Date.now();
  await tour(page, false, recordingStarted);
  const {start, end} = await tour(page, true, recordingStarted);

  const video = page.video();
  await context.close(); // saves the video
  if (!video) {
    throw new Error('no video recorded');
  }
  if (!ffmpegPath) {
    throw new Error('the GIF needs the ffmpeg-static package');
  }
  const ffmpegBin = ffmpegPath;
  const ffmpeg = (args: string[]): void => {
    const res = spawnSync(ffmpegBin, ['-y', '-hide_banner', '-loglevel', 'error', ...args], {encoding: 'utf8'});
    expect(res.status, 'ffmpeg ' + args.join(' ') + '\n' + res.stderr).toBe(0);
  };
  const mp4 = 'test/playwright/screenshots/demo.mp4';
  fs.mkdirSync('test/playwright/screenshots', {recursive: true});
  ffmpeg(['-ss', start.toFixed(2), '-to', end.toFixed(2), '-i', await video.path(),
    '-an', '-c:v', 'libx264', '-crf', '26', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4]);
  // from the mp4, not the webm: its smoother frames make a GIF of about half the size.
  // One palette for the whole GIF; only the changed parts of a frame are dithered, so it stays small.
  ffmpeg(['-i', mp4, '-vf', `fps=${GIF_FPS},scale=${GIF_WIDTH}:-1:flags=lanczos,split[a][b];` +
  '[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle',
    'test/playwright/screenshots/demo.gif']);
};

/**
 * The tour of the docs main page. It starts and ends on the same screen, so the GIF loops without a jump.
 * Returns when (in seconds of the video) the shown part starts and ends.
 * The warm-up (record = false) skips the pauses.
 */
const tour = async (page: Page, record: boolean, recordingStarted: number): Promise<{ start: number, end: number }> => {
  const hold = (ms: number): Promise<void> => page.waitForTimeout(record ? ms : 0);

  // the road trip folder with its blog
  await openFolder(page, '/gallery/');
  await waitUntilReady(page);
  await page.mouse.move(VIDEO.width / 2, VIDEO.height / 2);
  const tourStarted = (Date.now() - recordingStarted) / 1000;
  await hold(1500);

  // scroll through the blog and the photos
  // animated also in the warm-up: the grid adds photos on scroll events
  await smoothScrollTo(page, 1500, record ? 5000 : 1000);
  await hold(800);

  // a photo in the lightbox, with its info panel
  // one that is on the screen after the scroll: scrolling to another one would jump
  const firstOnScreen = (): Promise<number> => page.locator('app-gallery-grid-photo').evaluateAll(photos => photos.findIndex(p => {
    const r = p.getBoundingClientRect();
    const center = r.top + r.height / 2;
    return r.height > 0 && center > 150 && center < window.innerHeight - 100;
  }));
  await expect.poll(firstOnScreen, {message: 'a photo on the screen'}).toBeGreaterThanOrEqual(0);
  await glideAndClick(page, page.locator('app-gallery-grid-photo').nth(await firstOnScreen()));
  await expect(page.locator('app-lightbox-controls #rightArrow')).toBeAttached({timeout: LOAD_TIMEOUT});
  await hold(1500);
  await glideAndClick(page, page.locator('div[title="info key: i"]'));
  await hold(1500);
  for (let i = 0; i < 3; i++) {
    await glideAndClick(page, page.locator('app-lightbox-controls #rightArrow'), 100);
    await hold(1500);
  }
  await page.keyboard.press('Escape');
  await hold(800);

  // the Yosemite folder
  await smoothScrollTo(page, 0, record ? 1500 : 0);
  await hold(500);
  const content = page.waitForResponse(res => decodeURIComponent(new URL(res.url()).pathname) === '/pgapi/gallery/content/Yosemite NP');
  await glideAndClick(page, page.locator('app-gallery-directory').filter({hasText: 'Yosemite NP'}));
  await content;
  await expectVisiblePhotosLoaded(page, LOAD_TIMEOUT);
  await hold(2500);

  // the whole trip on the map, with the GPX tracks
  await glideAndClick(page, page.locator('nav[aria-label="breadcrumb"] a').first());
  await expectVisiblePhotosLoaded(page, LOAD_TIMEOUT);
  await hold(800);
  await glideAndClick(page, page.locator('app-gallery-map'));
  await page.waitForTimeout(2000); // also in the warm-up: the map zooms to the photos
  // zoom into the biggest cluster, then open a photo there
  const clusters = page.locator('.leaflet-marker-icon.marker-cluster');
  const counts = (await clusters.allInnerTexts()).map(Number);
  expect(counts.length, 'photo clusters on the map').toBeGreaterThan(0);
  await glideAndClick(page, clusters.nth(counts.indexOf(Math.max(...counts))));
  await page.waitForTimeout(1500); // the zoom animation
  const photoOnMap = (): Promise<number> => page.locator('img.photo-icon').evaluateAll(icons => icons.findIndex(icon => {
    const r = icon.getBoundingClientRect();
    return r.width > 0 && r.left > 50 && r.right < window.innerWidth - 50 && r.top > 50 && r.bottom < window.innerHeight - 50;
  }));
  await expect.poll(photoOnMap, {message: 'a photo on the zoomed map'}).toBeGreaterThanOrEqual(0);
  await glideAndClick(page, page.locator('img.photo-icon').nth(await photoOnMap()));
  await expect(page.locator('.leaflet-popup')).toBeVisible();
  await hold(2500);
  await page.keyboard.press('Escape');
  await hold(800);

  // search with the autocomplete hints
  await glideAndClick(page, page.locator('.search-text'));
  await typeSlowly(page, 'Balu');
  const hint = page.locator('.autocomplete-item').filter({hasText: 'Balu the bear'}).first();
  await expect(hint).toBeVisible();
  await page.waitForTimeout(1000); // also in the warm-up: the hints are redrawn while the requests of the keys return
  await glideAndClick(page, hint);
  await expectVisiblePhotosLoaded(page, LOAD_TIMEOUT);
  await hold(2500);

  // faces and albums
  await glideAndClick(page, page.locator('app-frame nav ul.navbar-nav.mb-0 .nav-link').filter({hasText: 'Faces'}));
  await expect(page.locator('app-face').first()).toBeVisible();
  await hold(2500);
  await glideAndClick(page, page.locator('app-frame nav ul.navbar-nav.mb-0 .nav-link').filter({hasText: 'Albums'}));
  await expect(page.locator('app-album').first()).toBeVisible();
  await hold(2500);

  // back to the start
  await clickNavbarTab(page, 'Gallery');
  await expectVisiblePhotosLoaded(page, LOAD_TIMEOUT);
  await page.mouse.move(VIDEO.width / 2, VIDEO.height / 2, {steps: 25});
  await waitUntilReady(page);
  await hold(1500);
  return {start: tourStarted, end: (Date.now() - recordingStarted) / 1000};
};
