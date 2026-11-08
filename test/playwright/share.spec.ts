import {expect, Page, test} from '@playwright/test';
import {
  ACCENTED_DIR,
  expectCardCover,
  expectLightboxPhoto,
  expectNavbar,
  expectVisiblePhotosLoaded,
  logoutWithUi,
  scrollUntilAttached
} from './helpers';

// The e2e server serves the demo/images folder.
// timestamps has big_ben.jpg, dupl is an other directory next to it (without big_ben.jpg).
const SEARCH_FILE_NAME = 103; // SearchQueryTypes.file_name
const EXACT_MATCH = 1; // TextSearchQueryMatchTypes.exact_match

// directory listing only, not the media (e.g.: content/dir/photo.jpg/320)
const contentUrl = /\/pgapi\/gallery\/content\/(?![^?]*\.\w+\/\d+)/;
const searchUrl = /\/pgapi\/search\//;

/**
 * Waits for a response of the url that has content and no error.
 * The response is always fresh: routing disables the browser cache, and the cache headers are removed,
 * so the server never answers with 304.
 */
const expectContent = async (page: Page, url: RegExp, action: () => Promise<unknown>): Promise<void> => {
  await page.route(url, route => {
    const headers = {...route.request().headers()};
    delete headers['if-none-match'];
    delete headers['if-modified-since'];
    return route.continue({headers});
  });
  const response = page.waitForResponse(res => url.test(res.url()) && res.request().method() === 'GET');
  await action();
  const res = await response;
  await page.unroute(url);
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body, 'API call has data').not.toBeNull();
  expect(body?.error, 'API call has no error: ' + res.url()).toBeFalsy();
};

const openDirectory = async (page: Page, dir: string): Promise<void> => {
  await expectContent(page, contentUrl, () => page.goto('/gallery/' + dir));
};

/**
 * Creates a sharing from the share dialog of the current view and returns its link.
 */
const createSharing = async (page: Page, options: { password?: string, recursive?: boolean } = {}): Promise<string> => {
  await page.locator('button#shareButton').click();
  await expect(page.locator('button#getShareButton')).toBeVisible();
  // the dialog keeps its settings while the page is open
  const recursive = page.locator('input#share-recursive');
  if (await recursive.count() > 0) {
    await recursive.setChecked(!!options.recursive, {force: true});
  }
  if (options.password) {
    await page.locator('input#share-password').fill(options.password);
  }
  await page.locator('button#getShareButton').click();
  const shareLink = page.locator('input#shareLink');
  await expect(shareLink).toHaveValue(/http/);
  const link = await shareLink.inputValue();
  // the "copied to clipboard" toast has a close button too
  await page.locator('modal-container button.btn-close').click();
  return link;
};

/**
 * A sharing always shows how long its link is available (e.g.: Link availability: 29 days, 23:59:58).
 * It updates every second, so it shows up a second after the page loads.
 */
const expectCountDown = async (page: Page): Promise<void> => {
  await expect(page.locator('nav').getByText(/Link availability\s*:\s*\d+\s*days\s*,\s*\d\d:\d\d\s*:\d\d/)).toBeVisible();
};

const getSharingKey = (link: string): string => new URL(link).pathname.split('/').pop() ?? '';

/**
 * Opens a sharing without password as a guest (not logged in user).
 */
const openSharingAsGuest = async (page: Page, link: string, url: RegExp): Promise<void> => {
  await logoutWithUi(page);
  await expect(page.locator('#username')).toBeVisible();
  await expectContent(page, url, async () => {
    await page.goto(link);
    await expect(page.locator('app-gallery')).toBeAttached({timeout: 15000});
  });
  await expectCountDown(page);
};

const loginToSharing = async (page: Page, link: string, password: string): Promise<void> => {
  await page.goto('/shareLogin?sk=' + getSharingKey(link));
  await page.locator('input#password').fill(password);
  await page.locator('button#button-share-login').click();
  await expect(page.locator('app-gallery')).toBeAttached({timeout: 15000});
  await expectCountDown(page);
};

