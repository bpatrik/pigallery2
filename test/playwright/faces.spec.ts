import {expect, test} from '@playwright/test';
import {clickNavbarTab, expectCardCover, expectNoHorizontalScroll, expectVisiblePhotosLoaded} from './helpers';

test.describe('Faces', () => {

  // Sanity check: what a user notices right away when opening the faces. Soft checks, so one failure does not hide the others.
  test('Faces should look right', {tag: '@sanity'}, async ({page}) => {
    await page.goto('/gallery/');
    const persons = page.waitForResponse(res => new URL(res.url()).pathname === '/pgapi/person');
    await clickNavbarTab(page, 'Faces');
    const personCount = (await (await persons).json()).result.length;
    expect(personCount).toBeGreaterThan(0);

    // every face has a name and a loaded thumbnail, not the placeholder icon
    const faces = page.locator('app-face');
    await expect(faces).toHaveCount(personCount);
    for (const face of await faces.all()) {
      await expect.soft(face.locator('.info')).toHaveText(/\S+ \(\d+\)/);
      await expectCardCover(face);
    }
    // the faces fit the screen: see the next test

    // clicking a face opens the search of that person, with results
    await faces.filter({hasText: 'Alvin the Squirrel'}).click();
    await expect(page).toHaveURL(/\/search\//);
    await expect.soft(page.locator('app-gallery-search .search-text')).toHaveValue(/Alvin the Squirrel/);
    await expect(page.locator('.photo-container > img[alt="IMG_5910.jpg"]')).toBeVisible();
    await expectVisiblePhotosLoaded(page);
    await expectNoHorizontalScroll(page, 'search of a face');
  });

  // UI fits the screen, a phone too (#1316). A separate test, so the known phone bug does not hide the other checks above.
  test('Faces should fit the screen', {tag: '@sanity'}, async ({page, isMobile}) => {
    // the demo has a person called "abcdefghijklmnopqrstuvwxyz": one long word, the name does not wrap in its card
    test.fail(isMobile, 'Not implemented yet #1316: a long face name sticks out of its card and of the phone screen');
    const persons = page.waitForResponse(res => new URL(res.url()).pathname === '/pgapi/person');
    await page.goto('/faces');
    await persons;
    await expect(page.locator('app-face').first()).toBeVisible();
    await expectNoHorizontalScroll(page, 'faces');
  });
});
