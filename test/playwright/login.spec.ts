import {randomUUID} from 'node:crypto';
import {APIRequestContext, expect, Page, test} from '@playwright/test';
import {ADMIN_SESSION, NORMAL_USER} from './global-setup';
import {expectLightboxPhoto, expectNoHorizontalScroll, isGalleryContent, loginWithUi, logoutWithUi, notLoggedIn} from './helpers';

const isApi = (url: string): boolean => new URL(url).pathname.startsWith('/pgapi/');

/**
 * Counts the API requests of the page that did not finish yet. Call it before the requests start.
 */
const trackPendingApiRequests = (page: Page): () => number => {
  let pending = 0;
  page.on('request', req => {
    if (isApi(req.url())) {
      pending++;
    }
  });
  const done = (req: { url: () => string }): void => {
    if (isApi(req.url())) {
      pending--;
    }
  };
  page.on('requestfinished', done);
  page.on('requestfailed', done);
  return () => pending;
};

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
  test('Logout should not be undone by a request that was sent before it', async ({page}) => {
    test.fail(true, 'Not implemented yet #1306');
    const content = page.waitForResponse(res => isGalleryContent(new URL(res.url())));
    await loginWithUi(page, NORMAL_USER.name, NORMAL_USER.password);
    await content;

    // e.g.: a thumbnail that the server is still generating: the server answers at once, the browser gets it after the logout
    let release!: () => void;
    const released = new Promise<void>(resolve => release = resolve);
    await page.route(url => url.searchParams.has('in-flight'), async route => {
      const response = await route.fetch();
      await released;
      await route.fulfill({response});
    });
    const inFlight = page.evaluate(() => fetch('/pgapi/user/me?in-flight=1').then(r => r.status));
    await logoutWithUi(page);
    await expect(page).toHaveURL(/\/login/);
    release();
    expect(await inFlight).toBe(200);

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
    test.fail(true, 'Not implemented yet #1306');
    await loginWithWrongPassword(page);

    await expect(page.locator('.error-message')).toBeVisible();
    await expect(page.locator('#password')).toHaveValue('');
  });

  test('Deep link should open after the login', async ({page}) => {
    test.fail(true, 'Not implemented yet #1306');
    await page.goto('/gallery/timestamps?p=big_ben.jpg');
    await expect(page).toHaveURL(/\/login/);
    await fillLoginForm(page, NORMAL_USER.name, NORMAL_USER.password);
    await page.locator('.col-sm-12 > .btn').click();

    // back on the deep link, not on the gallery root
    await expect(page).toHaveURL(url => url.pathname === '/gallery/timestamps' && url.searchParams.get('p') === 'big_ben.jpg');
    await expectLightboxPhoto(page, 'big_ben.jpg');
  });

  test('Search deep link should open after the login', async ({page}) => {
    test.fail(true, 'Not implemented yet #1306');
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
    const user = {name: 'e2e-session-end-' + randomUUID(), password: 'pass', role: 3};

    test.beforeEach(async ({playwright, baseURL}) => {
      admin = await playwright.request.newContext({baseURL, storageState: ADMIN_SESSION});
      expect((await admin.put('/pgapi/user', {data: {newUser: user}})).ok(), 'creating the user').toBe(true);
    });

    test.afterEach(async () => {
      // the test deletes the user, unless it failed before
      const users: { id: number, name: string }[] = (await (await admin.get('/pgapi/user/list')).json()).result;
      const left = users.find(u => u.name === user.name);
      if (left) {
        await admin.delete('/pgapi/user/' + left.id);
      }
      await admin.dispose();
    });

    test('Deleted user should get to the login page with a message', async ({page}) => {
      test.fail(true, 'Not implemented yet #1306');
      const content = page.waitForResponse(res => isGalleryContent(new URL(res.url())));
      await loginWithUi(page, user.name, user.password);
      await content;
      await expect(page.locator('app-gallery-directory .directory-name').filter({hasText: 'timestamps'})).toBeVisible();

      const users: { id: number, name: string }[] = (await (await admin.get('/pgapi/user/list')).json()).result;
      const id = users.find(u => u.name === user.name)?.id;
      expect((await admin.delete('/pgapi/user/' + id)).ok(), 'deleting the user').toBe(true);

      await page.locator('app-gallery-directory .directory-name').filter({hasText: 'timestamps'}).click();
      await expect(page).toHaveURL(/\/login/);
      await expect(page.locator('#username')).toBeVisible();
      // the redirect works already, the message is missing
      await expect(page.locator('app-toast-card').filter({hasText: 'Your session has ended. Please log in again.'})).toBeVisible();
    });
  });
});
