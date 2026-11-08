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
});
