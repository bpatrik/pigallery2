import {expect, test} from '@playwright/test';
import {isGalleryContent} from './helpers';

test.describe('Faces', () => {
  test.beforeEach(async ({page}) => {
    // make sure that the dir is parsed before navigating to faces
    const content = page.waitForResponse(res => isGalleryContent(new URL(res.url())));
    await page.goto('/gallery/');
    await content;
    const persons = page.waitForResponse(res => new URL(res.url()).pathname === '/pgapi/person');
    await page.locator('nav .nav-item .nav-link').filter({hasText: 'Faces'}).click();
    await persons;
  });

  test('Show faces', async ({page}) => {
    await expect(page.locator('app-face a > .info').filter({hasText: 'Alvin the Squirrel'})).toBeVisible();
  });

  test('Faces should have photos', async ({page}) => {
    await expect(page.locator('app-face .photo-container .photo').first()).toBeVisible();
  });
});
