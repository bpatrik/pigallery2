// Downloading a folder as a zip from the navbar of the gallery (#1311, CUJ 32), as a user and as a guest of a sharing.
// The single photo download of the lightbox is in lightbox.spec.ts, the zip contents in detail in GalleryDownload.spec.ts (backend).
import {APIRequestContext, Download, expect, Locator, Page, test} from '@playwright/test';
import AdmZip from 'adm-zip';
import {ADMIN_SESSION, ACCENTED_DIR, createDirectorySharingWithApi, expectApiOk, notLoggedIn} from './helpers';

const zipButton = (page: Page) => page.locator('app-gallery-navbar a.btn-navigator:has(ng-icon[name="ionDownloadOutline"])');

/**
 * Clicks the zip download of the navbar and returns the names of the files in the zip.
 */
const downloadZip = async (page: Page): Promise<{ download: Download, names: string[] }> => {
  await expect(zipButton(page)).toBeVisible();
  const downloadEvent = page.waitForEvent('download');
  await zipButton(page).click();
  const download = await downloadEvent;
  expect(await download.failure(), 'the zip download fails').toBeNull();
  const zip = new AdmZip(await download.path());
  const names = zip.getEntries().filter(e => !e.isDirectory).map(e => e.entryName.split('/').pop()!).sort();
  return {download, names};
};

test.describe('Zip download', () => {
  test.use({viewport: {width: 1200, height: 800}});

  test('should download the photos of the folder with accents as a zip', async ({page}) => {
    await page.goto('/gallery/' + encodeURIComponent(ACCENTED_DIR));
    await expect(page.locator('.photo-link > img[alt="IMG_8943.jpg"]')).toBeVisible();

    const {download, names} = await downloadZip(page);
    expect(download.suggestedFilename(), 'named after the folder').toBe(ACCENTED_DIR + '.zip');
    expect(names).toEqual(['IMG_8943.jpg', 'IMG_9697.jpg']);
  });

  test('should download the results of a search as a zip', async ({page}) => {
    const search = page.waitForResponse(res => new URL(res.url()).pathname.startsWith('/pgapi/search/'));
    await page.goto('/search/big_ben');
    await expectApiOk(await search, 'the search');
    await expect(page.locator('.photo-link > img[alt="big_ben.jpg"]')).toBeVisible();
    const shown = await page.locator('app-gallery-grid .photo-link > img').evaluateAll(
      imgs => imgs.map(img => img.getAttribute('alt')!).sort());

    const {names} = await downloadZip(page);
    // every result; the same file name of different folders is made unique with a number (big_ben_only_time_2.jpg).
    // Only a name that is not a result itself is such a renamed copy (e.g.: IMG_5910.jpg is no copy of IMG.jpg).
    const original = (n: string): string => shown.includes(n) ? n : n.replace(/_\d+(\.\w+)$/, '$1');
    expect(names).toHaveLength(shown.length);
    expect(new Set(names).size, 'unique names in the zip').toBe(names.length);
    expect(names.map(original).sort()).toEqual(shown);
  });

  test.describe('in a sharing', () => {
    test.use(notLoggedIn);
    let admin: APIRequestContext;
    let sharingKey: string;

    test.beforeEach(async ({playwright, baseURL}) => {
      admin = await playwright.request.newContext({baseURL, storageState: ADMIN_SESSION});
      sharingKey = (await createDirectorySharingWithApi(admin, 'timestamps')).sharingKey;
    });

    test.afterEach(async () => {
      await admin.delete('/pgapi/share/' + sharingKey);
      await admin.dispose();
    });

    test('Guest should download the shared folder as a zip', async ({page}) => {
      await page.goto('/share/' + sharingKey);
      await expect(page.locator('.photo-link > img[alt="big_ben.jpg"]')).toBeVisible();

      const {names} = await downloadZip(page);
      expect(names).toEqual([
        'big_ben.jpg',
        'big_ben_no_tsoffset_but_gps_utc.jpg',
        'big_ben_only_time.jpg',
        'newyear_london.jpg',
        'newyear_sydney.jpg',
        'sydney_opera_house.jpg',
        'sydney_opera_house_no_tsoffset_but_gps_utc.jpg',
      ]);
    });
  });

  test.describe('in a sharing that prevents downloading (#1158)', () => {
    test.use(notLoggedIn);
    let admin: APIRequestContext;
    let sharingKey: string;

    test.beforeEach(async ({playwright, baseURL}) => {
      admin = await playwright.request.newContext({baseURL, storageState: ADMIN_SESSION});
      sharingKey = (await createDirectorySharingWithApi(admin, 'timestamps', {preventDownload: true})).sharingKey;
    });

    test.afterEach(async () => {
      await admin.delete('/pgapi/share/' + sharingKey);
      await admin.dispose();
    });

    /**
     * Right clicks the middle of the element, also if something covers it (e.g.: the lightbox controls cover the photo).
     * The browser offers "Save image as" only if an img or video gets the click and the page does not prevent it:
     * returns whether that could happen.
     */
    const canSaveWithRightClick = async (page: Page, element: Locator): Promise<boolean> => {
      await page.evaluate(() => window.addEventListener('contextmenu', e => {
        (window as unknown as { lastMenu: unknown }).lastMenu = {tag: (e.target as HTMLElement).tagName, prevented: e.defaultPrevented};
      }, {once: true}));
      const box = (await element.boundingBox())!;
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, {button: 'right'});
      const menu = await page.evaluate(() => (window as unknown as { lastMenu: { tag: string, prevented: boolean } }).lastMenu);
      return ['IMG', 'VIDEO'].includes(menu.tag) && !menu.prevented;
    };

    test('Guest should not get the download options', async ({page}) => {
      await page.goto('/share/' + sharingKey);
      const photo = '.photo-link > img[alt="big_ben.jpg"]';
      await expect(page.locator(photo)).toBeVisible();
      await expect(zipButton(page), 'zip').toHaveCount(0);
      expect(await canSaveWithRightClick(page, page.locator(photo)), 'save the photo of the grid').toBe(false);

      await page.locator(photo).click();
      await expect(page.locator('app-lightbox-controls #rightArrow')).toBeVisible();
      await expect(page.locator('app-gallery-lightbox-media img').last()).toBeVisible();
      // the large photo is the last img, on top of the thumbnail
      expect(await canSaveWithRightClick(page, page.locator('app-gallery-lightbox-media img').last()), 'save the photo of the lightbox').toBe(false);
      await page.locator('app-lightbox-controls button#button-basic').click();
      await expect(page.locator('app-lightbox-controls #dropdown-basic')).toBeVisible();
      await expect(page.locator('app-lightbox-controls #dropdown-basic a.dropdown-item').filter({hasText: 'Download'})).toHaveCount(0);
    });
  });
});
