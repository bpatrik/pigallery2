// A sharing ends while a guest has it open (#1307), also as a photo frame (#1313):
// the guest gets the "This link is invalid or has expired" page, full screen.
import {APIRequestContext, expect, Page, test} from '@playwright/test';
import {ADMIN_SESSION} from './global-setup';
import {ACCENTED_DIR, createDirectorySharingWithApi, CreatedSharing, expectInvalidLinkPage, expectLightboxPhoto, notLoggedIn} from './helpers';

// a frame link: playing, looping, caption on, controls hidden, the next photo after 300 s, reloading the content every second
// (the same as frameParams of frame.spec.ts)
const FRAME_PARAMS = 'play=true&auInt=1&ls=true&cAO=true&cd=true&ssp=300';

// long enough to open the sharing on a busy server, short enough to wait for
const SHORT_VALIDITY = 10000;

const countDown = (page: Page) => page.locator('nav').getByText(/Link availability/);
// the countdown reached zero (or went past it)
const COUNTDOWN_AT_ZERO = /0\s*days\s*,\s*00:00\s*:00|-\d|NaN/;

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
    // expired sharings are removed by the server; the others are deleted here
    for (const s of sharings.splice(0)) {
      await admin.delete('/pgapi/share/' + s.sharingKey);
    }
    await admin.dispose();
  });

  const share = async (options: { valid?: number } = {}): Promise<CreatedSharing> => {
    const sharing = await createDirectorySharingWithApi(admin, ACCENTED_DIR, {recursive: true, ...options});
    sharings.push(sharing);
    return sharing;
  };

  const openAsGuest = async (page: Page, sharing: CreatedSharing): Promise<void> => {
    await page.goto('/share/' + sharing.sharingKey);
    await expect(page.locator('.photo-container > img[alt="IMG_8943.jpg"]')).toBeVisible({timeout: 15000});
  };

  test('Countdown should show the time left of a sharing that expires soon', async ({page}) => {
    const sharing = await share({valid: 60 * 1000});
    await openAsGuest(page, sharing);

    // less than a minute, counting down
    await expect(countDown(page)).toHaveText(/Link availability\s*:\s*0\s*days\s*,\s*00:00\s*:[0-5]\d/);
    const seconds = async (): Promise<number> => Number((await countDown(page).innerText()).match(/:(\d\d)\s*$/)?.[1]);
    const first = await seconds();
    await expect.poll(seconds, {message: 'seconds left'}).toBeLessThan(first);
  });

  test('Countdown should not go below zero when the sharing expires', async ({page}) => {
    test.fail(true, 'Not implemented yet #1307: the countdown goes on below zero ("-1 days , 23:59:59")');
    const sharing = await share({valid: SHORT_VALIDITY});
    await openAsGuest(page, sharing);

    // everything the countdown shows until a while after the expiry
    const shown = new Set<string>();
    await expect.poll(async () => {
      const text = await countDown(page).innerText({timeout: 500}).catch(() => '');
      if (text) {
        shown.add(text.replace(/\s+/g, ' '));
      }
      return Date.now() > sharing.expires + 2500;
    }, {message: 'waiting until the sharing expired', intervals: [200], timeout: SHORT_VALIDITY + 10000}).toBe(true);

    expect([...shown].filter(t => /-\d|NaN/.test(t)), 'negative or NaN countdown values').toEqual([]);
  });

  test('Sharing that expired while open should show the invalid link page on the next navigation', async ({page}) => {
    test.fail(true, 'Not implemented yet #1307: the guest gets an empty gallery with a negative countdown instead');
    const sharing = await share({valid: SHORT_VALIDITY});
    await openAsGuest(page, sharing);

    await expect(countDown(page)).toHaveText(COUNTDOWN_AT_ZERO, {timeout: SHORT_VALIDITY + 5000});
    // the countdown shows 00:00:00 for the last second before the expiry
    await expect.poll(() => Date.now() > sharing.expires + 1000, {message: 'waiting until the sharing expired', timeout: 5000})
      .toBe(true);
    await page.locator('app-gallery-directory .directory-name').filter({hasText: 'subdirectory'}).click();

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
      test.fail(true, 'Not implemented yet #1313: the frame shows the generic error page (Something went spectacularly wrong)');
      const sharing = await share();
      await openFrame(page, sharing);
      expect((await admin.delete('/pgapi/share/' + sharing.sharingKey)).ok(), 'deleting the sharing').toBe(true);
      // the frame reloads its content every second

      await expectInvalidLinkPage(page, 10000);
    });
  });
});
