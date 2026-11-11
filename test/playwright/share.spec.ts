import {APIRequestContext, expect, Page, test} from '@playwright/test';
import {ADMIN_SESSION} from './global-setup';
import {
  ACCENTED_DIR,
  createDirectorySharingWithApi,
  deleteSharingsWithApi,
  desktopViewport,
  expectApiOk,
  expectCardCover,
  expectInvalidLinkPage,
  expectLightboxPhoto,
  expectNavbar,
  expectNoHorizontalScroll,
  expectVisiblePhotosLoaded,
  logoutWithUi,
  NAVBAR_SHARE_IN_MENU_BELOW,
  notLoggedIn,
  scrollUntilAttached
} from './helpers';

// The e2e server serves the demo/images folder.
// timestamps has big_ben.jpg, dupl is an other directory next to it (without big_ben.jpg).
const SEARCH_FILE_NAME = 103; // SearchQueryTypes.file_name
const EXACT_MATCH = 1; // TextSearchQueryMatchTypes.exact_match
// the server generates the thumbnails on request (a few at a time); while the other tests load photos too,
// a thumbnail can take longer than the default 5 s
const THUMBNAIL_TIMEOUT = 15000;

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
  const fromMenu = (page.viewportSize()?.width ?? 1280) < NAVBAR_SHARE_IN_MENU_BELOW;
  if (fromMenu) {
    // e.g.: on a phone, Share is in the menu of the navbar
    await page.locator('button#button-frame-menu').click();
    await page.locator('#dropdown-frame-menu app-gallery-share button.dropdown-item').click();
  } else {
    await page.locator('button#shareButton').click();
  }
  await expect(page.locator('button#getShareButton')).toBeVisible();
  // the dialog keeps its settings while the page is open
  const recursive = page.locator('input#share-recursive');
  if (await recursive.count() > 0) {
    await recursive.setChecked(!!options.recursive);
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
  // the menu of the navbar stays open after its Share item
  if (fromMenu) {
    await expect(page.locator('#dropdown-frame-menu')).toBeVisible();
    await page.locator('button#button-frame-menu').click();
    await expect(page.locator('#dropdown-frame-menu')).toHaveCount(0);
  }
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
  test.use(desktopViewport({width: 1200, height: 600}));

  test.describe('Directory sharing', () => {

    // Sanity check: what a guest notices right away when opening a sharing. Soft checks, so one failure does not hide the others.
    test('Sharing should look right for a guest', {tag: '@sanity'}, async ({page}) => {
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
      await expectVisiblePhotosLoaded(page, THUMBNAIL_TIMEOUT);
      await expectNoHorizontalScroll(page, 'sharing');

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
      await expectNoHorizontalScroll(page, 'lightbox');
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
      await expectVisiblePhotosLoaded(page, THUMBNAIL_TIMEOUT);
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
      await expectVisiblePhotosLoaded(page, THUMBNAIL_TIMEOUT);
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
      await expectVisiblePhotosLoaded(page, THUMBNAIL_TIMEOUT);
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
      await expectVisiblePhotosLoaded(page, THUMBNAIL_TIMEOUT);
    });

    test('Sharing with subfolders should open subfolders', async ({page}) => {
      await openDirectory(page, '');
      const link = await createSharing(page, {recursive: true});
      await openSharingAsGuest(page, link, contentUrl);

      // the directory listing, not its media (content/timestamps/big_ben.jpg/...)
      await expectContent(page, /\/pgapi\/gallery\/content\/timestamps(\?|$)/, () =>
        page.locator('app-gallery-directory .directory-name').filter({hasText: 'timestamps'}).click());
      await expect(page.locator('.photo-container > img[alt="big_ben.jpg"]')).toBeVisible();
      await expectVisiblePhotosLoaded(page, THUMBNAIL_TIMEOUT);
    });

    test('Sharing of a folder with accents in its name should open it and its subfolder', async ({page}) => {
      await openDirectory(page, encodeURIComponent(ACCENTED_DIR));
      const link = await createSharing(page, {recursive: true});
      await openSharingAsGuest(page, link, contentUrl);

      await expect(page).toHaveURL(url => decodeURIComponent(url.pathname) === '/gallery/' + ACCENTED_DIR);
      await expect(page.locator('#directory-path li').last()).toContainText('űáéú őóüö');
      await expect(page.locator('.photo-container > img[alt="IMG_8943.jpg"]')).toBeVisible();
      await expectVisiblePhotosLoaded(page, THUMBNAIL_TIMEOUT);

      await expectContent(page, /\/pgapi\/gallery\/content\/[^?]*subdirectory(\?|$)/, () =>
        page.locator('app-gallery-directory .directory-name').filter({hasText: 'subdirectory'}).click());
      await expect(page).toHaveURL(url => decodeURIComponent(url.pathname) === '/gallery/' + ACCENTED_DIR + '/subdirectory');
      await expect(page.locator('.photo-container > img[alt="IMG_8824.jpg"]')).toBeVisible();
      await expectVisiblePhotosLoaded(page, THUMBNAIL_TIMEOUT);
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
      await page.locator('input#share-recursive').uncheck();
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
      await expectVisiblePhotosLoaded(page, THUMBNAIL_TIMEOUT);
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

  // the guest is not logged in; the sharings are created and deleted through the API as admin
  test.describe('Invalid sharing', () => {
    test.use(notLoggedIn);
    let admin: APIRequestContext;
    // the sharings a test created, deleted after it (also if it failed halfway)
    let created: string[];

    /**
     * Creates a directory sharing through the API (as admin) and returns its key. It is deleted after the test.
     */
    const createSharingForTest = async (dir: string, options: { password?: string, recursive?: boolean, valid?: number } = {}): Promise<string> => {
      const {sharingKey} = await createDirectorySharingWithApi(admin, dir, options);
      created.push(sharingKey);
      return sharingKey;
    };

    test.beforeEach(async ({playwright, baseURL}) => {
      admin = await playwright.request.newContext({baseURL, storageState: ADMIN_SESSION});
      created = [];
    });

    test.afterEach(async () => {
      await deleteSharingsWithApi(admin, created);
      await admin.dispose();
    });

    // Sanity check: what a guest notices right away on the password page of a sharing. Soft checks.
    test('Sharing login should look right for a guest', {tag: '@sanity'}, async ({page}) => {
      const sharingKey = await createSharingForTest('timestamps', {password: 'secret'});
      await page.goto('/share/' + sharingKey);
      await expect(page).toHaveURL(/\/shareLogin/);
      await expect.soft(page.locator('app-share-login h1'), 'title').toBeVisible();
      await expect.soft(page.locator('input#password'), 'password').toBeVisible();
      await expect.soft(page.locator('input#password'), 'password is masked').toHaveAttribute('type', 'password');
      await expect.soft(page.locator('button#button-share-login'), 'enter is disabled while empty').toBeDisabled();
      await expect.soft(page.locator('app-share-login app-language'), 'language switch').toBeVisible();
      await expect.soft(page.locator('.error-message'), 'no error').toBeHidden();
      await expect.soft(page.getByText('Unknown sharing key.'), 'the key is known').toHaveCount(0);
      // nothing of the shared folder before the password
      await expect.soft(page.locator('app-gallery'), 'no gallery').toHaveCount(0);
      await expectNoHorizontalScroll(page, 'sharing login');

      // the right password opens the folder
      await page.locator('input#password').fill('secret');
      await page.locator('button#button-share-login').click();
      await expect(page.locator('.photo-container > img[alt="big_ben.jpg"]')).toBeVisible();
    });

    test('Wrong password should show an error and stay on the sharing login', async ({page}) => {
      const sharingKey = await createSharingForTest('timestamps', {password: 'secret'});
      await page.goto('/share/' + sharingKey);
      await expect(page).toHaveURL(/\/shareLogin/);
      await page.locator('input#password').fill('wrong');
      const login = page.waitForResponse(res => new URL(res.url()).pathname === '/pgapi/share/login');
      await page.locator('button#button-share-login').click();
      expect((await login).status()).toBe(401);

      await expect(page.locator('.error-message')).toHaveText('Wrong password');
      await expect(page).toHaveURL(/\/shareLogin/);
      await expect(page.locator('input#password')).toBeVisible();
      await expect(page.locator('app-gallery')).toHaveCount(0);
    });

    test('Expired sharing should tell the guest that the link is invalid or has expired', async ({page}) => {
      test.fail(true, 'Not implemented yet #1307');
      // expires 1 ms after its creation
      const sharingKey = await createSharingForTest('timestamps', {valid: 1});
      await page.goto('/share/' + sharingKey);

      await expectInvalidLinkPage(page);
    });

    test('Sharing deleted while the guest has it open should show the invalid link page on the next navigation', async ({page}) => {
      test.fail(true, 'Not implemented yet #1307');
      const sharingKey = await createSharingForTest(ACCENTED_DIR, {recursive: true});
      await page.goto('/share/' + sharingKey);
      await expect(page.locator('.photo-container > img[alt="IMG_8943.jpg"]')).toBeVisible();

      await expectApiOk(await admin.delete('/pgapi/share/' + sharingKey), 'deleting the sharing');
      await page.locator('app-gallery-directory .directory-name').filter({hasText: 'subdirectory'}).click();

      await expectInvalidLinkPage(page);
    });

    test('Sharing deleted from the share list should not open anymore', async ({page, browser, playwright, baseURL}) => {
      const sharingKey = await createSharingForTest('timestamps');
      // the guest has the sharing open: logged in to it, with its session cookie
      await page.goto('/share/' + sharingKey);
      await expect(page.locator('.photo-container > img[alt="big_ben.jpg"]')).toBeVisible();
      // a request of the open page (with the session cookie), and the link itself in a fresh browser (no session)
      const guestSessionRequest = (): Promise<number> =>
        page.request.get('/pgapi/gallery/content/timestamps?sk=' + sharingKey).then(r => r.status());
      const fresh = await playwright.request.newContext({baseURL});
      const linkRequest = (): Promise<number> =>
        fresh.get('/pgapi/gallery/content/timestamps?sk=' + sharingKey).then(r => r.status());
      expect(await guestSessionRequest(), 'the open sharing works before the deletion').toBe(200);
      expect(await linkRequest(), 'the link works before the deletion').toBe(200);

      // the owner deletes it in the share dialog of the folder
      const ownerContext = await browser.newContext({storageState: ADMIN_SESSION, viewport: {width: 1200, height: 600}});
      try {
        const owner = await ownerContext.newPage();
        await openDirectory(owner, 'timestamps');
        await owner.locator('button#shareButton').click();
        await owner.locator('button.list-shares-button').click();
        const row = owner.locator('modal-container .modal-footer table tbody tr').filter({hasText: sharingKey});
        await expect(row).toHaveCount(1);
        const deleted = owner.waitForResponse(res => res.request().method() === 'DELETE' &&
          new URL(res.url()).pathname === '/pgapi/share/' + sharingKey);
        await row.locator('button.btn-danger').click();
        await expectApiOk(await deleted, 'deleting the sharing');
        await expect(row).toHaveCount(0);
      } finally {
        await ownerContext.close();
      }

      // the open sharing and its link stop working at once (what the open page shows is checked in the test above, #1307)
      expect(await guestSessionRequest(), 'the session of the guest ends').toBe(401);
      expect(await linkRequest(), 'the link stops working').toBe(401);
      await fresh.dispose();
    });
  });
});