test.describe('Share', () => {
  test.use({viewport: {width: 1200, height: 600}});

  test.describe('Directory sharing', () => {

    // Sanity check: what a guest notices right away when opening a sharing. Soft checks, so one failure does not hide the others.
    test('Sharing should look right for a guest', async ({page}) => {
      await openDirectory(page, '');
      const link = await createSharing(page, {recursive: true});
      await openSharingAsGuest(page, link, contentUrl);

      // nothing to navigate to outside the sharing: no tabs, no search, no sharing, no admin
      await expectNavbar(page, {tabs: [], search: false, share: false, admin: false});

      // folders render with their covers (emptydirectory has nothing to show)
      const folders = page.locator('app-gallery-directory').filter({hasNotText: 'emptydirectory'});
      await expect(folders.first()).toBeVisible();
      for (const folder of await folders.all()) {
        await expectCardCover(folder);
      }
      await expectVisiblePhotosLoaded(page);

      // search links don't work in a sharing: the keywords and the place of the info bar are plain text
      const squirrel = page.locator('.photo-container > img[alt="IMG_5910.jpg"]');
      await scrollUntilAttached(page, squirrel);
      await squirrel.scrollIntoViewIfNeeded();
      await squirrel.hover();
      const info = squirrel.locator('..').locator('.info');
      await expect.soft(info.locator('.photo-keywords span').filter({hasText: 'Alvin the Squirrel'})).toBeVisible();
      await expect.soft(info.locator('.photo-position span').filter({hasText: 'Berkeley'})).toBeVisible();
      await expect.soft(info.locator('a'), 'no search links in the info bar').toHaveCount(0);

      // the lightbox shows the photo, its faces and the info panel without search links
      await squirrel.click();
      await expectLightboxPhoto(page, 'IMG_5910.jpg');
      await expect.soft(page.locator('app-lightbox-controls .faces-container .face-name')
        .filter({hasText: 'Alvin the Squirrel'})).toBeAttached();
      await expect.soft(page.locator('app-lightbox-controls a.face'), 'faces are no search links').toHaveCount(0);
      await page.keyboard.press('i');
      await expect(page.locator('app-info-panel .keywords').filter({hasText: 'Berkley'})).toBeVisible();
      await expect.soft(page.locator('app-info-panel a[href*="/search/"]'), 'no search links in the info panel').toHaveCount(0);
    });

    test('Open no password sharing', async ({page}) => {
      await openDirectory(page, 'timestamps');
      const link = await createSharing(page);
      await openSharingAsGuest(page, link, contentUrl);

      await expect(page).toHaveURL(/\/gallery\/timestamps/);
      await expect(page.locator('.photo-container > img[alt="big_ben.jpg"]')).toBeVisible();
      await expectVisiblePhotosLoaded(page);
      // the parents are shown, but they can't be opened
      await expect(page.locator('#directory-path li').first().locator('a')).toHaveCount(0);
      await expect(page.locator('#directory-path li').last()).toContainText('timestamps');
    });

    test('Open password protected sharing', async ({page}) => {
      await openDirectory(page, 'timestamps');
      const link = await createSharing(page, {password: 'secret'});
      await logoutWithUi(page);
      await expectContent(page, contentUrl, () => loginToSharing(page, link, 'secret'));

      await expect(page).toHaveURL(/\/gallery\/timestamps/);
      await expect(page.locator('.photo-container > img[alt="big_ben.jpg"]')).toBeVisible();
      await expectVisiblePhotosLoaded(page);
    });

    test('Open password protected sharing with logged in user', async ({page}) => {
      await openDirectory(page, 'timestamps');
      const link = await createSharing(page, {password: 'secret'});
      await expectContent(page, contentUrl, async () => {
        await page.goto(link);
        await expect(page.locator('.mb-0 > :nth-child(1) > .nav-link')).toContainText('Gallery');
      });
      await expect(page).toHaveURL(/\/gallery\/timestamps/);
      // a logged in user sees the sharing as a sharing too
      await expectCountDown(page);
      await expectVisiblePhotosLoaded(page);
    });

    test('Sharing without subfolders should not open subfolders', async ({page}) => {
      await openDirectory(page, '');
      const link = await createSharing(page);
      await openSharingAsGuest(page, link, contentUrl);

      await expect(page.locator('.photo-container > img[alt="IMG_5910.jpg"]')).toBeAttached();
      await expect(page.locator('app-gallery-directory')).toHaveCount(0);
      // not available directories look like not existing ones
      expect((await page.request.get('/pgapi/gallery/content/timestamps')).status()).toBe(404);
      expect((await page.request.get('/pgapi/gallery/content/not_existing_dir')).status()).toBe(404);
      // the app navigates back to the shared directory
      await page.goto('/gallery/timestamps');
      await expect(page).not.toHaveURL(/timestamps/);
      await expect(page.locator('.photo-container > img[alt="IMG_5910.jpg"]')).toBeAttached();
      await expectCountDown(page);
      await expectVisiblePhotosLoaded(page);
    });

    test('Sharing with subfolders should open subfolders', async ({page}) => {
      await openDirectory(page, '');
      const link = await createSharing(page, {recursive: true});
      await openSharingAsGuest(page, link, contentUrl);

      // the directory listing, not its media (content/timestamps/big_ben.jpg/...)
      await expectContent(page, /\/pgapi\/gallery\/content\/timestamps(\?|$)/, () =>
        page.locator('app-gallery-directory .directory-name').filter({hasText: 'timestamps'}).click());
      await expect(page.locator('.photo-container > img[alt="big_ben.jpg"]')).toBeVisible();
      await expectVisiblePhotosLoaded(page);
    });

    test('Sharing of a folder with accents in its name should open it and its subfolder', async ({page}) => {
      await openDirectory(page, encodeURIComponent(ACCENTED_DIR));
      const link = await createSharing(page, {recursive: true});
      await openSharingAsGuest(page, link, contentUrl);

      await expect(page).toHaveURL(url => decodeURIComponent(url.pathname) === '/gallery/' + ACCENTED_DIR);
      await expect(page.locator('#directory-path li').last()).toContainText('űáéú őóüö');
      await expect(page.locator('.photo-container > img[alt="IMG_8943.jpg"]')).toBeVisible();
      await expectVisiblePhotosLoaded(page);

      await expectContent(page, /\/pgapi\/gallery\/content\/[^?]*subdirectory(\?|$)/, () =>
        page.locator('app-gallery-directory .directory-name').filter({hasText: 'subdirectory'}).click());
      await expect(page).toHaveURL(url => decodeURIComponent(url.pathname) === '/gallery/' + ACCENTED_DIR + '/subdirectory');
      await expect(page.locator('.photo-container > img[alt="IMG_8824.jpg"]')).toBeVisible();
      await expectVisiblePhotosLoaded(page);
    });

    test('Share dialog should list the sharings with and without subfolders', async ({page}) => {
      // dupl: the other tests share other directories, so they can run in parallel with this one.
      // Earlier runs (or retries) might have shared it already.
      const resp = await page.request.get('/pgapi/share/listAll');
      const before = (await resp.json()).result.filter((s: { directoryQuery?: { value: string } }) =>
        ['dupl', 'dupl/*'].includes(s.directoryQuery?.value ?? '')).length;

      await openDirectory(page, 'dupl');
      await createSharing(page);
      await createSharing(page, {recursive: true});

      await page.locator('button#shareButton').click();
      await expect(page.locator('button.list-shares-button .badge')).toHaveText((before + 2).toString());
      await page.locator('button.list-shares-button').click();
      const rows = page.locator('modal-container .modal-footer table tbody tr');
      await expect(rows).toHaveCount(before + 2);
      await expect(rows.locator('td').filter({hasText: /^\s*Yes\s*$/}).first()).toBeVisible();
      await expect(rows.locator('td').filter({hasText: /^\s*No\s*$/}).first()).toBeVisible();
      await expect(rows.first().locator('ng-icon[name="ionCopyOutline"]')).toBeVisible();

      // the list does not depend on the subfolder switch
      await page.locator('input#share-recursive').uncheck({force: true});
      await expect(rows).toHaveCount(before + 2);
    });
  });

  test.describe('Search sharing', () => {
    test('Open search sharing', async ({page}) => {
      const query = {type: SEARCH_FILE_NAME, value: 'big_ben.jpg', matchType: EXACT_MATCH};
      await expectContent(page, searchUrl, () => page.goto('/search/' + encodeURIComponent(JSON.stringify(query))));

      const link = await createSharing(page);
      await openSharingAsGuest(page, link, searchUrl);

      await expect(page).toHaveURL(/\/search\//);
      await expect(page.locator('.photo-container > img[alt="big_ben.jpg"]')).toBeVisible();
      await expectVisiblePhotosLoaded(page);
      // only the directories with shared photos (and their parents) can be opened
      expect((await page.request.get('/pgapi/gallery/content/timestamps')).status()).toBe(200);
      expect((await page.request.get('/pgapi/gallery/content/')).status()).toBe(200);
      expect((await page.request.get('/pgapi/gallery/content/dupl')).status()).toBe(404);
    });
  });

  test.describe('Logout', () => {
    test('Logout from no password sharing should go to the login page', async ({page}) => {
      await openDirectory(page, 'timestamps');
      const link = await createSharing(page);
      await openSharingAsGuest(page, link, contentUrl);

      await logoutWithUi(page);
      await expect(page).toHaveURL(/\/login/);
      await expect(page).not.toHaveURL(/shareLogin/);
      await expect(page.locator('#username')).toBeVisible();
      // the sharing is dropped
      await page.goto('/');
      await expect(page).toHaveURL(/\/login/);
      await expect(page.locator('#username')).toBeVisible();
    });

    test('Logout from password protected sharing should go to the sharing login', async ({page}) => {
      await openDirectory(page, 'timestamps');
      const link = await createSharing(page, {password: 'secret'});
      await logoutWithUi(page);
      await loginToSharing(page, link, 'secret');

      await logoutWithUi(page);
      await expect(page).toHaveURL(/\/shareLogin/);
      await expect(page.locator('input#password')).toBeVisible();
    });
  });
});
