// Unhappy paths of the critical user journeys (#1254): the user should get a clear message, not an empty or wrong page.
import {expect, Page, test} from '@playwright/test';
import {expectLightboxPhoto, isGalleryContent, notLoggedIn} from './helpers';

const NOT_EXISTING_SHARING = '/share/doesnotexist';
// what a missing or invalid sharing link should tell the user
const invalidLinkMessage = /not found|invalid|expired|does not exist/i;

/**
 * The message of an empty result: a visible text in the gallery with an icon next to it.
 * The exact design is not decided yet: only requires an icon with an explanation next to it.
 */
const expectMessageWithIcon = async (page: Page, message: RegExp): Promise<void> => {
  const text = page.locator('app-gallery').getByText(message);
  await expect(text).toBeVisible();
  await expect(text.locator('..').locator('ng-icon').first()).toBeVisible();
};

const isSearch = (url: URL): boolean => url.pathname.startsWith('/pgapi/search/');

/**
 * A failed load shows an inline error in the gallery: never an endless spinner or an empty grid.
 */
const expectLoadError = async (page: Page): Promise<void> => {
  await expect(page.locator('app-gallery .alert-danger[role="alert"]')).toBeVisible();
  await expect(page.locator('app-gallery .spinner')).toHaveCount(0);
  await expect(page.locator('app-gallery-grid .photo-container')).toHaveCount(0);
};

