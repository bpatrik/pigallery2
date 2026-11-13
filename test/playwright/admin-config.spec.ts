// The admin journeys that change the server config or run jobs (#1315).
// They change the server for every test, so they run in the `admin-config` project, after the others (see playwright.config.ts),
// one after the other (all in one serial describe), and restore what they change.
import {APIRequestContext, expect, Page, test} from '@playwright/test';
import {ADMIN_SESSION, expectApiOk} from './helpers';
import {JobProgressStates} from '../../src/common/entities/job/JobProgressDTO';

type Settings = Record<string, Record<string, unknown>>;

const getSettings = async (api: APIRequestContext): Promise<Settings> =>
  (await (await api.get('/pgapi/settings')).json()).result;

const openAdmin = async (page: Page): Promise<void> => {
  const settingsLoaded = page.waitForResponse(res => new URL(res.url()).pathname === '/pgapi/settings');
  await page.goto('/admin');
  await expectApiOk(await settingsLoaded, 'loading the settings');
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
    for (const settingsPath of ['Upload', 'Sharing', 'Jobs']) {
      const res = await admin.put('/pgapi/settings', {data: {settingsPath, settings: original[settingsPath]}});
      await expectApiOk(res, 'restoring ' + settingsPath);
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
    await expectApiOk(await saved, 'saving the settings');

    await openAdmin(page);
    await expect(page.locator('form#Upload').locator('[id="Upload.enabled"]')).toBeChecked({checked: !wasEnabled});
    expect((await getSettings(admin))['Upload']['enabled']).toBe(!wasEnabled);

    // restore it the same way
    await page.locator('form#Upload').locator('[id="Upload.enabled"]').click();
    const restored = page.waitForResponse(isSettingsSave);
    await page.locator('form#Upload button.btn-success', {hasText: 'Save'}).click();
    await expectApiOk(await restored, 'restoring the setting');
    expect((await getSettings(admin))['Upload']['enabled']).toBe(wasEnabled);
  });

  test.describe('Invalid setting', () => {
    // the form knows the limits of the config (#1315): the sharing key length is 8-64
    test('should show the limits on the field and not let the form be saved', async ({page}) => {
      await openAdmin(page);
      // the sharing key length is an "Under the hood" setting
      await switchMode(page, 'Under the hood');
      const sharingKeyLength = page.locator('form#Sharing').getByLabel('Sharing key length');
      await expect(sharingKeyLength).toHaveValue(String(original['Sharing']['sharingKeyLength']));

      await page.locator('form#Sharing').getByLabel('Require password').click();
      await sharingKeyLength.fill('200');
      const row = page.locator('form#Sharing app-settings-entry').filter({has: page.getByLabel('Sharing key length')});
      await expect(row).toHaveCount(1);
      await expect(row.getByRole('alert')).toContainText('64');
      await expect(page.locator('form#Sharing button.btn-success', {hasText: 'Save'})).toBeDisabled();

      await sharingKeyLength.fill(String(original['Sharing']['sharingKeyLength']));
      await expect(row.getByRole('alert')).toHaveCount(0);
      await expect(page.locator('form#Sharing button.btn-success', {hasText: 'Save'})).toBeEnabled();
      // nothing was saved
      const saved = await getSettings(admin);
      expect(saved['Sharing']['passwordRequired']).toBe(original['Sharing']['passwordRequired']);
    });

    // what only the server can check, e.g. that the images folder exists
    test('should show the error of a rejected save and save nothing of it', async ({page}) => {
      await openAdmin(page);
      const media = page.locator('form#Media');
      await media.getByLabel('Images folder').fill('not-existing-images-folder');
      const saved = page.waitForResponse(isSettingsSave);
      await media.locator('button.btn-success', {hasText: 'Save'}).click();
      expect((await (await saved).json()).error).not.toBeNull();
      await expect(media.locator('.alert-danger')).toBeVisible();

      expect((await getSettings(admin))['Media']['folder']).toBe(original['Media']['folder']);
      await openAdmin(page);
      await expect(media.locator('.alert-danger')).toBeHidden();
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
    await expectApiOk(await started, 'starting the indexing');

    await expect.poll(async () => {
      const p = await indexingProgress();
      return p && p.time.start > startedBefore ? p.state : undefined;
    }, {message: 'the new indexing run finishes', timeout: 60000}).toBe(JobProgressStates.finished);

    // the page shows the progress of the run that just finished
    const progress = indexing.locator('app-settings-job-progress');
    // the page polls the progress every 5 s while a job runs, but every 15 s when it saw none running
    await expect(progress).toContainText('finished', {timeout: 20000});
    await expect(progress).toContainText(/\d+\/\d+/);
    // the gallery keeps working
    await page.goto('/gallery/');
    await expect(page.locator('app-gallery-grid .photo-container').first()).toBeVisible();
  });

  // CUJ 38 (#1315): the admin sets when a job runs
  test.describe('Job schedule', () => {
    const SCHEDULE = 'Temp Folder Cleaning';

    test('A job schedule set on the admin page should stay after save and reload', async ({page}) => {
      // two days from now (UTC): not today in any time zone, so the job does not start during the tests
      const weekday = (new Date().getUTCDay() + 2) % 7; // 0: Sunday
      const periodicity = (weekday + 6) % 7; // the UI's list starts with Monday
      const dayName = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][periodicity];

      const scheduleCard = (p: Page) => p.locator('form#Jobs app-settings-workflow .card')
        .filter({has: p.locator('.card-header [role="button"]', {hasText: new RegExp('^\\s*' + SCHEDULE)})});

      await openAdmin(page);
      await switchMode(page, 'Under the hood');
      const card = scheduleCard(page);
      await expect(card).toHaveCount(1);
      await expect(card.locator('.card-header')).toContainText('after');

      await card.locator('.card-header [role="button"]').click();
      await card.locator('select[id^="repeatType"]').selectOption({label: 'periodic'});
      await card.locator('select[id^="periodicity"]').selectOption({label: 'every ' + dayName});
      await expect(card.locator('.card-header')).toContainText('every');
      await expect(card.locator('.card-header')).toContainText(dayName);

      const saved = page.waitForResponse(isSettingsSave);
      await page.locator('form#Jobs button.btn-success', {hasText: 'Save'}).click();
      await expectApiOk(await saved, 'saving the job schedule');

      // the server has it
      const schedules = (await getSettings(admin))['Jobs']['scheduled'] as { name: string, trigger: { type: number, periodicity?: number } }[];
      expect(schedules.find(s => s.name === SCHEDULE)?.trigger).toMatchObject({type: 3, periodicity}); // JobTriggerType.periodic

      // and the page shows it after a reload
      await openAdmin(page);
      await switchMode(page, 'Under the hood');
      const reloaded = scheduleCard(page).locator('.card-header');
      await expect(reloaded).toContainText('every');
      await expect(reloaded).toContainText(dayName);
      await expect(reloaded).not.toContainText('after');
    });
  });
});
