// The map of the photos and GPX tracks (CUJ 10, #1254): in the gallery and in the info panel of the lightbox.
import {expect, Page, test} from '@playwright/test';
import {expectLightboxPhoto, isGalleryContent} from './helpers';

// a 1x1 transparent PNG
const BLANK_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

/**
 * No external network in the tests: the map tiles (OpenStreetMap by default) are blank images.
 */
const blockMapTiles = async (page: Page): Promise<void> => {
  await page.route(url => url.hostname.endsWith('tile.openstreetmap.org') || url.hostname === 'api.mapbox.com',
    route => route.fulfill({status: 200, contentType: 'image/png', body: BLANK_PNG}));
};

test.describe('Map', () => {

  test.beforeEach(async ({page}) => {
    await blockMapTiles(page);
  });

  test('Gallery map should show the photos with GPS and open the map with the GPX tracks', async ({page}) => {
    const content = page.waitForResponse(res => isGalleryContent(new URL(res.url())));
    await page.goto('/gallery/');
    await content;

    // the small map next to the blog: a marker for each photo with GPS
    const map = page.locator('app-gallery-map');
    await map.scrollIntoViewIfNeeded();
    await expect(map.locator('#map .leaflet-map')).toBeVisible();
    await expect.poll(() => map.locator('#map .leaflet-marker-pane .leaflet-marker-icon').count(), {message: 'markers on the small map'})
      .toBeGreaterThan(1);

    // a click opens the big map: the photos (clustered) and the GPX tracks of the folder
    const gpx = page.waitForResponse(res => /\.gpx\/bestFit$/.test(decodeURIComponent(new URL(res.url()).pathname)));
    await map.locator('button.overlay').click();
    await expect(page).toHaveURL(url => url.searchParams.get('map') === 'true');
    const bigMap = page.locator('app-gallery-map-lightbox');
    await expect(bigMap.locator('.leaflet-container')).toBeVisible();
    await expect.poll(() => bigMap.locator('.leaflet-marker-pane .leaflet-marker-icon').count(), {message: 'markers on the big map'})
      .toBeGreaterThan(0);
    expect((await gpx).ok(), 'a GPX file of the folder loads').toBe(true);
    await expect.poll(() => bigMap.locator('path.gpx-line').count(), {message: 'GPX tracks on the big map'}).toBeGreaterThan(0);

    // Escape closes it
    await page.keyboard.press('Escape');
    await expect(page).toHaveURL(url => !url.searchParams.has('map'));
  });

  test('Info panel should show the place of a photo on the map', async ({page}) => {
    // IMG_5910.jpg was taken in Berkeley
    await page.goto('/gallery/?p=IMG_5910.jpg');
    await expectLightboxPhoto(page, 'IMG_5910.jpg');
    await expect(page.locator('app-lightbox-controls #rightArrow')).toBeVisible();
    await page.keyboard.press('i');

    const panel = page.locator('app-info-panel');
    await expect(panel.locator('#map.leaflet-container')).toBeVisible();
    await expect(panel.locator('#map .leaflet-marker-icon')).toHaveCount(1);
    await expect(panel.locator('#map .leaflet-marker-icon')).toBeInViewport();
    // the GPS coordinates next to it
    await expect(panel.getByTitle('Click GPS coordinates to search for nearby media')).toContainText(/\d+\.\d+,\s*-?\d+\.\d+/);
  });
});
