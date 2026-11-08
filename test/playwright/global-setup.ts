import {APIRequestContext, expect, FullConfig, request} from '@playwright/test';
import {JobProgressStates} from '../../src/common/entities/job/JobProgressDTO';

export const ADMIN_SESSION = 'test/playwright/.auth/admin.json';
export const USER_SESSION = 'test/playwright/.auth/user.json';
// a normal (not admin) user, created by the global setup
export const NORMAL_USER = {name: 'e2e-user', password: 'e2e-user', role: 3}; // UserRoles.User

const login = async (context: APIRequestContext, username: string, password: string): Promise<void> => {
  const res = await context.post('/pgapi/user/login', {
    data: {loginCredential: {username, password, rememberMe: false}},
  });
  expect(res.ok(), username + ' login (is your own server running on port 8080?)').toBe(true);
};

/**
 * Indexes every folder, so albums, faces and search find all photos, not only those of the folders other tests opened.
 * A job changes the server for every test, so it runs here, before the tests.
 */
const indexAllFolders = async (admin: APIRequestContext): Promise<void> => {
  const start = await admin.post('/pgapi/admin/jobs/scheduled/Indexing/start', {
    // soloRun: without the follow-up jobs (e.g.: thumbnail generation)
    data: {soloRun: true, config: {indexChangesOnly: false}},
  });
  expect(start.ok(), 'starting the indexing').toBe(true);
  await expect.poll(async () => {
    const progresses = (await (await admin.get('/pgapi/admin/jobs/scheduled/progress')).json()).result;
    return Object.values<{ jobName: string, state: JobProgressStates }>(progresses).find(p => p.jobName === 'Indexing')?.state;
  }, {message: 'indexing job state', timeout: 60000}).toBe(JobProgressStates.finished);
};

/**
 * Indexes the photos, then logs in once as admin and once as a normal user; the tests start with the admin session
 * (storageState in playwright.config.ts), `asNormalUser` of helpers.ts switches to the other one.
 * Global setup (unlike a setup project) also runs in UI mode.
 */
export default async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0].use.baseURL;
  const admin = await request.newContext({baseURL});
  await login(admin, 'admin', 'admin');
  await admin.storageState({path: ADMIN_SESSION});
  await indexAllFolders(admin);

  // a reused local server might have the user already
  const users: { name: string }[] = (await (await admin.get('/pgapi/user/list')).json()).result;
  if (!users.some(u => u.name === NORMAL_USER.name)) {
    const res = await admin.put('/pgapi/user', {data: {newUser: NORMAL_USER}});
    expect(res.ok(), 'creating the normal user').toBe(true);
  }
  await admin.dispose();

  const user = await request.newContext({baseURL});
  await login(user, NORMAL_USER.name, NORMAL_USER.password);
  await user.storageState({path: USER_SESSION});
  await user.dispose();
}
