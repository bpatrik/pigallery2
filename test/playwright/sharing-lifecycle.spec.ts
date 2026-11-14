// A sharing ends while a guest has it open (#1307), also as a photo frame (#1313):
// the guest gets the "This link is invalid or has expired" page, full screen.
import {APIRequestContext, expect, Page, test} from '@playwright/test';
import {ADMIN_SESSION, ACCENTED_DIR, createDirectorySharingWithApi, CreatedSharing, deleteSharingsWithApi, expectApiOk, expectInvalidLinkPage, expectLightboxPhoto, notLoggedIn} from './helpers';

// a frame link: playing, looping, caption on, controls hidden, the next photo after 300 s, reloading the content every second
// (the same as frameParams of frame.spec.ts)
const FRAME_PARAMS = 'play=true&auInt=1&ls=true&cAO=true&cd=true&ssp=300';

// The tests don't wait for a sharing to expire. The countdown runs on the clock of the browser, which the tests fake
// (page.clock) and move next to the expiry of the sharing; the server learns about the expiry through the API.
const HOUR = 60 * 60 * 1000;

const countDown = (page: Page) => page.locator('nav').getByText(/Link availability/);

test.use(notLoggedIn);
// the photos of ACCENTED_DIR are 743 px high: no upscaling in the lightbox
test.use({viewport: {width: 1200, height: 600}});

test.describe('Sharing ends while the guest has it open', () => {
  let admin: APIRequestContext;
  const sharings: CreatedSharing[] = [];

  test.beforeEach(async ({playwright, baseURL}) => {
    admin = await playwright.request.newContext({baseURL, storageState: ADMIN_SESSION});
  });

  test.afterEach(async () => {
    await deleteSharingsWithApi(admin, sharings.splice(0).map(s => s.sharingKey));
    await admin.dispose();
  });

  const share = async (options: { valid?: number } = {}): Promise<CreatedSharing> => {
    const sharing = await createDirectorySharingWithApi(admin, ACCENTED_DIR, {recursive: true, ...options});
    sharings.push(sharing);
    return sharing;
  };

  const openAsGuest = async (page: Page, sharing: CreatedSharing): Promise<void> => {
    await page.goto('/share/' + sharing.sharingKey);
    await expect(page.locator('.photo-link > img[alt="IMG_8943.jpg"]')).toBeVisible({timeout: 15000});
  };

  /**
   * The sharing expires now on the server, as if its time ran out (the owner sets its validity to 0 ms).
   */
  const expireOnServer = async (sharing: CreatedSharing): Promise<void> => {
    const stored = (await (await admin.get('/pgapi/share/' + sharing.sharingKey)).json()).result;
    await expectApiOk(await admin.put('/pgapi/share/', {
      data: {updateSharing: {id: stored.id, directoryQuery: stored.directoryQuery, valid: 0}},
    }), 'expiring the sharing');
  };

  const seconds = async (page: Page): Promise<number> =>
    Number((await countDown(page).innerText()).match(/:(\d\d)\s*$/)?.[1]);

  test('Countdown should show the time left of a sharing that expires soon', async ({page}) => {
    const sharing = await share({valid: HOUR});
    await page.clock.install();
    await openAsGuest(page, sharing);

    // half a minute before the expiry; the clock stands still, so the countdown moves only with runFor()
    await page.clock.pauseAt(sharing.expires - 30 * 1000);
    await page.clock.runFor(1000);
    await expect(countDown(page)).toHaveText(/Link availability\s*:\s*0\s*days\s*,\s*00:00\s*:(29|30)/);
    const first = await seconds(page);
    await page.clock.runFor(5000);
    await expect.poll(() => seconds(page), {message: 'seconds left'}).toBeLessThanOrEqual(first - 4);
  });

  test('Countdown should not go below zero when the sharing expires', async ({page}) => {
    const sharing = await share({valid: HOUR});
    await page.clock.install();
    await openAsGuest(page, sharing);

    // everything the countdown shows from 2 s before until 3 s after the expiry, every quarter of a second
    await page.clock.pauseAt(sharing.expires - 2000);
    const shown = new Set<string>();
    for (let i = 0; i < 20; i++) {
      await page.clock.runFor(250);
      shown.add((await countDown(page).innerText()).replace(/\s+/g, ' '));
    }

    expect([...shown].filter(t => /-\d|NaN/.test(t)), 'negative or NaN countdown values').toEqual([]);
  });

  // the browser's clock reaches the expiry: the app asks the server, which knows that the sharing ended
  test('Sharing that expired while open should show the invalid link page once its countdown ends', async ({page}) => {
    const sharing = await share({valid: HOUR});
    await page.clock.install();
    await openAsGuest(page, sharing);

    await expireOnServer(sharing);
    // the browser's clock a second past the expiry it knows; the time goes on, so the page keeps working
    await page.clock.fastForward(sharing.expires + 1000 - await page.evaluate(() => Date.now()));

    await expectInvalidLinkPage(page);
  });

  test.describe('as a photo frame', () => {
    const openFrame = async (page: Page, sharing: CreatedSharing): Promise<void> => {
      await openAsGuest(page, sharing);
      // the frame link of the sharing: the sharing's url with the frame params (photo-frame-builder.gallery.component.ts)
      const url = new URL(page.url());
      await page.goto(url.pathname + url.search + (url.search ? '&' : '?') + 'p=IMG_8943.jpg&' + FRAME_PARAMS);
      await expectLightboxPhoto(page, 'IMG_8943.jpg', 15000);
    };

    // the part that works already
    test('Photo frame of a sharing should play for a guest', async ({page}) => {
      const sharing = await share();
      await openFrame(page, sharing);
      await expect(page.locator('app-toast-card')).toHaveCount(0);
    });

    test('Photo frame should show the invalid link message full screen once its sharing is deleted', async ({page}) => {
      const sharing = await share();
      await openFrame(page, sharing);
      await expectApiOk(await admin.delete('/pgapi/share/' + sharing.sharingKey), 'deleting the sharing');
      // the frame reloads its content every second

      await expectInvalidLinkPage(page, 10000);
    });
  });
});
