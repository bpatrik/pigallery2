import {expect, Page, test} from '@playwright/test';
import {isGalleryContent, loginWithUi, notLoggedIn, scrollUntilAttached} from './helpers';

const photo = (page: Page, name: string) => page.locator(`.photo-container > img[alt="${name}"]`);
const lightboxTitle = (page: Page, text: string) =>
  page.locator('app-lightbox-controls > #controllers-container > .controls-title').filter({hasText: text});
const lightboxFaceNames = (page: Page) => page.locator('app-lightbox-controls .faces-container > .face > .face-name');

test.describe('Gallery', () => {
  test.beforeEach(async ({page}) => {
    const content = page.waitForResponse(res => isGalleryContent(new URL(res.url())));
    await page.goto('/gallery/');
    await content;
  });

  test('Gallery should open', async ({page}) => {
    await expect(page.locator('.mb-0 > :nth-child(1) > .nav-link')).toContainText('Gallery');
  });

  test('Gallery should filter', async ({page}) => {
    const filterButton = page.locator('app-gallery-navbar ng-icon[name="ionFunnelOutline"]');
    await filterButton.click();
    await page.locator('app-gallery-navbar #gallery-filter-0').selectOption('City');
    const berkeley = page.locator('app-gallery-navbar #gallery-filter-0 ~ .filter-column li').filter({hasText: 'Berkeley'});
    // the "select only this" icon shows up on hover
    await berkeley.hover();
    await berkeley.locator('ng-icon[name="ionFlagOutline"]').click();

    await filterButton.click();
    // should indicate that the filters have changed
    await expect(page.locator('app-gallery-navbar .btn-secondary ng-icon[name="ionFunnelOutline"]')).toBeVisible();

    // should this photo be visible
    await scrollUntilAttached(page, photo(page, 'IMG_5910.jpg'));
    await expect(photo(page, 'IMG_6220.jpg')).toHaveCount(0);
  });

  test('Gallery should keep the sorting and the grid size of a folder', async ({page}) => {
    const sortingButton = page.locator('app-gallery-navbar #button-alignment');
    const gridSizeButton = page.locator('app-gallery-navbar #button-grid-size');
    const firstPhoto = page.locator('app-gallery-grid .photo-container > img').first();

    // sort by name, descending
    await sortingButton.click();
    await page.locator('#sorting-dropdown .sorting-grouping-item').filter({hasText: 'name'}).first().click();
    await page.locator('#sorting-dropdown .sorting-grouping-item').filter({hasText: 'descending'}).first().click();
    await page.locator('body').click({position: {x: 0, y: 0}});
    await expect(firstPhoto).toHaveAttribute('alt', 'wild-3.jpg');
    // the largest grid size
    await gridSizeButton.click();
    await page.locator('#grid-size-dropdown .sorting-grouping-item').last().click();
    await expect(gridSizeButton).toHaveClass(/\bbtn-secondary\b/);

    // another folder has its own sorting and grid size
    await page.locator('app-gallery-directory a[href="/gallery/dupl"]').first().click();
    await expect(page).toHaveURL(url => url.pathname === '/gallery/dupl');
    await expect(sortingButton).toHaveClass(/\bbtn-outline-secondary\b/);
    await expect(gridSizeButton).toHaveClass(/\bbtn-outline-secondary\b/);

    // back to the first folder: both are kept
    await page.locator('app-gallery-navbar a').filter({hasText: 'Home'}).click();
    await expect(firstPhoto).toHaveAttribute('alt', 'wild-3.jpg');
    await expect(sortingButton).toHaveClass(/\bbtn-secondary\b/);
    await expect(gridSizeButton).toHaveClass(/\bbtn-secondary\b/);
  });

  test('Gallery should show infobar over photo', async ({page}) => {
    // contains a folder
    await expect(page.locator('app-gallery-directories.directories > app-gallery-directory > .button > .photo-container').first()).toBeVisible();

    // these photos should be visible
    await scrollUntilAttached(page, photo(page, 'IMG_6220.jpg'));
    await scrollUntilAttached(page, photo(page, 'IMG_5910.jpg'));
    await photo(page, 'IMG_5910.jpg').hover();

    const info = page.locator('.photo-container > .info');
    await expect(info.locator('.photo-name')).toContainText('IMG_5910.jpg');
    await expect(info.locator('.photo-position')).toContainText('Berkeley');
    const keywords = info.locator('.photo-keywords a');
    await expect(keywords.filter({hasText: 'Berkley'})).toBeVisible();
    await expect(keywords.filter({hasText: 'Alvin the Squirrel'})).toBeVisible();
    await expect(keywords.filter({hasText: 'USA'})).toBeVisible();
  });

  test('Gallery should open lightbox', async ({page}) => {
    // contains a folder
    await expect(page.locator('app-gallery-directories.directories > app-gallery-directory > .button > .photo-container').first()).toBeVisible();

    await scrollUntilAttached(page, photo(page, 'IMG_5910.jpg'));
    await photo(page, 'IMG_5910.jpg').click();
    await expect(lightboxTitle(page, 'Squirrel at berkely')).toBeVisible();
    await expect(lightboxFaceNames(page).filter({hasText: 'Alvin the Squirrel'})).toBeVisible();
  });

  test('Gallery should auto play in lightbox', async ({page}) => {
    await page.goto('/gallery/?p=IMG_5910.jpg');

    await expect(page.locator('app-gallery-lightbox-media img[alt="IMG_5910.jpg"]')).toBeVisible();
    await page.locator('.controls-background ng-icon[name="ionPlayOutline"]').click();

    // autoplay default delay is 5s
    await expect(page.locator('app-gallery-lightbox-media img[alt="IMG_6220.jpg"]')).toBeAttached({timeout: 7000});
  });

  test('Gallery should auto open lightbox for IMG_5910.jpg', async ({page}) => {
    await page.goto('/gallery/?p=IMG_5910.jpg');
    // at least one photo should be visible
    await expect(page.locator('app-gallery-grid-photo').first()).toBeAttached();
    await expect(photo(page, 'IMG_5910.jpg')).toBeAttached(); // the main photo should be visible

    await expect(lightboxTitle(page, 'Squirrel at berkely')).toBeVisible();
    await expect(lightboxFaceNames(page).filter({hasText: 'Alvin the Squirrel'})).toBeVisible();
  });

  test('Gallery should auto open lightbox for IMG_1252.jpg', async ({page}) => {
    await page.goto('/gallery/?p=IMG_1252.jpg');
    // at least one photo should be visible
    await expect(page.locator('app-gallery-grid-photo').first()).toBeAttached();
    await expect(photo(page, 'IMG_1252.jpg')).toBeAttached(); // the main photo should be visible

    await expect(lightboxTitle(page, 'This is a super long title with special characters -.,űáéúőpóüö')).toBeVisible();
    await expect(lightboxFaceNames(page)).toHaveCount(0);
  });
});

