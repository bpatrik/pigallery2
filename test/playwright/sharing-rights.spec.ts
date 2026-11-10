// Who may share and what they can do with their sharings (CUJ 29–31, #1307): editing a sharing in the share dialog,
// a normal user sees and changes only their own sharings, a guest (read-only user) cannot share.
// The tests share 4MinsAroundTheWorld, which no other test shares.
import {APIRequestContext, APIResponse, expect, Page, Response, test} from '@playwright/test';
import {ADMIN_SESSION} from './global-setup';
import {
  createDirectorySharingWithApi,
  createUserWithApi,
  deleteUserWithApi,
  loginWithApi,
  loginWithUi,
  notLoggedIn,
  TestUser
} from './helpers';

const DIR = '4MinsAroundTheWorld';
const PHOTO = 'UTC-20240413-203630-London.jpg';
const GUEST_ROLE = 2; // UserRoles.Guest: read-only, can browse and search

const isDirContent = (url: URL): boolean => decodeURIComponent(url.pathname) === '/pgapi/gallery/content/' + DIR;
const isShareApi = (url: URL): boolean => url.pathname.startsWith('/pgapi/share/');

const openDir = async (page: Page): Promise<void> => {
  const content = page.waitForResponse(res => isDirContent(new URL(res.url())));
  await page.goto('/gallery/' + DIR);
  expect((await content).ok()).toBe(true);
};

/**
 * Opens the share dialog of the current folder and creates a sharing; the dialog stays open.
 * Returns the key of the new sharing.
 */
const createSharingInDialog = async (page: Page, password?: string): Promise<string> => {
  await page.locator('button#shareButton').click();
  await expect(page.locator('button#getShareButton')).toBeVisible();
  if (password) {
    await page.locator('input#share-password').fill(password);
  }
  await page.locator('button#getShareButton').click();
  await expect(page.locator('input#shareLink')).toHaveValue(/http/);
  return new URL(await page.locator('input#shareLink').inputValue()).pathname.split('/').pop() ?? '';
};

/**
 * An API call that the server refused: an error status, or an error in the body (the server answers some errors with 200).
 */
const expectRejected = async (res: APIResponse, what: string): Promise<void> => {
  const body = await res.json().catch(() => null);
  expect(!res.ok() || !!body?.error, what + ' is refused: ' + res.status() + ' ' + JSON.stringify(body)).toBe(true);
};

/**
 * A guest (not logged in) opens a password protected sharing with the password, returns whether it opened.
 */
const guestOpensWithPassword = async (page: Page, sharingKey: string, password: string): Promise<boolean> => {
  await page.goto('/shareLogin?sk=' + sharingKey);
  await page.locator('input#password').fill(password);
  const login = page.waitForResponse(res => new URL(res.url()).pathname === '/pgapi/share/login');
  await page.locator('button#button-share-login').click();
  return (await login).ok();
};

test.use({viewport: {width: 1280, height: 800}});

