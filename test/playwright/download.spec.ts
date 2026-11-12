// Downloading a folder as a zip from the navbar of the gallery (#1311, CUJ 32), as a user and as a guest of a sharing.
// The single photo download of the lightbox is in lightbox.spec.ts, the zip contents in detail in GalleryDownload.spec.ts (backend).
import {APIRequestContext, Download, expect, Page, test} from '@playwright/test';
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
    await expect(page.locator('.photo-container > img[alt="IMG_8943.jpg"]')).toBeVisible();

    const {download, names} = await downloadZip(page);
    expect(download.suggestedFilename()).toMatch(/\.zip$/);
    expect(names).toEqual(['IMG_8943.jpg', 'IMG_9697.jpg']);
  });

  test('should download the results of a search as a zip', async ({page}) => {
    const search = page.waitForResponse(res => new URL(res.url()).pathname.startsWith('/pgapi/search/'));
    await page.goto('/search/big_ben');
    await expectApiOk(await search, 'the search');
    await expect(page.locator('.photo-container > img[alt="big_ben.jpg"]')).toBeVisible();
    const shown = await page.locator('app-gallery-grid .photo-container > img').evaluateAll(
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
      await expect(page.locator('.photo-container > img[alt="big_ben.jpg"]')).toBeVisible();

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
});
