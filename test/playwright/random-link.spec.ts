// The random link (#1313, CUJ 33): /pgapi/gallery/random/<query> answers with a random photo of the query,
// as the "Random link" dialog of the gallery builds it (random-query-builder.gallery.component.ts).
import {expect, test} from '@playwright/test';

const SEARCH_FILE_NAME = 103; // SearchQueryTypes.file_name
const EXACT_MATCH = 1; // TextSearchQueryMatchTypes.exact_match

const randomLink = (value: string): string =>
  '/pgapi/gallery/random/' + encodeURIComponent(JSON.stringify({type: SEARCH_FILE_NAME, value, matchType: EXACT_MATCH}));

test.describe('Random link', () => {
  test('should open a photo of its query in the browser', async ({page}) => {
    const res = await page.goto(randomLink('IMG_5910.jpg'));
    expect(res?.status()).toBe(200);
    expect(res?.headers()['content-type']).toBe('image/jpeg');
  });

  test.describe('whose query matches nothing', () => {
    // the part that works already: no crash
    test('should not crash the server', async ({page}) => {
      const res = await page.goto(randomLink('zzzznorandommatch.jpg'));
      expect(res?.status() ?? 500, 'no server error').toBeLessThan(500);
      await expect(page.locator('body')).not.toContainText(/\s+at\s+\S+\s+\(/);
    });

    test('should tell that no photos match', async ({page}) => {
      test.fail(true, 'Not implemented yet #1313: the browser shows the raw JSON error {"error":{"code":50,"message":"No photo found"...}}');
      await page.goto(randomLink('zzzznorandommatch.jpg'));

      await expect(page.getByText(/no photos match/i)).toBeVisible();
      await expect(page.locator('body')).not.toContainText('"error"');
    });
  });
});
