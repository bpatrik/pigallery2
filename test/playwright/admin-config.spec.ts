// The admin journeys that change the server config or run jobs (#1315).
// They change the server for every test, so they run in the `admin-config` project, after the others (see playwright.config.ts),
// one after the other, and restore what they change.
import {APIRequestContext, expect, Page, test} from '@playwright/test';
import {ADMIN_SESSION} from './global-setup';
import {JobProgressStates} from '../../src/common/entities/job/JobProgressDTO';

type Settings = Record<string, Record<string, unknown>>;

const getSettings = async (api: APIRequestContext): Promise<Settings> =>
  (await (await api.get('/pgapi/settings')).json()).result;

const openAdmin = async (page: Page): Promise<void> => {
  const settingsLoaded = page.waitForResponse(res => new URL(res.url()).pathname === '/pgapi/settings');
  await page.goto('/admin');
  expect((await settingsLoaded).ok()).toBe(true);
};

// shows the settings of that mode (Basic, Advanced or Under the hood)
const switchMode = async (page: Page, mode: string): Promise<void> => {
  await page.locator('#config-priority').click();
  await page.locator('.dropdown-menu button.dropdown-item', {hasText: mode}).click();
  await expect(page.locator('#config-priority')).toContainText(mode);
};

const isSettingsSave = (res: { url(): string, request(): { method(): string } }): boolean =>
  new URL(res.url()).pathname === '/pgapi/settings' && res.request().method() === 'PUT';

test.describe('Admin config', () => {
  test.describe.configure({mode: 'serial'});
  test.use({viewport: {width: 1200, height: 800}});

  let admin: APIRequestContext;
  let original: Settings;

  test.beforeAll(async ({playwright, baseURL}) => {
    admin = await playwright.request.newContext({baseURL, storageState: ADMIN_SESSION});
    original = await getSettings(admin);
  });

  test.afterAll(async () => {
    // restore the settings the tests touch, also if a test failed halfway
    for (const settingsPath of ['Upload', 'Sharing']) {
      const res = await admin.put('/pgapi/settings', {data: {settingsPath, settings: original[settingsPath]}});
      expect(res.ok(), 'restoring ' + settingsPath).toBe(true);
    }
    await admin.dispose();
  });

  test('A toggled setting should stay toggled after save and reload', async ({page}) => {
    await openAdmin(page);
    const toggle = page.locator('form#Upload').locator('[id="Upload.enabled"]');
    const wasEnabled = original['Upload']['enabled'] as boolean;
    await expect(toggle).toBeChecked({checked: wasEnabled});

    await toggle.click();
    const saved = page.waitForResponse(isSettingsSave);
    await page.locator('form#Upload button.btn-success', {hasText: 'Save'}).click();
    const res = await saved;
    expect(res.ok()).toBe(true);
    expect((await res.json()).error).toBeNull();

    await openAdmin(page);
    await expect(page.locator('form#Upload').locator('[id="Upload.enabled"]')).toBeChecked({checked: !wasEnabled});
    expect((await getSettings(admin))['Upload']['enabled']).toBe(!wasEnabled);

    // restore it the same way
    await page.locator('form#Upload').locator('[id="Upload.enabled"]').click();
    const restored = page.waitForResponse(isSettingsSave);
    await page.locator('form#Upload button.btn-success', {hasText: 'Save'}).click();
    expect((await restored).ok()).toBe(true);
    expect((await getSettings(admin))['Upload']['enabled']).toBe(wasEnabled);
  });

  test.describe('Invalid setting', () => {
    const sharingKeyLength = (page: Page) => page.locator('form#Sharing').getByLabel('Sharing key length');

    // enters an out-of-range sharing key length (8-64) together with a valid change, and saves them
    const saveInvalid = async (page: Page): Promise<void> => {
      await openAdmin(page);
      // the sharing key length is an "Under the hood" setting
      await switchMode(page, 'Under the hood');
      await expect(sharingKeyLength(page)).toHaveValue(String(original['Sharing']['sharingKeyLength']));

      await page.locator('form#Sharing').getByLabel('Require password').click();
      await sharingKeyLength(page).fill('200');
      const saved = page.waitForResponse(isSettingsSave);
      await page.locator('form#Sharing button.btn-success', {hasText: 'Save'}).click();
      expect((await (await saved).json()).error).not.toBeNull();
    };

    test('should show an error and save nothing of that save', async ({page}) => {
      await saveInvalid(page);
      await expect(page.locator('form#Sharing .alert-danger')).toBeVisible();
      await expect(page.locator('form#Sharing .alert-danger')).toContainText('64');

      // the server rejected the whole save: the valid change is not saved either (decision of #1315)
      const saved = await getSettings(admin);
      expect(saved['Sharing']['sharingKeyLength']).toBe(original['Sharing']['sharingKeyLength']);
      expect(saved['Sharing']['passwordRequired']).toBe(original['Sharing']['passwordRequired']);
      await openAdmin(page);
      await expect(page.locator('form#Sharing .alert-danger')).toBeHidden();
    });

    test('should show the error inline on the field', async ({page}) => {
      test.fail(true, 'Not implemented yet #1315: the error is shown at the top of the settings card');
      await saveInvalid(page);
      const row = page.locator('form#Sharing app-settings-entry').filter({has: page.getByLabel('Sharing key length')});
      await expect(row).toHaveCount(1);
      await expect(row.getByText(/64/)).toBeVisible();
    });
  });

  test('Indexing started from the admin page should show its progress until it finishes', async ({page}) => {
    const indexingProgress = async (): Promise<{ state: JobProgressStates, time: { start: number } } | undefined> => {
      const progresses = (await (await admin.get('/pgapi/admin/jobs/scheduled/progress')).json()).result;
      // one progress per job config: the latest run of any config
      return Object.values<{ jobName: string, state: JobProgressStates, time: { start: number } }>(progresses)
        .filter(p => p.jobName === 'Indexing')
        .sort((a, b) => b.time.start - a.time.start)[0];
    };
    const startedBefore = (await indexingProgress())?.time.start ?? 0;

    await openAdmin(page);
    // the indexing settings and jobs are not basic settings
    await switchMode(page, 'Under the hood');
    const indexing = page.locator('form#Indexing');
    await indexing.locator('app-settings-job-button button', {hasText: /Run now:\s*Indexing/}).click();
    const started = page.waitForResponse(res => new URL(res.url()).pathname === '/pgapi/admin/jobs/scheduled/Indexing/start');
    await page.locator('.modal-footer button', {hasText: 'Run now'}).click();
    expect((await started).ok()).toBe(true);

    await expect.poll(async () => {
      const p = await indexingProgress();
      return p && p.time.start > startedBefore ? p.state : undefined;
    }, {message: 'the new indexing run finishes', timeout: 60000}).toBe(JobProgressStates.finished);

    // the page shows the progress of the run that just finished
    const progress = indexing.locator('app-settings-job-progress');
    await expect(progress).toContainText('finished');
    await expect(progress).toContainText(/\d+\/\d+/);
    // the gallery keeps working
    await page.goto('/gallery/');
    await expect(page.locator('app-gallery-grid .photo-container').first()).toBeVisible();
  });
});
