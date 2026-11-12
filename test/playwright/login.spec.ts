import {APIRequestContext, expect, Page, test} from '@playwright/test';
import {
  ADMIN_SESSION,
  NORMAL_USER,
  ACCENTED_DIR,
  createUserWithApi,
  deleteUserWithApi,
  expectLightboxPhoto,
  expectNoHorizontalScroll,
  isGalleryContent,
  loginWithUi,
  logoutWithUi,
  notLoggedIn,
  TestUser,
  trackPendingApiRequests
} from './helpers';

/**
 * Fills the login form without submitting it, so the test can watch what happens after the click.
 */
const fillLoginForm = async (page: Page, username: string, password: string): Promise<void> => {
  await expect(page.locator('#username')).toBeVisible();
  await page.locator('#username').fill(username);
  await page.locator('#password').fill(password);
};

test.use(notLoggedIn);

test.describe('Login', () => {
  test('Page opens', async ({page}) => {
    await page.goto('/');
    await expect(page.locator('.card-body')).toBeVisible();
    await expect(page.locator('.col-sm-12').filter({hasText: 'Login'}).first()).toBeVisible();
  });

  // Sanity check: what a visitor notices right away on the login page. Soft checks, so one failure does not hide the others.
  test('Login page should look right', {tag: '@sanity'}, async ({page}) => {
    await page.goto('/gallery/');
    await expect(page).toHaveURL(/\/login/);
    await expect.soft(page.locator('app-login h1'), 'title').toBeVisible();
    await expect.soft(page.locator('app-login .card-title'), 'heading').toHaveText('Please log in');
    await expect.soft(page.locator('#username'), 'username').toBeVisible();
    await expect.soft(page.locator('#password'), 'password').toBeVisible();
    await expect.soft(page.locator('#password'), 'password is masked').toHaveAttribute('type', 'password');
    await expect.soft(page.locator('#rememberMe'), 'remember me').toBeVisible();
    await expect.soft(page.locator('app-login app-language'), 'language switch').toBeVisible();
    // no error before the first try
    await expect.soft(page.locator('.error-message'), 'no error').toBeHidden();
    // no gallery around it
    await expect.soft(page.locator('app-frame nav'), 'no navbar').toHaveCount(0);
    await expectNoHorizontalScroll(page, 'login');
  });

  test('Login', async ({page}) => {
    const content = page.waitForResponse(res => isGalleryContent(new URL(res.url())));
    await loginWithUi(page);
    await expect(page.locator('.mb-0 > :nth-child(1) > .nav-link')).toContainText('Gallery');

    const res = await content;
    expect(res.status()).toBe(200);
    expect(await res.json(), '1st API call has data').not.toBeNull();
  });

  test('Normal user should log in, stay logged in after a reload and log out', async ({page}) => {
    const pendingApiRequests = trackPendingApiRequests(page);
    const content = page.waitForResponse(res => isGalleryContent(new URL(res.url())));
    await loginWithUi(page, NORMAL_USER.name, NORMAL_USER.password);
    expect((await content).status()).toBe(200);
    await expect(page).toHaveURL(/\/gallery/);
    await expect(page.locator('app-frame nav').getByText(NORMAL_USER.name).first()).toBeAttached();

    await page.reload();
    await expect(page).toHaveURL(/\/gallery/);
    await expect(page.locator('.photo-container > img').first()).toBeVisible();

    // A response to a request sent before the logout logs the user back in (see the test below).
    // In a full run the server generates the thumbnails slowly, so they are still loading here: wait for them.
    await expect.poll(pendingApiRequests, {message: 'pending API requests', timeout: 15000}).toBe(0);
    await logoutWithUi(page);
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('#username')).toBeVisible();
    // the session is gone
    await page.goto('/gallery/');
    await expect(page).toHaveURL(/\/login/);
  });

  // The session lives in the cookie, and every authenticated response sends it again (with the extended expiry).
  // So a request that was sent before the logout and answered after it brings the logged-out session back.
  test('Logout should not be undone by a request that was sent before it', async ({page, playwright, baseURL}) => {
    test.fail(true, 'Not implemented yet #1368: the cookie-only session can not be revoked on the server');
    const pendingApiRequests = trackPendingApiRequests(page);
    const content = page.waitForResponse(res => isGalleryContent(new URL(res.url())));
    await loginWithUi(page, NORMAL_USER.name, NORMAL_USER.password);
    await content;
    // only the request below may answer after the logout: the thumbnails of the gallery would undo it too
    await expect.poll(pendingApiRequests, {message: 'pending API requests', timeout: 15000}).toBe(0);

    // e.g.: a thumbnail that the server is still generating: the browser sends the request (with the session cookie) before the logout,
    // and gets the answer after the logout. The request goes out with the cookie of before the logout (from a request context of its own:
    // route.fetch() would store the cookie of the answer in the browser at once), and its answer reaches the browser after the logout.
    const beforeLogout = await playwright.request.newContext({baseURL, storageState: await page.context().storageState()});
    let release!: () => void;
    const released = new Promise<void>(resolve => release = resolve);
    await page.route(url => url.searchParams.has('in-flight'), async route => {
      const response = await beforeLogout.get(route.request().url());
      await released;
      await route.fulfill({response});
    });
    const inFlight = page.evaluate(() => fetch('/pgapi/user/me?in-flight=1').then(r => r.status));
    await logoutWithUi(page);
    await expect(page).toHaveURL(/\/login/);
    release();
    expect(await inFlight).toBe(200);
    await beforeLogout.dispose();

    await page.goto('/gallery/');
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('#username')).toBeVisible();
  });

  const loginWithWrongPassword = async (page: Page): Promise<void> => {
    await page.goto('/');
    await fillLoginForm(page, NORMAL_USER.name, 'wrong password');
    const login = page.waitForResponse(res => new URL(res.url()).pathname === '/pgapi/user/login');
    await page.locator('.col-sm-12 > .btn').click();
    await login;
  };

  test('Wrong password should show an error and stay on the login page', async ({page}) => {
    await loginWithWrongPassword(page);

    await expect(page.locator('.error-message')).toHaveText('Wrong username or password');
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('#username')).toHaveValue(NORMAL_USER.name);
  });

  test('Wrong password should be cleared for the next try', async ({page}) => {
    await loginWithWrongPassword(page);

    await expect(page.locator('.error-message')).toBeVisible();
    await expect(page.locator('#password')).toHaveValue('');
  });

  test('Deep link should open after the login', async ({page}) => {
    // a full size photo (big_ben.jpg is smaller than the lightbox) in the folder with accents in its name
    await page.goto('/gallery/' + encodeURIComponent(ACCENTED_DIR) + '?p=IMG_8943.jpg');
    await expect(page).toHaveURL(/\/login/);
    await fillLoginForm(page, NORMAL_USER.name, NORMAL_USER.password);
    await page.locator('.col-sm-12 > .btn').click();

    // back on the deep link, not on the gallery root
    await expect(page).toHaveURL(url => decodeURIComponent(url.pathname) === '/gallery/' + ACCENTED_DIR && url.searchParams.get('p') === 'IMG_8943.jpg');
    await expectLightboxPhoto(page, 'IMG_8943.jpg');
  });

  test('Search deep link should open after the login', async ({page}) => {
    await page.goto('/search/big_ben');
    await expect(page).toHaveURL(/\/login/);
    await fillLoginForm(page, NORMAL_USER.name, NORMAL_USER.password);
    await page.locator('.col-sm-12 > .btn').click();

    await expect(page).toHaveURL(url => url.pathname === '/search/big_ben');
    await expect(page.locator('.photo-container > img[alt="big_ben.jpg"]')).toBeVisible();
  });

  test.describe('Session ends while the app is open', () => {
    let admin: APIRequestContext;
    // a user of its own, so deleting it does not affect the other tests
    let user: TestUser;

    test.beforeEach(async ({playwright, baseURL}) => {
      admin = await playwright.request.newContext({baseURL, storageState: ADMIN_SESSION});
      user = await createUserWithApi(admin, 'e2e-session-end');
    });

    test.afterEach(async () => {
      // the test deletes the user, unless it failed before
      await deleteUserWithApi(admin, user.name);
      await admin.dispose();
    });

    /**
     * Logs in as the user, then the admin deletes the user while the gallery is open, and the user opens a folder.
     */
    const deleteUserWhileOpen = async (page: Page): Promise<void> => {
      const pendingApiRequests = trackPendingApiRequests(page);
      const content = page.waitForResponse(res => isGalleryContent(new URL(res.url())));
      await loginWithUi(page, user.name, user.password);
      await content;
      await expect(page.locator('app-gallery-directory .directory-name').filter({hasText: 'timestamps'})).toBeVisible();
      // a thumbnail that is still loading would notice the ended session (401 -> /login) before the click below
      await expect.poll(pendingApiRequests, {message: 'pending API requests', timeout: 15000}).toBe(0);

      expect(await deleteUserWithApi(admin, user.name), 'the user existed').toBe(true);

      await page.locator('app-gallery-directory .directory-name').filter({hasText: 'timestamps'}).click();
    };

    test('Deleted user should get to the login page', async ({page}) => {
      await deleteUserWhileOpen(page);
      await expect(page).toHaveURL(/\/login/);
      await expect(page.locator('#username')).toBeVisible();
    });

    test('Deleted user should be told that the session has ended', async ({page}) => {
      test.fail(true, 'Not implemented yet #1306');
      await deleteUserWhileOpen(page);
      await expect(page).toHaveURL(/\/login/);
      await expect(page.locator('app-toast-card').filter({hasText: 'Your session has ended. Please log in again.'})).toBeVisible();
    });
  });
});
