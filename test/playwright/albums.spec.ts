import {randomUUID} from 'node:crypto';
import {expect, Page, test} from '@playwright/test';
import {
  desktopViewport,
  expectCardCover,
  expectLightboxPhoto,
  expectNoHorizontalScroll,
  expectVisiblePhotosLoaded
} from './helpers';

const SEARCH_PERSON = 105; // SearchQueryTypes.person
const EXACT_MATCH = 1; // TextSearchQueryMatchTypes.exact_match

/**
 * Deletes the albums of the name through the API (clean up after a test).
 */
const deleteAlbumsNamed = async (page: Page, name: string): Promise<void> => {
  const albums: { id: number, name: string }[] = (await (await page.request.get('/pgapi/albums')).json()).result;
  for (const album of albums.filter(a => a.name === name)) {
    expect((await page.request.delete('/pgapi/albums/' + album.id)).ok(), 'deleting the album').toBe(true);
  }
};

const uniqueAlbumName = (): string => 'e2e album ' + randomUUID();

test.describe('Albums', () => {
  test.use(desktopViewport({width: 1200, height: 800}));
  let albumName: string;

  // The tests run in parallel on one server: every test adds its own album with a unique name and deletes it.
  test.beforeEach(async ({page}) => {
    albumName = uniqueAlbumName();
    const res = await page.request.put('/pgapi/albums/saved-searches', {
      data: {name: albumName, searchQuery: {type: SEARCH_PERSON, value: 'Alvin the Squirrel', matchType: EXACT_MATCH}},
    });
    expect(res.ok(), 'adding the album').toBe(true);
  });

  test.afterEach(async ({page}) => {
    await deleteAlbumsNamed(page, albumName);
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

// Adding and deleting an album through the UI (#1312, CUJ 25-28).
test.describe('Album journey', () => {
  test.use({viewport: {width: 1200, height: 800}});
  let albumName: string;

  test.beforeEach(() => {
    // accents: the album name is shown as typed
    albumName = 'Óbuda ' + uniqueAlbumName();
  });

  test.afterEach(async ({page}) => {
    await deleteAlbumsNamed(page, albumName);
  });

  /**
   * Searches, saves the search as an album with the search modal and opens the albums page.
   */
  const saveSearchAsAlbum = async (page: Page): Promise<void> => {
    const search = page.waitForResponse(res => new URL(res.url()).pathname.startsWith('/pgapi/search/'));
    await page.goto('/search/big_ben');
    expect((await search).ok()).toBe(true);
    await expect(page.locator('.photo-container > img[alt="big_ben.jpg"]')).toBeVisible();

    await page.locator('app-gallery-search ng-icon[name="ionChevronDownOutline"]').click();
    await page.locator('modal-container').getByRole('button', {name: 'Save'}).click();
    await page.locator('modal-container input#saveSearchName').fill(albumName);
    const saved = page.waitForResponse(res => new URL(res.url()).pathname === '/pgapi/albums/saved-searches');
    await page.locator('modal-container').getByRole('button', {name: 'Save as album'}).click();
    expect((await saved).ok(), 'saving the album').toBe(true);

    const albums = page.waitForResponse(res => new URL(res.url()).pathname === '/pgapi/albums');
    await page.goto('/albums');
    await albums;
  };

  test('should save a search as an album, open it and delete it', async ({page}) => {
    await saveSearchAsAlbum(page);

    // listed with its photo count and cover
    const card = page.locator('app-album').filter({hasText: albumName});
    await expect(card).toBeVisible();
    await expect(card.locator('.info')).toHaveText(/\(\d+\)/);
    expect(Number((await card.locator('.info').innerText()).match(/\((\d+)\)/)?.[1]), 'photo count').toBeGreaterThan(0);
    await expectCardCover(card);

    // opening it shows the photos of the search
    await card.click();
    await expect(page).toHaveURL(/\/search\//);
    await expect(page.locator('.photo-container > img[alt="big_ben.jpg"]')).toBeVisible();
    await expectVisiblePhotosLoaded(page);

    // deleting it removes it from the list
    await page.goto('/albums');
    page.on('dialog', dialog => dialog.accept());
    const deleted = page.waitForResponse(res => res.request().method() === 'DELETE' && new URL(res.url()).pathname.startsWith('/pgapi/albums/'));
    await card.locator('ng-icon.delete').click();
    // Today it deletes at once. With the confirmation of #1312 (a modal), confirm it; a browser dialog is accepted above.
    const confirm = page.locator('modal-container').getByRole('button', {name: /delete|yes|ok/i});
    const first = await Promise.race([deleted.then(() => 'deleted'), confirm.waitFor().then(() => 'confirm')]);
    if (first === 'confirm') {
      await confirm.click();
    }
    expect((await deleted).ok(), 'deleting the album').toBe(true);
    await expect(card).toHaveCount(0);
    const names = ((await (await page.request.get('/pgapi/albums')).json()).result as { name: string }[]).map(a => a.name);
    expect(names).not.toContain(albumName);
  });

  test('should ask for confirmation before deleting an album', async ({page}) => {
    test.fail(true, 'Not implemented yet #1312');
    await saveSearchAsAlbum(page);
    const card = page.locator('app-album').filter({hasText: albumName});
    await expect(card).toBeVisible();

    // either a browser confirm dialog or a modal; dismissed, so the album stays
    let asked = false;
    page.on('dialog', dialog => {
      asked = true;
      return dialog.dismiss();
    });
    await card.locator('ng-icon.delete').click();
    const modal = page.locator('modal-container');
    await expect.poll(async () => asked || await modal.isVisible(), {message: 'a confirmation is shown'}).toBe(true);
    if (!asked) {
      await modal.getByRole('button', {name: /cancel|no/i}).click();
    }
    await expect(card).toBeVisible();
    const names = ((await (await page.request.get('/pgapi/albums')).json()).result as { name: string }[]).map(a => a.name);
    expect(names, 'the album is not deleted').toContain(albumName);
  });
});

// Albums whose search matches nothing, and the albums of a .saved_searches.pg2conf file (#1312, CUJ 25-26).
test.describe('Album edge cases', () => {
  test.use(desktopViewport({width: 1200, height: 800}));

  test.describe('album whose search matches nothing', () => {
    let albumName: string;

    test.beforeEach(async ({page}, testInfo) => {
      albumName = 'Ürés ' + uniqueAlbumName(testInfo.workerIndex, testInfo.retry);
      const res = await page.request.put('/pgapi/albums/saved-searches', {
        data: {name: albumName, searchQuery: {type: SEARCH_PERSON, value: 'Nem Létező Személy', matchType: EXACT_MATCH}},
      });
      expect(res.ok(), 'adding the album').toBe(true);
    });

    test.afterEach(async ({page}) => {
      await deleteAlbumsNamed(page, albumName);
    });

    test('should stay in the albums with a placeholder cover and no photos', async ({page}) => {
      const albums = page.waitForResponse(res => new URL(res.url()).pathname === '/pgapi/albums');
      await page.goto('/albums');
      await albums;

      const card = page.locator('app-album').filter({hasText: albumName});
      await expect(card).toBeVisible();
      await expect(card.locator('.info')).toContainText(albumName + ' (0)');
      await expect(card.locator('.no-image')).toBeVisible();
      await expect(card.locator('.photo-container .photo')).toHaveCount(0);
    });

    test('should show the empty search message when opened', async ({page}) => {
      test.fail(true, 'Not implemented yet #1312: opening an album that matches nothing shows an empty page (#1309)');
      await page.goto('/albums');
      const card = page.locator('app-album').filter({hasText: albumName});
      const search = page.waitForResponse(res => new URL(res.url()).pathname.startsWith('/pgapi/search/'));
      await card.click();
      expect((await search).ok(), 'the search of the album').toBe(true);
      await expect(page).toHaveURL(/\/search\//);
      await expect(page.locator('app-gallery-grid .photo-container')).toHaveCount(0);

      // the empty state of a search that matched nothing (#1309, errors.spec.ts): a message with an icon
      const text = page.locator('app-gallery').getByText(/matched nothing|no (results|photos|media)/i);
      await expect(text).toBeVisible();
      await expect(text.locator('..').locator('ng-icon').first()).toBeVisible();
    });
  });

  // demo/images/.saved_searches.pg2conf defines "Group photos" and "Animals": indexing adds them as locked albums
  test('should list the albums of the .saved_searches.pg2conf file', async ({page}) => {
    const albums = page.waitForResponse(res => new URL(res.url()).pathname === '/pgapi/albums');
    await page.goto('/albums');
    await albums;

    for (const name of ['Group photos', 'Animals']) {
      const card = page.locator('app-album').filter({has: page.locator('.info', {hasText: new RegExp('^\\s*' + name + ' \\(')})});
      await expect(card, name).toHaveCount(1);
      // locked: can't be deleted from the page
      await expect(card.locator('ng-icon[name="ionLockClosedOutline"]'), name + ' is locked').toBeVisible();
      await expect(card.locator('ng-icon.delete'), name + ' has no delete').toHaveCount(0);
      expect(Number((await card.locator('.info').innerText()).match(/\((\d+)\)/)?.[1]), 'photo count of ' + name).toBeGreaterThan(0);
      await expectCardCover(card);
    }

    // Animals: the photos of any of the animals, e.g. the squirrel
    await page.locator('app-album').filter({hasText: 'Animals'}).click();
    await expect(page).toHaveURL(/\/search\//);
    await expect(page.locator('.photo-container > img[alt="IMG_5910.jpg"]')).toBeVisible();
  });
});
