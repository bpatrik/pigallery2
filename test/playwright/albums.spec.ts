import {expect, test} from '@playwright/test';
import {
  desktopViewport,
  expectCardCover,
  expectLightboxPhoto,
  expectNoHorizontalScroll,
  expectVisiblePhotosLoaded
} from './helpers';

const SEARCH_PERSON = 105; // SearchQueryTypes.person
const EXACT_MATCH = 1; // TextSearchQueryMatchTypes.exact_match

test.describe('Albums', () => {
  test.use(desktopViewport({width: 1200, height: 800}));
  let albumName: string;

  // The tests run in parallel on one server: every test adds its own album with a unique name and deletes it.
  test.beforeEach(async ({page}, testInfo) => {
    albumName = `e2e album ${testInfo.workerIndex}-${testInfo.retry}-${Date.now()}`;
    const res = await page.request.put('/pgapi/albums/saved-searches', {
      data: {name: albumName, searchQuery: {type: SEARCH_PERSON, value: 'Alvin the Squirrel', matchType: EXACT_MATCH}},
    });
    expect(res.ok(), 'adding the album').toBe(true);
  });

  test.afterEach(async ({page}) => {
    const albums: { id: number, name: string }[] = (await (await page.request.get('/pgapi/albums')).json()).result;
    for (const album of albums.filter(a => a.name === albumName)) {
      expect((await page.request.delete('/pgapi/albums/' + album.id)).ok(), 'deleting the album').toBe(true);
    }
  });

  // Sanity check: what a user notices right away when opening the albums. Soft checks, so one failure does not hide the others.
  test('Albums should look right', {tag: '@sanity'}, async ({page}) => {
    const albums = page.waitForResponse(res => new URL(res.url()).pathname === '/pgapi/albums');
    await page.goto('/albums');
    await albums;

    // the album card shows its name, its photo count and its cover
    const card = page.locator('app-album').filter({hasText: albumName});
    await expect(card).toBeVisible();
    const count = Number((await card.locator('.info').innerText()).match(/\((\d+)\)/)?.[1]);
    expect.soft(count, 'photo count of the album').toBeGreaterThan(0);
    await expectCardCover(card);
    await expectNoHorizontalScroll(page, 'albums');

    // opening it shows its photos
    await card.click();
    await expect(page).toHaveURL(/\/search\//);
    const squirrel = page.locator('.photo-container > img[alt="IMG_5910.jpg"]');
    await expect(squirrel).toBeVisible();
    await expectVisiblePhotosLoaded(page);
    await expect.soft(page.locator('app-gallery-grid .photo-container > img'), 'the photos of the album').toHaveCount(count);
    await expectNoHorizontalScroll(page, 'album photos');
    await squirrel.click();
    await expectLightboxPhoto(page, 'IMG_5910.jpg');
    await expectNoHorizontalScroll(page, 'lightbox');
  });
});
