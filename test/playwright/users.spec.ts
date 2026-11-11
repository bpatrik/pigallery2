// CUJ 39 (#1315): the admin manages the users on the admin page.
import {randomUUID} from 'node:crypto';
import {expect, Locator, Page, test} from '@playwright/test';
import {deleteUserWithApi, desktopViewport, expectApiOk, loginWithUi} from './helpers';

const openAdmin = async (page: Page): Promise<void> => {
  const users = page.waitForResponse(res => new URL(res.url()).pathname === '/pgapi/user/list');
  await page.goto('/admin');
  await expectApiOk(await users, 'loading the users');
};

const userRow = (page: Page, name: string): Locator =>
  page.locator('app-settings-users tbody tr').filter({has: page.locator('td').first().getByText(name, {exact: true})});

const isUserApi = (method: string, path: RegExp) => (res: { url(): string, request(): { method(): string } }): boolean =>
  res.request().method() === method && path.test(new URL(res.url()).pathname);

test.describe('Users', () => {
  test.use(desktopViewport({width: 1200, height: 800}));

  test.describe('managed through the admin page', () => {
    // accented, unique per run: the tests run in parallel against one server
    const name = 'Ünnepi Ödön ' + randomUUID();
    const password = 'jelszó-' + randomUUID();

    test.afterEach(async ({request}) => {
      // clean up, also when the test failed halfway
      await deleteUserWithApi(request, name);
    });

    test('should add a user, change its role, let it log in with the new role and delete it', async ({page, browser, baseURL}) => {
      await openAdmin(page);

      // add it as a guest
      await page.locator('app-settings-users').getByRole('button', {name: 'Add user', exact: true}).click();
      const addModal = page.locator('#userModal');
      await expect(addModal).toBeVisible();
      await addModal.getByPlaceholder('Username').fill(name);
      await addModal.getByPlaceholder('Password', {exact: true}).fill(password);
      await addModal.getByPlaceholder('Confirm Password').fill(password);
      await addModal.locator('select[name="role"]').selectOption({label: 'Guest'});
      const created = page.waitForResponse(isUserApi('PUT', /^\/pgapi\/user$/));
      await addModal.locator('.modal-footer button', {hasText: 'Add User'}).click();
      await expectApiOk(await created, 'adding the user');
      await expect(addModal).toBeHidden();

      // it shows in the list with its role
      const row = userRow(page, name);
      await expect(row).toHaveCount(1);
      await expect(row.locator('td').nth(1)).toHaveText('Guest');

      // change its role to admin in the edit dialog
      await row.locator('button:has(ng-icon[name="ionPencil"])').click();
      const editModal = page.locator('#editUserModal');
      await expect(editModal).toBeVisible();
      await expect(editModal.locator('.modal-title')).toContainText(name);
      const role = editModal.locator('select#editRole');
      await expect(role).toBeEnabled();
      await role.selectOption({label: 'Admin'});
      const roleChanged = page.waitForResponse(isUserApi('POST', /^\/pgapi\/user\/\d+\/role$/));
      const settingsSaved = page.waitForResponse(isUserApi('POST', /^\/pgapi\/user\/\d+\/settings$/));
      await editModal.locator('.modal-footer button', {hasText: 'Save changes'}).click();
      await expectApiOk(await roleChanged, 'changing the role');
      await expectApiOk(await settingsSaved, 'saving the user settings');
      await expect(editModal).toBeHidden();
      await expect(row.locator('td').nth(1)).toHaveText('Admin');

      // the user logs in (in a browser of its own) and has the new role: it gets the admin page
      const userContext = await browser.newContext({baseURL, storageState: {cookies: [], origins: []}});
      const userPage = await userContext.newPage();
      try {
        await loginWithUi(userPage, name, password);
        await expect(userPage).toHaveURL(url => url.pathname.startsWith('/gallery'));
        const settingsLoaded = userPage.waitForResponse(res => new URL(res.url()).pathname === '/pgapi/settings');
        await userPage.goto('/admin');
        await expectApiOk(await settingsLoaded, 'loading the settings as the new admin');
        await expect(userPage).toHaveURL(url => url.pathname === '/admin');
        await expect(userPage.locator('form#Server')).toBeVisible();

        // the admin deletes it
        const deleted = page.waitForResponse(isUserApi('DELETE', /^\/pgapi\/user\/\d+$/));
        await row.locator('button:has(ng-icon[name="ionTrashOutline"])').click();
        await expectApiOk(await deleted, 'deleting the user');
        await expect(row).toHaveCount(0);
        // also after a reload
        await openAdmin(page);
        await expect(userRow(page, name)).toHaveCount(0);
        await expect(userRow(page, 'admin')).toHaveCount(1);

        // its session ended (UserRouter.spec.ts checks the details): the admin API refuses it
        const res = await userPage.request.get('/pgapi/settings');
        expect((await res.json()).result ?? null).toBeNull();
      } finally {
        await userContext.close();
      }
    });
  });

  // #1315: an admin can never lower their own role, so the edit dialog of the own row doesn't offer it.
  // The own row's delete button is checked in the admin sanity test (admin.spec.ts).
  test('The edit dialog of the own row should not offer a role change', async ({page}) => {
    await openAdmin(page);
    const ownRow = userRow(page, 'admin');
    await expect(ownRow).toHaveCount(1);
    await ownRow.locator('button:has(ng-icon[name="ionPencil"])').click();
    const editModal = page.locator('#editUserModal');
    await expect(editModal).toBeVisible();
    await expect(editModal.locator('.modal-title')).toContainText('admin');
    await expect(editModal.locator('select#editRole')).toBeDisabled();
    await expect(editModal.locator('select#editRole')).toHaveValue('4'); // UserRoles.Admin
    await editModal.locator('.modal-footer button', {hasText: 'Close'}).click();
    await expect(editModal).toBeHidden();
  });
});
