import {expect, Page, test} from '@playwright/test';
import {ACCENTED_DIR, expectApiOk, expectLightboxPhoto, expectNoHorizontalScroll, expectVisiblePhotosLoaded} from './helpers';

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
    await expectApiOk(await search, 'the search');

    await expect(page).toHaveURL(/\/search\//);
    await expect(searchBar).toHaveValue('űáéú őóüö');
    // the photos of the folder with accents in its name, also of its subfolder
    for (const name of ['IMG_8943.jpg', 'IMG_9697.jpg', 'IMG_8824.jpg']) {
      await expect(page.locator(`.photo-container > img[alt="${name}"]`)).toBeVisible();
    }
    await expectVisiblePhotosLoaded(page);
  });

  // CUJ 21: the autocomplete of the search bar
  test('Search should suggest a keyword while typing and search for the picked suggestion', async ({page}) => {
    await page.goto('/gallery/');
    const searchBar = page.locator('app-gallery-search .search-text');
    const autocomplete = page.locator('app-gallery-search .autocomplete-list');
    const suggestions = page.waitForResponse(res => new URL(res.url()).pathname.startsWith('/pgapi/autocomplete/'));
    // typed key by key: the suggestions follow the keyup
    await searchBar.pressSequentially('Berk');
    await expectApiOk(await suggestions, 'the autocomplete');
    await expect(searchBar).toHaveAttribute('aria-expanded', 'true');
    const berkley = autocomplete.getByRole('option').filter({hasText: 'Berkley'});
    await expect(berkley.first()).toBeVisible();

    const search = page.waitForResponse(res => new URL(res.url()).pathname.startsWith('/pgapi/search/'));
    // clicking a suggestion fills the search bar and searches for it (the arrow of the suggestion only fills it)
    await berkley.first().click();
    await expect(searchBar).toHaveValue(/Berkley/);
    await expectApiOk(await search, 'the search');
    await expect(page).toHaveURL(/\/search\//);
    await expect(page.locator('.photo-container > img[alt="IMG_5910.jpg"]')).toBeVisible();
    await expect(autocomplete).toHaveCount(0);
  });

  test('Search deep link with a photo should open the lightbox on that photo', async ({page}) => {
    const search = page.waitForResponse(res => new URL(res.url()).pathname.startsWith('/pgapi/search/'));
    // in search results the photo is identified with its folder (QueryService.getMediaStringId)
    await page.goto('/search/' + encodeURIComponent('űáéú őóüö') + '?p=' + encodeURIComponent(ACCENTED_DIR + '/IMG_8943.jpg'));
    await expectApiOk(await search, 'the search');

    await expectLightboxPhoto(page, 'IMG_8943.jpg');
    // not the fallback to the first photo of a stale link
    await expect(page.locator('app-toast-card')).toHaveCount(0);
    await expect(page.locator('app-lightbox-controls #rightArrow')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('app-gallery-lightbox-media img')).toHaveCount(0);
    // back on the results of the same search
    await expect(page).toHaveURL(url => decodeURIComponent(url.pathname) === '/search/űáéú őóüö' && !url.searchParams.has('p'));
    await expect(page.locator('.photo-container > img[alt="IMG_8943.jpg"]')).toBeInViewport();
  });

  test.describe('Malformed search link', () => {
    /**
     * The search bar still works after a broken link: a new search shows its results.
     */
    const expectSearchBarWorks = async (page: Page): Promise<void> => {
      const searchBar = page.locator('app-gallery-search .search-text');
      await searchBar.fill('big_ben');
      const search = page.waitForResponse(res => new URL(res.url()).pathname.startsWith('/pgapi/search/'));
      await searchBar.press('Enter');
      await expectApiOk(await search, 'the search');
      await expect(page.locator('.photo-container > img[alt="big_ben.jpg"]')).toBeVisible();
      await expect(page.locator('app-gallery .alert-danger')).toHaveCount(0);
    };

    test('should search for a link that is not a query object as text', async ({page}) => {
      const search = page.waitForResponse(res => new URL(res.url()).pathname.startsWith('/pgapi/search/'));
      // broken JSON: "{"
      await page.goto('/search/%7B');
      await expectApiOk(await search, 'the search');

      await expect(page.locator('app-gallery-search .search-text')).toHaveValue('{');
      await expect(page.getByText('Something went spectacularly wrong')).toHaveCount(0);
      await expect(page.locator('app-gallery .alert-danger')).toHaveCount(0);
      await expectSearchBarWorks(page);
    });

    test('should tell that the link is broken for an unknown search type, and keep the search bar working', async ({page}) => {
      test.fail(true, 'Not implemented yet #1309');
      await page.goto('/search/' + encodeURIComponent(JSON.stringify({t: 999, v: 'x'})));

      await expect(page.locator('app-gallery').getByText('This search link is broken')).toBeVisible();
      await expect(page.getByText('Something went spectacularly wrong')).toHaveCount(0);
      await expectSearchBarWorks(page);
    });
  });

  // Sanity check: what a user notices right away when opening search results. Soft checks, so one failure does not hide the others.
  test('Search results should look right', {tag: '@sanity'}, async ({page}) => {
    const query = {type: SEARCH_KEYWORD, value: 'Berkley', matchType: EXACT_MATCH};
    const search = page.waitForResponse(res => new URL(res.url()).pathname.startsWith('/pgapi/search/'));
    await page.goto('/search/' + encodeURIComponent(JSON.stringify(query)));
    await search;

    // the query is shown and the results render with loaded thumbnails
    await expect.soft(page.locator('app-gallery-search .search-text')).toHaveValue(/Berkley/);
    const squirrel = page.locator('.photo-container > img[alt="IMG_5910.jpg"]');
    await expect(squirrel).toBeVisible();
    await expectVisiblePhotosLoaded(page);
    await expectNoHorizontalScroll(page, 'search results');

    // opening a result shows it in the lightbox
    await squirrel.click();
    await expectLightboxPhoto(page, 'IMG_5910.jpg');
    await expectNoHorizontalScroll(page, 'lightbox');
  });
});
