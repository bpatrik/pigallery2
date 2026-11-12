// Browsing folders (#1308, CUJ 5) on the folder with accents in its name (#1316). Also runs on a phone (mobile project).
import {expect, Page, test} from '@playwright/test';
import {ACCENTED_DIR, expectVisiblePhotosLoaded, isGalleryContent, scrollUntilAttached} from './helpers';

const photo = (page: Page, name: string) => page.locator(`.photo-container > img[alt="${name}"]`);
const breadcrumb = (page: Page) => page.locator('app-gallery-navbar #directory-path .breadcrumb-item');
const folderCard = (page: Page, name: string) => page.locator('app-gallery-directory').filter({hasText: name});

/**
 * Checks that the URL, the breadcrumb and the photos all show the folder.
 */
const expectFolder = async (page: Page, path: string, breadcrumbItems: string[], photos: string[]): Promise<void> => {
  // the root is /gallery or /gallery/
  await expect(page).toHaveURL(url => decodeURIComponent(url.pathname).replace(/\/$/, '') === ('/gallery/' + path).replace(/\/$/, ''));
  await expect(breadcrumb(page)).toHaveText(breadcrumbItems);
  for (const name of photos) {
    await scrollUntilAttached(page, photo(page, name));
  }
};

test.describe('Navigation', () => {

  test('Navigating folders should keep the URL, the breadcrumb and the content in sync', async ({page}) => {
    const root = (): Promise<void> => expectFolder(page, '', ['Home'], ['IMG_5910.jpg']);
    const accentedDir = (): Promise<void> =>
      expectFolder(page, ACCENTED_DIR, ['Home', ACCENTED_DIR], ['IMG_8943.jpg', 'IMG_9697.jpg']);
    const subDir = (): Promise<void> =>
      expectFolder(page, ACCENTED_DIR + '/subdirectory', ['Home', ACCENTED_DIR, 'subdirectory'], ['IMG_8824.jpg']);

    const content = page.waitForResponse(res => isGalleryContent(new URL(res.url())));
    await page.goto('/gallery/');
    await content;
    await root();

    // down: open a folder, then its subfolder
    await folderCard(page, ACCENTED_DIR).click();
    await accentedDir();
    await expectVisiblePhotosLoaded(page);
    // the root photos are gone
    await expect(photo(page, 'IMG_5910.jpg')).toHaveCount(0);
    await folderCard(page, 'subdirectory').click();
    await subDir();
    await expectVisiblePhotosLoaded(page);

    // up: with the breadcrumb, one level, then to the root
    await breadcrumb(page).getByRole('link', {name: ACCENTED_DIR}).click();
    await accentedDir();
    await breadcrumb(page).getByRole('link', {name: 'Home'}).click();
    await root();

    // the browser history follows the same way back and forward
    await page.goBack();
    await accentedDir();
    await page.goBack();
    await subDir();
    await page.goForward();
    await accentedDir();
  });

  // #1308: the browser history keeps the scroll position too, not only the URL and the content
  test('Browser back should restore the scroll position of the folder', async ({page}) => {
    test.fail(true, 'Not implemented yet #1308: back from a subfolder opens the folder at the top');
    const scrollY = (): Promise<number> => page.evaluate(() => window.scrollY);
    const content = page.waitForResponse(res => isGalleryContent(new URL(res.url())));
    await page.goto('/gallery/');
    await content;
    await expectVisiblePhotosLoaded(page);

    // scroll down the photos of the root, a screen at a time (the grid renders more of them while scrolling)
    await expect(async () => {
      await page.evaluate(() => window.scrollBy(0, window.innerHeight));
      expect(await scrollY()).toBeGreaterThan(1000);
    }, 'scrolled down').toPass({intervals: [200], timeout: 15000});
    const scrolledTo = await scrollY();
    // a photo on the screen there
    const belowName = await page.evaluate(() => [...document.querySelectorAll<HTMLImageElement>('app-gallery-grid .photo-container > img')]
      .find(img => img.getBoundingClientRect().top >= 0 && img.getBoundingClientRect().bottom <= window.innerHeight)?.alt);
    expect(belowName, 'a photo on the screen').toBeTruthy();

    // a folder link at the top of the page: clicked without scrolling up to it (like after scrolling, e.g. with alt + up)
    const folderLink = folderCard(page, ACCENTED_DIR).locator('a').first();
    await folderLink.evaluate((a: HTMLElement) => a.click());
    await expect(breadcrumb(page)).toHaveText(['Home', ACCENTED_DIR]);

    await page.goBack();
    await expect(breadcrumb(page)).toHaveText(['Home']);
    await expect.poll(scrollY, {message: 'the scroll position after back'}).toBeGreaterThan(scrolledTo - 50);
    expect(await scrollY()).toBeLessThan(scrolledTo + 50);
    // the same photos on the screen
    await expect(photo(page, belowName!)).toBeInViewport();
  });
});

test.describe('Empty folder', () => {

  // #1311: there is nothing to zip in a folder without media
  test('should not offer the zip download', async ({page}) => {
    const content = page.waitForResponse(res => new URL(res.url()).pathname === '/pgapi/gallery/content/emptydirectory');
    await page.goto('/gallery/emptydirectory');
    await content;
    await expect(breadcrumb(page)).toHaveText(['Home', 'emptydirectory']);
    await expect(page.locator('app-gallery-navbar ng-icon[name="ionDownloadOutline"]')).toHaveCount(0);

    // a folder with media has it
    await breadcrumb(page).getByRole('link', {name: 'Home'}).click();
    await expect(page.locator('app-gallery-navbar a[href*="/pgapi/gallery/zip/"] ng-icon[name="ionDownloadOutline"]')).toBeVisible();
  });
});
