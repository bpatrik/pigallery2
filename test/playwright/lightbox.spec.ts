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

  // A phone has no hover: a tap shows the faces, a double tap zooms (also on a face), a tap on a shown face opens its search.
  test('Tapping a face on a phone should show the faces first, not open the search', async ({page, isMobile}) => {
    test.skip(!isMobile, 'touch gestures: mobile project only');
    test.fail(true, 'Not implemented yet #1310: a tap on a hidden face box opens the search');
    await page.goto('/gallery/?p=IMG_5910.jpg');
    await expectLightboxPhoto(page, 'IMG_5910.jpg');
    await expect(page.locator('app-lightbox-controls #rightArrow')).toBeVisible();
    const face = page.locator('app-lightbox-controls .faces-container a.face').filter({hasText: 'Alvin the Squirrel'});
    const faceBox = face.locator('.face-box');
    const box = await face.boundingBox();
    expect(box, 'the face box of Alvin the Squirrel').not.toBeNull();
    const faceCenter = {x: box!.x + box!.width / 2, y: box!.y + box!.height / 2};
    const opacity = (): Promise<number> => faceBox.evaluate(el => Number(getComputedStyle(el).opacity));

    // the face is hidden until a tap shows it; the tap does not follow the link
    expect(await opacity()).toBe(0);
    await page.touchscreen.tap(faceCenter.x, faceCenter.y);
    await expect.poll(opacity, {message: 'face box opacity after a tap'}).toBeGreaterThan(0);
    await expect(page).toHaveURL(url => url.searchParams.get('p') === 'IMG_5910.jpg');

    // a double tap on the face zooms in and out, it does not open the search
    await doubleTap(page, faceCenter);
    await expect(zoomSlider(page)).toBeVisible();
    await expect(page).toHaveURL(url => url.searchParams.get('p') === 'IMG_5910.jpg');
    await doubleTap(page, faceCenter);
    await expect(zoomSlider(page)).toHaveCount(0);

    // a tap on the shown face opens the search of that person
    await page.touchscreen.tap(faceCenter.x, faceCenter.y);
    await expect.poll(opacity, {message: 'face box opacity after a tap'}).toBeGreaterThan(0);
    await page.touchscreen.tap(faceCenter.x, faceCenter.y);
    await expect(page).toHaveURL(/\/search\//);
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

  /**
   * Opens the first photo of the root and pages forward until a photo that was far below the screen; returns it.
   */
  const openAndPageForward = async (page: Page, isMobile: boolean): Promise<{ first: string, last: string }> => {
    const content = page.waitForResponse(res => isGalleryContent(new URL(res.url())));
    await page.goto('/gallery/');
    await content;
    const firstPhoto = page.locator('app-gallery-grid .photo-container > img').first();
    const first = (await firstPhoto.getAttribute('alt'))!;
    await firstPhoto.click();
    await expect(page).toHaveURL(url => url.searchParams.get('p') === first);
    await expect(page.locator('app-lightbox-controls #rightArrow')).toBeVisible();

    // paging replaces the URL, it does not add to the history
    const shown: (string | null)[] = [first];
    for (let i = 0; i < 12; i++) {
      await next(page, isMobile);
      await expect(page).not.toHaveURL(url => shown.includes(url.searchParams.get('p')));
      shown.push(shownPhoto(page));
    }
    const last = shownPhoto(page)!;
    await expectLightboxPhoto(page, last);
    return {first, last};
  };

  // CUJ 20 with the browser history (#1254): back closes the lightbox, forward opens it again on the same photo
  test('Browser back should close the lightbox, forward should open it again', async ({page, isMobile}) => {
    const {last} = await openAndPageForward(page, isMobile);

    await page.goBack();
    await expect(page).toHaveURL(url => url.pathname.startsWith('/gallery') && !url.searchParams.has('p'));
    await expect(lightboxImages(page)).toHaveCount(0);
    await expect(page.locator('app-gallery-grid .photo-container > img').first()).toBeVisible();

    await page.goForward();
    await expect(page).toHaveURL(url => url.searchParams.get('p') === last);
    await expectLightboxPhoto(page, last);
  });

  // #1310: closing scrolls the grid to the photo the lightbox was closed on; back closes it too
  test('Browser back should scroll the grid to the last shown photo, like closing', async ({page, isMobile}) => {
    test.fail(true, 'Not implemented yet #1310: back closes the lightbox, but the grid stays where the lightbox was opened');
    const {first, last} = await openAndPageForward(page, isMobile);

    await page.goBack();
    await expect(lightboxImages(page)).toHaveCount(0);
    await expect(photo(page, last)).toBeInViewport();
    await expect(photo(page, first)).not.toBeInViewport();
  });

  // CUJ 12 without a mouse (#1254): Tab to a photo of the grid, Enter opens it, Escape closes it (paging: see above)
  test('A photo of the grid should open with the keyboard', async ({page, isMobile}) => {
    test.skip(isMobile, 'keyboard: desktop only');
    test.fail(true, 'Not implemented yet #1254: the photos of the grid can not get the keyboard focus');
    const content = page.waitForResponse(res => isGalleryContent(new URL(res.url())));
    await page.goto('/gallery/');
    await content;
    const firstPhoto = page.locator('app-gallery-grid app-gallery-grid-photo').first();
    await expect(firstPhoto).toBeVisible();
    const name = await firstPhoto.locator('.photo-container > img').getAttribute('alt');

    // Tab through the page (navbar, folders, blog, ...) until the photo itself has the focus.
    // The links of its info bar (keywords, place) don't count: Enter on them opens a search.
    const photoFocused = (): Promise<boolean> => firstPhoto.evaluate(el => {
      const active = document.activeElement;
      return !!active && el.contains(active) && !active.closest('.info');
    });
    let focused = false;
    for (let i = 0; i < 60 && !focused; i++) {
      await page.keyboard.press('Tab');
      focused = await photoFocused();
    }
    expect(focused, 'the first photo of the grid gets the focus with Tab').toBe(true);

    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(url => url.searchParams.get('p') === name);
    await expectLightboxPhoto(page, name!);
    await expect(page.locator('app-lightbox-controls #rightArrow')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(lightboxImages(page)).toHaveCount(0);
  });

  // CUJ 15: the video plays, can be paused, and follows the loop setting (off by default)
  test('Lightbox should play a video, pause it and loop it with the switch', async ({page}) => {
    const video = page.locator('app-gallery-lightbox-media video').last();
    const currentTime = (): Promise<number> => video.evaluate((v: HTMLVideoElement) => v.currentTime);
    const paused = (): Promise<boolean> => video.evaluate((v: HTMLVideoElement) => v.paused);
    await page.goto('/gallery/?p=bunny.mp4');
    await expect(video).toBeAttached();
    await expect(video.locator('source')).toHaveAttribute('src', /bunny\.mp4/);
    await expect(page.locator('app-gallery-lightbox').getByText('Error during loading the video.')).toHaveCount(0);

    // autoplay; the play/pause button of the controls otherwise.
    // The controls fade out without hover (and on a phone until a tap), so the click is dispatched to the button.
    const playPause = page.locator('app-lightbox-controls .controls-video ng-icon').first();
    if (await paused()) {
      await playPause.dispatchEvent('click');
    }
    await expect.poll(currentTime, {message: 'the video plays'}).toBeGreaterThan(0);
    expect(await video.evaluate((v: HTMLVideoElement) => v.loop), 'no loop by default').toBe(false);

    await playPause.dispatchEvent('click');
    await expect.poll(paused, {message: 'the video is paused'}).toBe(true);
    const pausedAt = await currentTime();
    await expect(page.locator('app-lightbox-controls .controls-big-play')).toBeAttached();
    // stays where it was paused
    expect(await currentTime()).toBe(pausedAt);

    // the "l" key toggles the loop of the video
    await page.keyboard.press('l');
    await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.loop), {message: 'loop after the "l" key'}).toBe(true);
    await page.keyboard.press('l');
    await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.loop), {message: 'loop after the second "l" key'}).toBe(false);
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
