import {expect, Page, test} from '@playwright/test';

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

const logout = async (page: Page): Promise<void> => {
  await page.locator('button#button-frame-menu').click();
  const loggedOut = page.waitForResponse(res => new URL(res.url()).pathname === '/pgapi/user/logout');
  await page.locator('#dropdown-frame-menu ng-icon[name="ionLogOutOutline"]').click();
  await loggedOut;
};

const getSharingKey = (link: string): string => new URL(link).pathname.split('/').pop() ?? '';

/**
 * Opens a sharing without password as a guest (not logged in user).
 */
const openSharingAsGuest = async (page: Page, link: string, url: RegExp): Promise<void> => {
  await logout(page);
  await expect(page.locator('#username')).toBeVisible();
  await expectContent(page, url, async () => {
    await page.goto(link);
    await expect(page.locator('app-gallery')).toBeAttached({timeout: 15000});
  });
};

const loginToSharing = async (page: Page, link: string, password: string): Promise<void> => {
  await page.goto('/shareLogin?sk=' + getSharingKey(link));
  await page.locator('input#password').fill(password);
  await page.locator('button#button-share-login').click();
  await expect(page.locator('app-gallery')).toBeAttached({timeout: 15000});
};

test.describe('Share', () => {
  test.use({viewport: {width: 1200, height: 600}});

  test.describe('Directory sharing', () => {

    test('Open no password sharing', async ({page}) => {
      await openDirectory(page, 'timestamps');
      const link = await createSharing(page);
      await openSharingAsGuest(page, link, contentUrl);

      await expect(page).toHaveURL(/\/gallery\/timestamps/);
      await expect(page.locator('.photo-container > img[alt="big_ben.jpg"]')).toBeVisible();
      // the parents are shown, but they can't be opened
      await expect(page.locator('#directory-path li').first().locator('a')).toHaveCount(0);
      await expect(page.locator('#directory-path li').last()).toContainText('timestamps');
    });

    test('Open password protected sharing', async ({page}) => {
      await openDirectory(page, 'timestamps');
      const link = await createSharing(page, {password: 'secret'});
      await logout(page);
      await expectContent(page, contentUrl, () => loginToSharing(page, link, 'secret'));

      await expect(page).toHaveURL(/\/gallery\/timestamps/);
      await expect(page.locator('.photo-container > img[alt="big_ben.jpg"]')).toBeVisible();
    });

    test('Open password protected sharing with logged in user', async ({page}) => {
      await openDirectory(page, 'timestamps');
      const link = await createSharing(page, {password: 'secret'});
      await expectContent(page, contentUrl, async () => {
        await page.goto(link);
        await expect(page.locator('.mb-0 > :nth-child(1) > .nav-link')).toContainText('Gallery');
      });
      await expect(page).toHaveURL(/\/gallery\/timestamps/);
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
    });

    test('Sharing with subfolders should open subfolders', async ({page}) => {
      await openDirectory(page, '');
      const link = await createSharing(page, {recursive: true});
      await openSharingAsGuest(page, link, contentUrl);

      // the directory listing, not its media (content/timestamps/big_ben.jpg/...)
      await expectContent(page, /\/pgapi\/gallery\/content\/timestamps(\?|$)/, () =>
        page.locator('app-gallery-directory .directory-name').filter({hasText: 'timestamps'}).click());
      await expect(page.locator('.photo-container > img[alt="big_ben.jpg"]')).toBeVisible();
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

      await logout(page);
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
      await logout(page);
      await loginToSharing(page, link, 'secret');

      await logout(page);
      await expect(page).toHaveURL(/\/shareLogin/);
      await expect(page.locator('input#password')).toBeVisible();
    });
  });
});
