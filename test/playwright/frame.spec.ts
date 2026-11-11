// The smart photo frame (#1313, CUJ 34): a gallery or search link with the lightbox playing on its own,
// as the "Photo frame" button of the gallery builds it (photo-frame-builder.gallery.component.ts).
import {expect, test} from '@playwright/test';
import {expectLightboxPhoto} from './helpers';

/**
 * The query params of a frame link: playing, looping, caption on, controls hidden.
 * @param slideshowSpeed seconds per photo
 * @param pollInterval seconds between two reloads of the content
 */
const frameParams = (slideshowSpeed: number, pollInterval: number): string =>
  `play=true&auInt=${pollInterval}&ls=true&cAO=true&cd=true&ssp=${slideshowSpeed}`;

const isSearch = (url: URL): boolean => url.pathname.startsWith('/pgapi/search/');

test.describe('Photo frame', () => {
  test.use({viewport: {width: 1200, height: 800}});

  test('should show a photo and move on to the next one on its own', async ({page}) => {
    await page.goto('/gallery/?p=IMG_5910.jpg&' + frameParams(1, 300));

    await expectLightboxPhoto(page, 'IMG_5910.jpg');
    await expect(page).toHaveURL(url => url.searchParams.get('p') !== 'IMG_5910.jpg', {timeout: 15000});
    await expectLightboxPhoto(page, new URL(page.url()).searchParams.get('p')!);
    // a frame shows only the photo, no error
    await expect(page.locator('app-toast-card')).toHaveCount(0);
  });

  // keeps showing the current photo and retries quietly (a small indicator only after a few failures is not checked here)
  test('should keep showing the photo when it loses the connection to the server', async ({page}) => {
    await page.goto('/gallery/?p=IMG_5910.jpg&' + frameParams(300, 1));
    await expectLightboxPhoto(page, 'IMG_5910.jpg');

    let failed = 0;
    await page.route(url => url.pathname.startsWith('/pgapi/'), route => {
      failed++;
      return route.abort('internetdisconnected');
    });
    await expect.poll(() => failed, {message: 'failed polls', timeout: 10000}).toBeGreaterThanOrEqual(2);

    await expectLightboxPhoto(page, 'IMG_5910.jpg');
    await expect(page).toHaveURL(url => url.searchParams.get('p') === 'IMG_5910.jpg');
    await expect(page.locator('app-toast-card')).toHaveCount(0);
    await expect(page.locator('.alert-danger')).toBeHidden();
  });

  test.describe('whose search matches nothing', () => {
    const query = 'zzzznoframematch';

    test('should reload the search on its own, without a toast', async ({page}) => {
      let searches = 0;
      page.on('request', req => {
        if (isSearch(new URL(req.url()))) {
          searches++;
        }
      });
      await page.goto('/search/' + query + '?' + frameParams(1, 1));

      // polls every second, so a frame on a wall recovers once photos are added
      await expect.poll(() => searches, {message: 'search requests', timeout: 10000}).toBeGreaterThanOrEqual(3);
      await expect(page.locator('app-toast-card')).toHaveCount(0);
    });

    test('should show a full screen message', async ({page}) => {
      test.fail(true, 'Not implemented yet #1313');
      const search = page.waitForResponse(res => isSearch(new URL(res.url())));
      await page.goto('/search/' + query + '?' + frameParams(1, 300));
      await search;

      const message = page.getByText(/no photos match this frame/i);
      await expect(message).toBeVisible();
      // full screen: nothing of the gallery around it
      await expect(page.locator('app-frame nav')).toBeHidden();
      await expect(page.locator('app-toast-card')).toHaveCount(0);
    });
  });
});