test.describe('Gallery - dont wait for content load', () => {
  test.use(notLoggedIn);

  test('Gallery should auto open lightbox for IMG_5910.jpg', async ({page}) => {
    await loginWithUi(page);
    await page.goto('/gallery/?p=IMG_5910.jpg');
    // at least one photo should be visible
    await expect(page.locator('app-gallery-grid-photo').first()).toBeAttached();
    await expect(photo(page, 'IMG_5910.jpg')).toBeAttached(); // the main photo should be visible

    await expect(lightboxTitle(page, 'Squirrel at berkely')).toBeVisible();
    await expect(lightboxFaceNames(page).filter({hasText: 'Alvin the Squirrel'})).toBeVisible();
  });

  test('Gallery should auto open lightbox for IMG_1252.jpg', async ({page}) => {
    await loginWithUi(page);
    await page.goto('/gallery/?p=IMG_1252.jpg');
    // at least one photo should be visible
    await expect(page.locator('app-gallery-grid-photo').first()).toBeAttached();
    await expect(photo(page, 'IMG_1252.jpg')).toBeAttached(); // the main photo should be visible

    await expect(lightboxTitle(page, 'This is a super long title with special characters -.,űáéúőpóüö')).toBeVisible();
    await expect(page.locator('app-lightbox-controls .faces-container > .face')).toHaveCount(0);
  });
});
