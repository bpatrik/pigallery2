import {expect, test} from '@playwright/test';
import {expectLightboxPhoto, expectVisiblePhotosLoaded} from './helpers';

const SEARCH_KEYWORD = 104; // SearchQueryTypes.keyword
const EXACT_MATCH = 1; // TextSearchQueryMatchTypes.exact_match

test.describe('Search', () => {
  test('Search builder should propagate to search bar', async ({page}) => {
    await page.goto('/gallery/');
    await expect(page.locator('.mb-0 > :nth-child(1) > .nav-link')).toContainText('Gallery');

    const searchBar = page.locator('app-gallery-search .search-text');
    const builderText = page.locator('app-gallery-search-query-builder app-gallery-search-field-base input.search-text');
    await searchBar.fill('a and b');
    await page.locator('app-gallery-search ng-icon[name="ionChevronDownOutline"]').click();
    await expect(builderText).toHaveValue('a and b');
    await page.locator('app-gallery-search-query-entry .btn-danger').last().click();
    await expect(builderText).toHaveValue('a');
    await page.locator('modal-container .btn-close').click();
    await expect(searchBar).toHaveValue('a');
  });

  test('Search should find the photos of a typed text with accents', async ({page}) => {
    await page.goto('/gallery/');
    const searchBar = page.locator('app-gallery-search .search-text');
    await searchBar.fill('űáéú őóüö');
    const search = page.waitForResponse(res => new URL(res.url()).pathname.startsWith('/pgapi/search/'));
    await searchBar.press('Enter');
    expect((await search).ok()).toBe(true);

    await expect(page).toHaveURL(/\/search\//);
    await expect(searchBar).toHaveValue('űáéú őóüö');
    // the photos of the folder with accents in its name, also of its subfolder
    for (const name of ['IMG_8943.jpg', 'IMG_9697.jpg', 'IMG_8824.jpg']) {
      await expect(page.locator(`.photo-container > img[alt="${name}"]`)).toBeVisible();
    }
    await expectVisiblePhotosLoaded(page);
  });

  // Sanity check: what a user notices right away when opening search results. Soft checks, so one failure does not hide the others.
  test('Search results should look right', async ({page}) => {
    const query = {type: SEARCH_KEYWORD, value: 'Berkley', matchType: EXACT_MATCH};
    const search = page.waitForResponse(res => new URL(res.url()).pathname.startsWith('/pgapi/search/'));
    await page.goto('/search/' + encodeURIComponent(JSON.stringify(query)));
    await search;

    // the query is shown and the results render with loaded thumbnails
    await expect.soft(page.locator('app-gallery-search .search-text')).toHaveValue(/Berkley/);
    const squirrel = page.locator('.photo-container > img[alt="IMG_5910.jpg"]');
    await expect(squirrel).toBeVisible();
    await expectVisiblePhotosLoaded(page);

    // opening a result shows it in the lightbox
    await squirrel.click();
    await expectLightboxPhoto(page, 'IMG_5910.jpg');
  });
});
