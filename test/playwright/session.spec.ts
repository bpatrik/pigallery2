// The session of a logged-in user ends while the app is open on a deep link (#1306):
// the next API call gets a 401 → /login, and after logging in again the user lands back on that URL.
import {APIRequestContext, expect, Page, test} from '@playwright/test';
import {
  ADMIN_SESSION,
  ACCENTED_DIR,
  createUserWithApi,
  deleteUserWithApi,
  expectApiOk,
  expectLightboxPhoto,
  isGalleryContent,
  loginWithUi,
  notLoggedIn,
  TestUser,
  trackPendingApiRequests
} from './helpers';

// a directory listing, not its media (e.g.: content/dir/photo.jpg/320)
const isDirectoryContent = (url: URL): boolean => /^\/pgapi\/gallery\/content\/(?!.*\.\w+\/\d+$)/.test(url.pathname);

/**
 * Logs in on the login page that the app redirected to, without opening '/' first (loginWithUi would),
 * so the app can still take the user back to where the session ended.
 */
const loginOnCurrentLoginPage = async (page: Page, user: TestUser): Promise<void> => {
  await expect(page).toHaveURL(/\/login/);
  await page.locator('#username').fill(user.name);
  await page.locator('#password').fill(user.password);
  const login = page.waitForResponse(res => new URL(res.url()).pathname === '/pgapi/user/login');
  await page.locator('.col-sm-12 > .btn').click();
  await expectApiOk(await login, 'login');
};

test.use(notLoggedIn);

test.describe('Session ends on a deep link', () => {
  test.use({viewport: {width: 1200, height: 800}});
  let admin: APIRequestContext;
  // a user of its own, so deleting it does not affect the other tests
  let user: TestUser;

  test.beforeEach(async ({playwright, baseURL}) => {
    admin = await playwright.request.newContext({baseURL, storageState: ADMIN_SESSION});
    user = await createUserWithApi(admin, 'e2e-session-return');
  });

  test.afterEach(async () => {
    await deleteUserWithApi(admin, user.name);
    await admin.dispose();
  });

  /**
   * Logs in, opens the url and waits for the response that shows it.
   */
  const loginAndOpen = async (page: Page, url: string, isContent: (u: URL) => boolean): Promise<void> => {
    // the gallery root that the login opens; otherwise its answer could be taken for the answer of the url below
    const root = page.waitForResponse(res => isGalleryContent(new URL(res.url())));
    await loginWithUi(page, user.name, user.password);
    await expect(page).toHaveURL(/\/gallery/);
    await root;
    const content = page.waitForResponse(res => isContent(new URL(res.url())));
    await page.goto(url);
    await expectApiOk(await content, 'loading ' + url);
  };

  const endSession = async (): Promise<void> => {
    expect(await deleteUserWithApi(admin, user.name), 'the user existed').toBe(true);
  };

  // the part that works already: the ended session is noticed on a deep link too
  test('Photo deep link should go to the login page after the user was deleted', async ({page}) => {
    await loginAndOpen(page, '/gallery/?p=IMG_5910.jpg', isGalleryContent);
    await expectLightboxPhoto(page, 'IMG_5910.jpg', 20000);

    await endSession();
    await page.reload();

    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('#username')).toBeVisible();
    // nothing of the gallery is left
    await expect(page.locator('app-gallery')).toHaveCount(0);
  });

  test('Photo deep link should open again after logging in after the session ended', async ({page}) => {
    test.fail(true, 'Not implemented yet #1306: the login does not keep the return URL, the user lands on the gallery root');
    await loginAndOpen(page, '/gallery/?p=IMG_5910.jpg', isGalleryContent);
    await expectLightboxPhoto(page, 'IMG_5910.jpg', 20000);

    await endSession();
    await page.reload();
    await expect(page).toHaveURL(/\/login/);

    // the admin recreates the user, the user logs in again
    await expectApiOk(await admin.put('/pgapi/user', {data: {newUser: user}}), 'recreating the user');
    await loginOnCurrentLoginPage(page, user);

    await expect(page).toHaveURL(url => url.pathname === '/gallery/' && url.searchParams.get('p') === 'IMG_5910.jpg');
    await expectLightboxPhoto(page, 'IMG_5910.jpg', 20000);
  });

  test('Folder should open after logging in again when the session ended while navigating to it', async ({page}) => {
    test.fail(true, 'Not implemented yet #1306: the login does not keep the return URL, the user lands on the gallery root');
    // a folder with accents: the return URL has to survive the encoding
    const pendingApiRequests = trackPendingApiRequests(page);
    await loginAndOpen(page, '/gallery/' + encodeURIComponent(ACCENTED_DIR), isDirectoryContent);
    const subdirectory = page.locator('app-gallery-directory .directory-name').filter({hasText: 'subdirectory'});
    await expect(subdirectory).toBeVisible();
    // a thumbnail that is still loading would notice the ended session (401 -> /login) before the click below
    await expect.poll(pendingApiRequests, {message: 'pending API requests', timeout: 15000}).toBe(0);

    await endSession();
    await subdirectory.click();
    await expect(page).toHaveURL(/\/login/);

    await expectApiOk(await admin.put('/pgapi/user', {data: {newUser: user}}), 'recreating the user');
    await loginOnCurrentLoginPage(page, user);

    // the folder the user was opening when the session ended
    await expect(page).toHaveURL(url => decodeURIComponent(url.pathname) === '/gallery/' + ACCENTED_DIR + '/subdirectory');
    await expect(page.locator('.photo-container > img[alt="IMG_8824.jpg"]')).toBeVisible();
  });
});
