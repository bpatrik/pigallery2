// Viewing photos in the lightbox (#1310, CUJ 12, 13, 20) and downloading one (#1311, CUJ 19).
// Also runs on a phone (mobile project): there it pages with a swipe instead of the keyboard.
import {expect, Page, test} from '@playwright/test';
import {ACCENTED_DIR, expectLightboxPhoto, isGalleryContent, swipe} from './helpers';

const photo = (page: Page, name: string) => page.locator(`.photo-container > img[alt="${name}"]`);
const lightboxImages = (page: Page) => page.locator('app-gallery-lightbox-media img');
const shownPhoto = (page: Page): string | null => new URL(page.url()).searchParams.get('p');

/**
 * The next photo: with a swipe on a touch screen, with the right arrow key otherwise.
 */
const next = async (page: Page, isMobile: boolean): Promise<void> => {
  if (isMobile) {
    await swipe(page, -200);
  } else {
    await page.keyboard.press('ArrowRight');
  }
};

/**
 * The previous photo: with a swipe on a touch screen, with the left arrow key otherwise.
 */
const previous = async (page: Page, isMobile: boolean): Promise<void> => {
  if (isMobile) {
    await swipe(page, 200);
  } else {
    await page.keyboard.press('ArrowLeft');
  }
};

test.describe('Lightbox', () => {

  test('Lightbox should page to the next and previous photo and close', async ({page, isMobile}) => {
    const content = page.waitForResponse(res => isGalleryContent(new URL(res.url())));
    await page.goto('/gallery/');
    await content;
    const firstPhoto = page.locator('app-gallery-grid .photo-container > img').first();
    const first = await firstPhoto.getAttribute('alt');
    const second = await page.locator('app-gallery-grid .photo-container > img').nth(1).getAttribute('alt');
    await firstPhoto.click();
    await expect(page).toHaveURL(url => url.searchParams.get('p') === first);
    await expectLightboxPhoto(page, first!);

    // the first photo has no previous one
    await expect(page.locator('app-lightbox-controls #leftArrow')).toHaveCount(0);

    await next(page, isMobile);
    await expect(page).toHaveURL(url => url.searchParams.get('p') === second);
    await expectLightboxPhoto(page, second!);

    await previous(page, isMobile);
    await expect(page).toHaveURL(url => url.searchParams.get('p') === first);
    await expectLightboxPhoto(page, first!);

    // the arrow button pages as well
    await page.locator('app-lightbox-controls #rightArrow').click();
    await expect(page).toHaveURL(url => url.searchParams.get('p') === second);

    if (isMobile) {
      await page.locator('app-lightbox-controls ng-icon[name="ionCloseOutline"]').click();
    } else {
      await page.keyboard.press('Escape');
    }
    await expect(lightboxImages(page)).toHaveCount(0);
    await expect(page).toHaveURL(url => url.pathname === '/gallery/' && !url.searchParams.has('p'));
  });

  test('Closing the lightbox should scroll the grid to the last shown photo', async ({page, isMobile}) => {
    const content = page.waitForResponse(res => isGalleryContent(new URL(res.url())));
    await page.goto('/gallery/');
    await content;
    const firstPhoto = page.locator('app-gallery-grid .photo-container > img').first();
    await firstPhoto.click();
    await expect(page).toHaveURL(url => url.searchParams.has('p'));

    // page forward until a photo that was far below the screen
    const shown = [shownPhoto(page)];
    for (let i = 0; i < 12; i++) {
      await next(page, isMobile);
      await expect(page).not.toHaveURL(url => shown.includes(url.searchParams.get('p')));
      shown.push(shownPhoto(page));
    }
    const last = shownPhoto(page)!;
    await expectLightboxPhoto(page, last);

    await page.keyboard.press('Escape');
    await expect(lightboxImages(page)).toHaveCount(0);
    await expect(photo(page, last)).toBeInViewport();
    // the grid scrolled down there, the first photo is out of the screen
    await expect(firstPhoto).not.toBeInViewport();
  });

  test('Lightbox should download the photo with its original name', async ({page}) => {
    // a folder with accents in its name: the download URL has to encode them
    await page.goto('/gallery/' + encodeURIComponent(ACCENTED_DIR) + '?p=IMG_8943.jpg');
    await expectLightboxPhoto(page, 'IMG_8943.jpg');

    await page.locator('app-lightbox-controls button#button-basic').click();
    const downloading = page.waitForEvent('download');
    await page.locator('app-lightbox-controls #dropdown-basic a.dropdown-item').filter({hasText: 'Download'}).click();
    const download = await downloading;

    expect(download.suggestedFilename()).toBe('IMG_8943.jpg');
    expect(await download.failure()).toBeNull();
  });
});
