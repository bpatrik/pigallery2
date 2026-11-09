// Viewing photos in the lightbox (#1310, CUJ 12, 13, 20) and downloading one (#1311, CUJ 19).
// Also runs on a phone (mobile project): there it pages with a swipe instead of the keyboard.
import {expect, Page, test} from '@playwright/test';
import {ACCENTED_DIR, doubleTap, expectLightboxPhoto, isGalleryContent, pinch, swipe} from './helpers';

const photo = (page: Page, name: string) => page.locator(`.photo-container > img[alt="${name}"]`);
const lightboxImages = (page: Page) => page.locator('app-gallery-lightbox-media img');
const shownPhoto = (page: Page): string | null => new URL(page.url()).searchParams.get('p');
const zoomSlider = (page: Page) => page.locator('app-lightbox-controls .controls-zoom input.zoom-progress');

/**
 * The zoom of the photo in the lightbox: the scale of its transform.
 */
const photoScale = (page: Page): Promise<number> => lightboxImages(page).first()
  .evaluate((img: HTMLImageElement) => Number(img.style.transform.match(/scale\(([\d.]+)\)/)?.[1] ?? 1));

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

    // the controls show up once the opening animation ended; a key pressed before that is lost
    await expect(page.locator('app-lightbox-controls #rightArrow')).toBeVisible();
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
    await expect(page).toHaveURL(url => url.pathname.startsWith('/gallery') && !url.searchParams.has('p'));
  });

  // CUJ 12 on a phone: open, zoom in and out with the fingers, swipe to the next photo, close (#1316)
  test('Lightbox should zoom with pinch and double tap, swipe and close on a phone', async ({page, isMobile}) => {
    test.skip(!isMobile, 'touch gestures: mobile project only');
    const content = page.waitForResponse(res => isGalleryContent(new URL(res.url())));
    await page.goto('/gallery/');
    await content;
    // a photo without faces: a tap on a face opens the search of that person, it would end the double tap
    const gridPhoto = page.locator('app-gallery-grid .photo-container > img').nth(1);
    const first = await gridPhoto.getAttribute('alt');
    await gridPhoto.click();
    await expect(page).toHaveURL(url => url.searchParams.get('p') === first);
    await expectLightboxPhoto(page, first!);
    await expect(page.locator('app-lightbox-controls #rightArrow')).toBeVisible();
    await expect(page.locator('app-lightbox-controls .faces-container .face'), 'faces of ' + first).toHaveCount(0);
    await expect(zoomSlider(page)).toHaveCount(0);

    // spreading two fingers zooms in: the zoom slider shows up and the photo is scaled up
    await pinch(page, 3);
    await expect(zoomSlider(page)).toBeVisible();
    await expect.poll(() => photoScale(page), {message: 'photo scale after pinching out'}).toBeGreaterThan(1.5);
    expect(Number(await zoomSlider(page).inputValue())).toBeGreaterThan(1.5);
    // a swipe pans the zoomed photo instead of paging
    await expect(page.locator('app-lightbox-controls #rightArrow')).toHaveCount(0);

    // pinching the fingers together zooms out to the original size
    await pinch(page, 0.2);
    await expect(zoomSlider(page)).toHaveCount(0);
    await expect.poll(() => photoScale(page), {message: 'photo scale after pinching in'}).toBe(1);

    // a double tap zooms in, the next one zooms out
    await doubleTap(page);
    await expect(zoomSlider(page)).toBeVisible();
    await expect.poll(() => photoScale(page), {message: 'photo scale after a double tap'}).toBeGreaterThan(1.5);
    await doubleTap(page);
    await expect(zoomSlider(page)).toHaveCount(0);
    await expect.poll(() => photoScale(page), {message: 'photo scale after the second double tap'}).toBe(1);

    // swipe to the next photo
    await expect(page).toHaveURL(url => url.searchParams.get('p') === first);
    await expect(page.locator('app-lightbox-controls #rightArrow')).toBeVisible();
    await swipe(page, -200);
    await expect(page).toHaveURL(url => !!url.searchParams.get('p') && url.searchParams.get('p') !== first);
    const second = shownPhoto(page)!;
    await expectLightboxPhoto(page, second);

    await page.locator('app-lightbox-controls ng-icon[name="ionCloseOutline"]').click();
    await expect(lightboxImages(page)).toHaveCount(0);
    await expect(page).toHaveURL(url => url.pathname.startsWith('/gallery') && !url.searchParams.has('p'));
  });

  test('Closing the lightbox should scroll the grid to the last shown photo', async ({page, isMobile}) => {
    const content = page.waitForResponse(res => isGalleryContent(new URL(res.url())));
    await page.goto('/gallery/');
    await content;
    const firstPhoto = page.locator('app-gallery-grid .photo-container > img').first();
    await firstPhoto.click();
    await expect(page).toHaveURL(url => url.searchParams.has('p'));
    // the controls show up once the opening animation ended; a key pressed before that is lost
    await expect(page.locator('app-lightbox-controls #rightArrow')).toBeVisible();

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

  test('Lightbox should tell when a video fails to load', async ({page}) => {
    // the video itself (the original or its transcoded version), not its thumbnail
    const isVideo = (url: URL): boolean => /\/bunny\.mp4(\/bestFit)?$/.test(url.pathname);
    await page.route(isVideo, route => route.fulfill({status: 404, body: 'Not Found'}));
    const failed = page.waitForResponse(res => isVideo(new URL(res.url())));
    await page.goto('/gallery/?p=bunny.mp4');
    expect((await failed).status()).toBe(404);

    await expect(page.locator('app-gallery-lightbox').getByText('Error during loading the video.')).toBeVisible();
    // the lightbox stays open, it can be closed as usual
    await expect(page.locator('app-lightbox-controls ng-icon[name="ionCloseOutline"]')).toBeVisible();
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
