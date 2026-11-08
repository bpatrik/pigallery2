import {expect, test} from '@playwright/test';

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
});
