// The random link (#1313, CUJ 33): /pgapi/gallery/random/<query> answers with a random photo of the query,
// as the "Random link" dialog of the gallery builds it (random-query-builder.gallery.component.ts).
import {expect, test} from '@playwright/test';
import {ACCENTED_DIR, pressEnterLikeAPhoneKeyboard} from './helpers';

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

  // the dialog starts with the photos on the screen; the link must work as it is copied
  test('should build a working link of the opened folder', async ({page}) => {
    await page.goto('/gallery/' + encodeURIComponent(ACCENTED_DIR));
    await page.locator('ng-icon[name="ionMenuOutline"]').click();
    await page.locator('ng-icon[name="ionHammerOutline"]').click();
    await page.locator('ng-icon[name="ionShuffleOutline"]').click();

    const link = await page.locator('#randomLink').inputValue();
    const query = decodeURIComponent(link.substring(link.indexOf('/gallery/random/') + '/gallery/random/'.length));
    const folder = (JSON.parse(query) as { v: string }).v;
    expect(folder.replace(/^\.\//, '')).toBe(ACCENTED_DIR);
    expect(link, 'url encoded, no raw quotes or braces').not.toMatch(/[{}"\s]/);

    const res = await page.request.get(link);
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toBe('image/jpeg');
  });

  // the Enter key of a phone keyboard submits the form of the dialog; it clicked the delete button of the query (a button without a type)
  test('should keep the typed query on the Enter key of a phone keyboard', async ({page}) => {
    await page.goto('/gallery/');
    await page.locator('ng-icon[name="ionMenuOutline"]').click();
    await page.locator('ng-icon[name="ionHammerOutline"]').click();
    await page.locator('ng-icon[name="ionShuffleOutline"]').click();

    const queryText = page.locator('modal-container app-gallery-search-field-base input.search-text');
    // Enter does not search here, so the keyboard does not show a search key
    await expect.soft(queryText).not.toHaveAttribute('enterkeyhint');
    await queryText.fill('big_ben');
    await pressEnterLikeAPhoneKeyboard(queryText);
    await queryText.blur();

    await expect(queryText).toHaveValue('big_ben');
    await expect(page.locator('#randomLink')).toHaveValue(/big_ben/);
    await expect(page.locator('modal-container')).toHaveCount(1);
  });

  test.describe('whose query matches nothing', () => {
    // the part that works already: no crash
    test('should not crash the server', async ({page}) => {
      const res = await page.goto(randomLink('zzzznorandommatch.jpg'));
      expect(res?.status() ?? 500, 'no server error').toBeLessThan(500);
      await expect(page.locator('body')).not.toContainText(/\s+at\s+\S+\s+\(/);
    });

    test('should tell that no photos match', async ({page}) => {
      await page.goto(randomLink('zzzznorandommatch.jpg'));

      await expect(page.getByText(/no photos match/i)).toBeVisible();
      await expect(page.locator('body')).not.toContainText('"error"');
    });
  });
});