test.describe('Sharing rights', () => {
  let admin: APIRequestContext;
  // the sharings to delete after the test
  const sharingKeys: string[] = [];

  test.beforeEach(async ({playwright, baseURL}) => {
    admin = await playwright.request.newContext({baseURL, storageState: ADMIN_SESSION});
  });

  test.afterEach(async () => {
    for (const key of sharingKeys.splice(0)) {
      await admin.delete('/pgapi/share/' + key);
    }
    await admin.dispose();
  });

  test('Owner should change the password and the expiry of a new sharing in the share dialog', async ({page, browser}) => {
    await openDir(page);
    const sharingKey = await createSharingInDialog(page, 'old-secret');
    sharingKeys.push(sharingKey);

    // the dialog updates the sharing on every change of its settings
    const updated = (): Promise<Response> => page.waitForResponse(res => res.request().method() === 'PUT' &&
      isShareApi(new URL(res.url())));
    let update = updated();
    await page.locator('input#share-password').fill('new-secret');
    await page.locator('input#share-password').press('Tab');
    expect((await update).ok(), 'password updated').toBe(true);
    update = updated();
    await page.locator('select[name="valid-to"]').selectOption({label: 'Hours'});
    expect((await update).ok(), 'expiry updated').toBe(true);
    // the link stays the same
    await expect(page.locator('input#shareLink')).toHaveValue(new RegExp(sharingKey + '$'));
    await page.locator('modal-container button.btn-close').click();

    // 30 hours from now (the amount stayed 30)
    const sharing = (await (await admin.get('/pgapi/share/' + sharingKey)).json()).result;
    expect(Math.abs(sharing.expires - (Date.now() + 30 * 60 * 60 * 1000)), 'expires in 30 hours (ms off)')
      .toBeLessThan(5 * 60 * 1000);

    const guestContext = await browser.newContext(notLoggedIn);
    try {
      const guest = await guestContext.newPage();
      expect(await guestOpensWithPassword(guest, sharingKey, 'old-secret'), 'the old password opens it').toBe(false);
      await expect(guest.locator('.error-message')).toHaveText('Wrong password');
      expect(await guestOpensWithPassword(guest, sharingKey, 'new-secret'), 'the new password opens it').toBe(true);
      await expect(guest.locator('.photo-container > img[alt="' + PHOTO + '"]')).toBeVisible({timeout: 15000});
    } finally {
      await guestContext.close();
    }
  });

  test.describe('of a normal user', () => {
    test.use(notLoggedIn);
    let user: TestUser;
    let adminSharingKey: string;

    test.beforeEach(async () => {
      user = await createUserWithApi(admin, 'e2e-sharing-rights');
      adminSharingKey = (await createDirectorySharingWithApi(admin, DIR)).sharingKey;
      sharingKeys.push(adminSharingKey);
    });

    test.afterEach(async () => {
      // the sharings first (the outer afterEach), the user can be deleted after them
      for (const key of sharingKeys.splice(0)) {
        await admin.delete('/pgapi/share/' + key);
      }
      await deleteUserWithApi(admin, user.name);
    });

    test('Normal user should share a folder and see only their own sharings in the share list', async ({page}) => {
      await loginWithUi(page, user.name, user.password);
      await openDir(page);
      const sharingKey = await createSharingInDialog(page);
      sharingKeys.push(sharingKey);

      await expect(page.locator('button.list-shares-button .badge')).toHaveText('1');
      await page.locator('button.list-shares-button').click();
      const rows = page.locator('modal-container .modal-footer table tbody tr');
      await expect(rows).toHaveCount(1);
      await expect(rows.first()).toContainText(sharingKey);
      await expect(page.locator('modal-container').getByText(adminSharingKey), 'the sharing of the admin').toHaveCount(0);
      // the creator column is for admins only
      await expect(page.locator('modal-container .modal-footer table thead th').filter({hasText: 'Creator'})).toHaveCount(0);

      // the user deletes their own sharing from the list (the one just created stays disabled until the dialog is reopened)
      await page.locator('modal-container button.btn-close').click();
      // the list stays open while the page is open
      await page.locator('button#shareButton').click();
      const deleted = page.waitForResponse(res => res.request().method() === 'DELETE' &&
        new URL(res.url()).pathname === '/pgapi/share/' + sharingKey);
      await rows.filter({hasText: sharingKey}).locator('button.btn-danger').click();
      expect((await deleted).ok(), 'deleting the own sharing').toBe(true);
      await expect(rows).toHaveCount(0);
    });

    test('Normal user should not delete or change the sharing of someone else', async ({playwright, baseURL}) => {
      const userApi = await loginWithApi(playwright, baseURL, user);
      try {
        await expectRejected(await userApi.delete('/pgapi/share/' + adminSharingKey), 'deleting the sharing of the admin');
        const adminSharing = (await (await admin.get('/pgapi/share/' + adminSharingKey)).json()).result;
        await expectRejected(await userApi.put('/pgapi/share/', {
          data: {updateSharing: {id: adminSharing.id, directoryQuery: adminSharing.directoryQuery, valid: 1000, password: 'taken'}},
        }), 'changing the sharing of the admin');

        // the sharing is unchanged: still there, still without password
        const after = (await (await admin.get('/pgapi/share/' + adminSharingKey)).json()).result;
        expect(after?.sharingKey, 'the sharing is still there').toBe(adminSharingKey);
        expect(after.expires, 'the expiry is unchanged').toBe(adminSharing.expires);
        const publicInfo = (await (await userApi.get('/pgapi/share/' + adminSharingKey + '/publicInfo')).json()).result;
        expect(publicInfo?.passwordProtected, 'no password was set').toBe(false);
      } finally {
        await userApi.dispose();
      }
    });
  });

  test.describe('of a guest user', () => {
    test.use(notLoggedIn);
    let user: TestUser;

    test.beforeEach(async () => {
      user = await createUserWithApi(admin, 'e2e-sharing-guest', GUEST_ROLE);
    });

    test.afterEach(async () => {
      await deleteUserWithApi(admin, user.name);
    });

    // sharing needs at least the User role (SharingRouter, not configurable)
    test('Guest user should not be able to share', async ({page, playwright, baseURL}) => {
      await loginWithUi(page, user.name, user.password);
      await openDir(page);
      await expect(page.locator('.photo-container > img[alt="' + PHOTO + '"]')).toBeVisible();
      await expect(page.locator('app-frame nav button#shareButton')).toHaveCount(0);

      const userApi = await loginWithApi(playwright, baseURL, user);
      try {
        const res = await userApi.post('/pgapi/share/', {
          data: {createSharing: {valid: 60000, directoryQuery: {type: 102, value: DIR, matchType: 1}}},
        });
        await expectRejected(res, 'creating a sharing as a guest user');
        const key = (await res.json().catch(() => null))?.result?.sharingKey;
        if (key) {
          sharingKeys.push(key);
        }
      } finally {
        await userApi.dispose();
      }
    });
  });
});
