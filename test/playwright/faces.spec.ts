import {expect, test} from '@playwright/test';
import {expectCardCover, expectVisiblePhotosLoaded} from './helpers';

test.describe('Faces', () => {

  // Sanity check: what a user notices right away when opening the faces. Soft checks, so one failure does not hide the others.
  test('Faces should look right', async ({page}) => {
    await page.goto('/gallery/');
    const persons = page.waitForResponse(res => new URL(res.url()).pathname === '/pgapi/person');
    await page.locator('nav .nav-item .nav-link').filter({hasText: 'Faces'}).click();
    const personCount = (await (await persons).json()).result.length;
    expect(personCount).toBeGreaterThan(0);

    // every face has a name and a loaded thumbnail, not the placeholder icon
    const faces = page.locator('app-face');
    await expect(faces).toHaveCount(personCount);
    for (const face of await faces.all()) {
      await expect.soft(face.locator('.info')).toHaveText(/\S+ \(\d+\)/);
      await expectCardCover(face);
    }

    // clicking a face opens the search of that person, with results
    await faces.filter({hasText: 'Alvin the Squirrel'}).click();
    await expect(page).toHaveURL(/\/search\//);
    await expect.soft(page.locator('app-gallery-search .search-text')).toHaveValue(/Alvin the Squirrel/);
    await expect(page.locator('.photo-container > img[alt="IMG_5910.jpg"]')).toBeVisible();
    await expectVisiblePhotosLoaded(page);
  });
});
