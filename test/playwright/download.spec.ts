// Downloading a folder as a zip from the navbar of the gallery (#1311, CUJ 32), as a user and as a guest of a sharing.
// The single photo download of the lightbox is in lightbox.spec.ts, the zip contents in detail in GalleryDownload.spec.ts (backend).
import {APIRequestContext, Download, expect, Page, test} from '@playwright/test';
import AdmZip from 'adm-zip';
import {ADMIN_SESSION} from './global-setup';
import {ACCENTED_DIR, notLoggedIn} from './helpers';

const SEARCH_DIRECTORY = 102; // SearchQueryTypes.directory
const EXACT_MATCH = 1; // TextSearchQueryMatchTypes.exact_match

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
    expect((await search).ok()).toBe(true);
    await expect(page.locator('.photo-container > img[alt="big_ben.jpg"]')).toBeVisible();
    const shown = await page.locator('app-gallery-grid .photo-container > img').evaluateAll(
      imgs => imgs.map(img => img.getAttribute('alt')!).sort());

    const {names} = await downloadZip(page);
    // every result, the same file names of different folders made unique (big_ben_only_time_2.jpg)
    expect(names).toHaveLength(shown.length);
    expect(names.map(n => n.replace(/_\d+(\.\w+)$/, '$1')).sort()).toEqual(shown);
  });

  test.describe('in a sharing', () => {
    test.use(notLoggedIn);
    let admin: APIRequestContext;
    let sharingKey: string;

    test.beforeEach(async ({playwright, baseURL}) => {
      admin = await playwright.request.newContext({baseURL, storageState: ADMIN_SESSION});
      const res = await admin.post('/pgapi/share/', {
        data: {
          createSharing: {
            valid: 24 * 60 * 60 * 1000,
            directoryQuery: {type: SEARCH_DIRECTORY, value: 'timestamps', matchType: EXACT_MATCH},
          },
        },
      });
      expect(res.ok(), 'creating the sharing').toBe(true);
      sharingKey = (await res.json()).result.sharingKey;
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