test.describe('Errors', () => {
  test.use({viewport: {width: 1200, height: 600}});

  test.describe('Not existing sharing link', () => {

    test.describe('as a guest', () => {
      test.use(notLoggedIn);

      test('should tell a guest that the link is invalid', async ({page}) => {
        test.fail(true, 'Not implemented yet #1254');
        await page.goto(NOT_EXISTING_SHARING);

        await expect(page.getByText(invalidLinkMessage).first()).toBeVisible({timeout: 10000});
        // not the generic error page
        await expect(page.getByText('Something went spectacularly wrong')).toHaveCount(0);
      });
    });

    test('should tell a logged in user that the link is invalid', async ({page}) => {
      test.fail(true, 'Not implemented yet #1254');
      await page.goto(NOT_EXISTING_SHARING);

      await expect(page.getByText(invalidLinkMessage).first()).toBeVisible({timeout: 10000});
      // no empty gallery with a broken sharing header
      await expect(page.locator('body')).not.toContainText('NaN');
      await expect(page.locator('app-gallery-grid')).toHaveCount(0);
    });
  });

  test.describe('Not existing folder', () => {

    test('should fall back to the root folder with a warning toast', async ({page}) => {
      test.fail(true, 'Not implemented yet #1254');
      const missingDir = 'nem_létező_mappa';
      await page.goto('/gallery/' + encodeURIComponent(missingDir));

      // falling back to the root is intended
      await expect(page).toHaveURL(url => url.pathname === '/gallery/');
      await expect(page.locator('.photo-container > img[alt="IMG_5910.jpg"]')).toBeAttached();
      // but the user is told why (a warning, not an error)
      await expect(page.locator('app-toast-card[role="status"]').filter({hasText: missingDir})).toBeVisible();
    });
  });

  test.describe('Empty results', () => {

    test('should show an icon and a message in an empty folder', async ({page}) => {
      test.fail(true, 'Not implemented yet #1254');
      const content = page.waitForResponse(res => new URL(res.url()).pathname === '/pgapi/gallery/content/emptydirectory');
      await page.goto('/gallery/emptydirectory');
      await content;

      // not /empty/i: the folder name itself contains that word
      await expectMessageWithIcon(page, /(folder|directory) is empty|no (photos|media|items)/i);
    });

    test('should show an icon and a message when the search matched nothing', async ({page}) => {
      test.fail(true, 'Not implemented yet #1254');
      const query = 'zzzznomatch';
      const search = page.waitForResponse(res => new URL(res.url()).pathname.startsWith('/pgapi/search/'));
      await page.goto('/search/' + query);
      await search;

      // e.g.: Search result of "zzzznomatch" matched nothing
      await expectMessageWithIcon(page, new RegExp(query + '.*(matched nothing|no (results|photos|media))', 'i'));
    });
  });

  test.describe('Deep link to a not existing photo', () => {

    // Intended: a deleted photo or a stale link falls back to the first photo with an info toast, instead of failing.
    // The photos of a smart photo frame (/frame) can change while it plays; this keeps its slideshow running.
    test('should open the first photo with an info toast', async ({page}) => {
      const content = page.waitForResponse(res => new URL(res.url()).pathname === '/pgapi/gallery/content/');
      await page.goto('/gallery/?p=not_existing.jpg');
      await content;

      await expect(page).toHaveURL(url => url.search === '?p=IMG_5910.jpg');
      await expectLightboxPhoto(page, 'IMG_5910.jpg');
      await expect(page.locator('app-toast-card[role="status"]').filter({hasText: 'not available'})).toBeVisible();
    });
  });

  test.describe('API errors', () => {

    test('should show an error, not a spinner, when the folder load gets a server error', async ({page}) => {
      test.fail(true, 'Not implemented yet #1305');
      await page.route(isGalleryContent, route => route.fulfill({status: 500, body: 'Internal Server Error'}));
      const failed = page.waitForResponse(res => isGalleryContent(new URL(res.url())));
      await page.goto('/gallery/');
      await failed;

      await expectLoadError(page);
    });

    test('should show an error, not a spinner, when the folder load loses the connection', async ({page}) => {
      test.fail(true, 'Not implemented yet #1305');
      await page.route(isGalleryContent, route => route.abort('internetdisconnected'));
      const failed = page.waitForEvent('requestfailed', req => isGalleryContent(new URL(req.url())));
      await page.goto('/gallery/');
      await failed;

      await expectLoadError(page);
    });

    test('should show an error when the search gets a server error', async ({page}) => {
      await page.route(isSearch, route => route.fulfill({status: 500, body: 'Internal Server Error'}));
      const failed = page.waitForResponse(res => isSearch(new URL(res.url())));
      await page.goto('/search/zzzzservererror');
      await failed;

      await expectLoadError(page);
    });

    test('should load the folder again with the Retry button after a server error', async ({page}) => {
      test.fail(true, 'Not implemented yet #1305');
      let fail = true;
      await page.route(isGalleryContent, route => fail ? route.fulfill({status: 500, body: 'Internal Server Error'}) : route.continue());
      const failed = page.waitForResponse(res => isGalleryContent(new URL(res.url())));
      await page.goto('/gallery/');
      await failed;
      await expect(page.locator('app-gallery .alert-danger[role="alert"]')).toBeVisible();

      fail = false;
      const retry = page.locator('app-gallery .alert-danger').getByRole('button', {name: 'Retry'});
      await expect(retry).toBeVisible();
      await retry.click();
      await expect(page.locator('.photo-container > img[alt="IMG_5910.jpg"]')).toBeAttached();
      await expect(page.locator('app-gallery .alert-danger')).toHaveCount(0);
    });

    test('should load the search again with the Retry button after a server error', async ({page}) => {
      test.fail(true, 'Not implemented yet #1305');
      let fail = true;
      await page.route(isSearch, route => fail ? route.fulfill({status: 500, body: 'Internal Server Error'}) : route.continue());
      const failed = page.waitForResponse(res => isSearch(new URL(res.url())));
      await page.goto('/search/big_ben');
      await failed;
      await expect(page.locator('app-gallery .alert-danger[role="alert"]')).toBeVisible();

      fail = false;
      const retry = page.locator('app-gallery .alert-danger').getByRole('button', {name: 'Retry'});
      await expect(retry).toBeVisible();
      await retry.click();
      await expect(page.locator('.photo-container > img[alt="big_ben.jpg"]')).toBeAttached();
      await expect(page.locator('app-gallery .alert-danger')).toHaveCount(0);
    });
  });

  test.describe('Unknown page', () => {

    test('should show a not found page with a link to the gallery', async ({page}) => {
      test.fail(true, 'Not implemented yet #1305');
      await page.goto('/foo');

      await expect(page.getByText(/page not found/i).first()).toBeVisible();
      // not the generic error page, which is for real errors
      await expect(page.getByText('Something went spectacularly wrong')).toHaveCount(0);
      await page.getByRole('link', {name: /gallery/i}).first().click();
      await expect(page).toHaveURL(url => url.pathname.startsWith('/gallery'));
      await expect(page.locator('.photo-container > img[alt="IMG_5910.jpg"]')).toBeAttached();
    });
  });
});
