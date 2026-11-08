import {expect, Locator, Page} from '@playwright/test';

// a fresh browser without the logged in admin session of global-setup.ts
export const notLoggedIn = {storageState: {cookies: [], origins: []}};

export const isGalleryContent = (url: URL): boolean => url.pathname === '/pgapi/gallery/content/';

/**
 * Logs in as admin on the login page.
 */
export const loginWithUi = async (page: Page): Promise<void> => {
  await page.goto('/');
  await expect(page.locator('.card-body')).toBeVisible();
  await expect(page.locator('.col-sm-12').filter({hasText: 'Login'}).first()).toBeVisible();
  await page.locator('#username').fill('admin');
  await page.locator('#password').fill('admin');
  const login = page.waitForResponse(res => new URL(res.url()).pathname === '/pgapi/user/login');
  await page.locator('.col-sm-12 > .btn').click();
  expect((await login).ok()).toBe(true);
};

/**
 * Scrolls down a screen at a time until the locator is rendered (the grid renders the photos while scrolling).
 */
export const scrollUntilAttached = async (page: Page, locator: Locator): Promise<void> => {
  await expect(async () => {
    if (await locator.count() === 0) {
      await page.mouse.wheel(0, page.viewportSize()?.height ?? 720);
    }
    await expect(locator).toBeAttached({timeout: 300});
  }).toPass({intervals: [100], timeout: 15000});
};

/**
 * Waits until the photos of the grid that are on the screen are loaded (no loading placeholder, no broken image).
 * The server generates the thumbnails on the first request, so they can come later than the content.
 */
export const expectVisiblePhotosLoaded = async (page: Page, timeout?: number): Promise<void> => {
  await expect(page.locator('app-gallery-grid .photo-container > img').first()).toBeVisible({timeout});
  await expect.poll(() => page.evaluate(() => {
    const inView = (el: Element): boolean => {
      const r = el.getBoundingClientRect();
      return r.bottom > 0 && r.top < window.innerHeight;
    };
    const loading = [...document.querySelectorAll('app-gallery-grid app-gallery-grid-photo-loading')].filter(inView);
    const notLoaded = [...document.querySelectorAll<HTMLImageElement>('app-gallery-grid .photo-container > img')]
      .filter(inView).filter(img => !img.complete || img.naturalWidth === 0);
    return loading.length + notLoaded.length;
  }), {message: 'photos on the screen that are not loaded', timeout}).toBe(0);
};

/**
 * Waits until the lightbox shows the photo in high resolution: the lightbox shows the thumbnail
 * (upscaled, sometimes together with the loading large photo) until the large photo is loaded, then only the large photo.
 */
export const expectLightboxPhoto = async (page: Page, name: string, timeout?: number): Promise<void> => {
  await expect.poll(() => page.locator('app-gallery-lightbox-media img').evaluateAll((imgs: HTMLImageElement[]) => {
    if (imgs.length !== 1) {
      return imgs.length + ' images: ' + imgs.map(i => i.getAttribute('src')).join(', ');
    }
    const img = imgs[0];
    if (!img.complete || img.naturalWidth === 0) {
      return 'loading: ' + img.getAttribute('src');
    }
    const shownWidth = Math.round(img.getBoundingClientRect().width);
    if (img.naturalWidth < shownWidth) {
      return 'upscaled (' + img.naturalWidth + 'px shown as ' + shownWidth + 'px): ' + img.getAttribute('src');
    }
    return img.alt;
  }), {message: 'the lightbox shows the large photo', timeout}).toBe(name);
};
