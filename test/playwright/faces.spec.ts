import {expect, Locator, test} from '@playwright/test';
import {isGalleryContent} from './helpers';

/**
 * The width of the loaded background image (the face thumbnail), 0 if it does not load.
 */
const backgroundImageWidth = (photo: Locator): Promise<number> => photo.evaluate(el => {
  const url = getComputedStyle(el).backgroundImage.match(/url\("(.*)"\)/)?.[1];
  return new Promise<number>(resolve => {
    if (!url) {
      return resolve(0);
    }
    const img = new Image();
    img.onload = () => resolve(img.naturalWidth);
    img.onerror = () => resolve(0);
    img.src = url;
  });
});

test.describe('Faces', () => {
  let personCount: number;

  test.beforeEach(async ({page}) => {
    // make sure that the dir is parsed before navigating to faces
    const content = page.waitForResponse(res => isGalleryContent(new URL(res.url())));
    await page.goto('/gallery/');
    await content;
    const persons = page.waitForResponse(res => new URL(res.url()).pathname === '/pgapi/person');
    await page.locator('nav .nav-item .nav-link').filter({hasText: 'Faces'}).click();
    personCount = (await (await persons).json()).result.length;
  });

  test('Show faces', async ({page}) => {
    await expect(page.locator('app-face a > .info').filter({hasText: 'Alvin the Squirrel'})).toBeVisible();
  });

  test('Faces should have photos', async ({page}) => {
    expect(personCount).toBeGreaterThan(0);
    // every face has a thumbnail, not the placeholder icon
    const photos = page.locator('app-face .photo-container .photo');
    await expect(photos).toHaveCount(personCount);
    await expect(page.locator('app-face .no-image')).toHaveCount(0);
    // and the thumbnails are loaded
    for (const photo of await photos.all()) {
      await expect(photo).toBeVisible();
      await expect.poll(() => backgroundImageWidth(photo)).toBeGreaterThan(0);
    }
  });
});
