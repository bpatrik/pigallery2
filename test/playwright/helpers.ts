import {expect, Locator, Page} from '@playwright/test';
import {USER_SESSION} from './global-setup';

// a fresh browser without the logged in admin session of global-setup.ts
export const notLoggedIn = {storageState: {cookies: [], origins: []}};
// logged in as a normal (not admin) user, see global-setup.ts
export const asNormalUser = {storageState: USER_SESSION};

export const isGalleryContent = (url: URL): boolean => url.pathname === '/pgapi/gallery/content/';

/**
 * A demo/images folder with accents, spaces and punctuation in its name: the journeys that use it check non-ASCII paths.
 * It has IMG_8943.jpg, IMG_9697.jpg and subdirectory/IMG_8824.jpg.
 */
export const ACCENTED_DIR = 'its  a along directory name. with special caracters(_.-.,-.,) 1234 56789 űáéú őóüö';

/**
 * Logs in on the login page, as admin by default.
 */
export const loginWithUi = async (page: Page, username = 'admin', password = 'admin'): Promise<void> => {
  await page.goto('/');
  await expect(page.locator('.card-body')).toBeVisible();
  await expect(page.locator('.col-sm-12').filter({hasText: 'Login'}).first()).toBeVisible();
  await page.locator('#username').fill(username);
  await page.locator('#password').fill(password);
  const login = page.waitForResponse(res => new URL(res.url()).pathname === '/pgapi/user/login');
  await page.locator('.col-sm-12 > .btn').click();
  expect((await login).ok()).toBe(true);
};

/**
 * Logs out with the menu of the navbar.
 */
export const logoutWithUi = async (page: Page): Promise<void> => {
  await page.locator('button#button-frame-menu').click();
  const loggedOut = page.waitForResponse(res => new URL(res.url()).pathname === '/pgapi/user/logout');
  await page.locator('#dropdown-frame-menu ng-icon[name="ionLogOutOutline"]').click();
  await loggedOut;
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

/**
 * The width of the loaded background image (the cover of a folder, album or face card), 0 if it does not load.
 */
export const backgroundImageWidth = (photo: Locator): Promise<number> => photo.evaluate(el => {
  const url = getComputedStyle(el).backgroundImage.match(/url\("(.*)"\)/)?.[1];
  return new Promise<number>(resolve => {
    if (!url) {
      return resolve(0);
    }
    const img = new Image();
    img.onload = () => resolve(img.naturalWidth);
    img.onerror = () => resolve(0);
    img.src = url;
  });
});

/**
 * Checks (softly) that a folder, album or face card shows its cover and not the placeholder icon.
 */
export const expectCardCover = async (card: Locator): Promise<void> => {
  const name = await card.locator('.info').innerText();
  await expect.soft(card.locator('.no-image'), 'no placeholder instead of the cover: ' + name).toHaveCount(0);
  await expect.soft.poll(() => card.locator('.photo-container .photo').count().then(c => c === 0 ? 0 :
    backgroundImageWidth(card.locator('.photo-container .photo'))), {message: 'cover is loaded: ' + name}).toBeGreaterThan(0);
};

export interface NavbarExpectation {
  // the tabs in the order of the navbar (e.g.: Gallery, Albums, Faces)
  tabs: string[];
  search: boolean;
  share: boolean;
  admin: boolean;
}

/**
 * Checks (softly) what the navbar offers to the current user. Needs a desktop viewport (the tabs are in the menu on a phone).
 */
export const expectNavbar = async (page: Page, expected: NavbarExpectation): Promise<void> => {
  await expect.soft(page.locator('app-frame nav ul.navbar-nav.mb-0 .nav-link'), 'navbar tabs').toHaveText(expected.tabs);
  await expect.soft(page.locator('app-frame nav app-gallery-search'), 'search bar').toHaveCount(expected.search ? 1 : 0);
  await expect.soft(page.locator('app-frame nav button#shareButton'), 'share button').toHaveCount(expected.share ? 1 : 0);

  // the admin page is in the Tools submenu
  const menuButton = page.locator('button#button-frame-menu');
  await menuButton.click();
  await page.locator('#dropdown-frame-menu a.dropdown-item').filter({hasText: 'Tools'}).click();
  // the submenu is rendered in the body; Duplicates is there for every user, the admin link only for admins
  const toolsMenu = page.locator('ul.dropdown-menu').filter({has: page.locator('a.dropdown-item')}).last();
  await expect(toolsMenu).toBeVisible();
  await expect.soft(page.locator('a.dropdown-item[href="/admin"]'), 'admin menu').toHaveCount(expected.admin ? 1 : 0);
  await menuButton.click();
  await expect(page.locator('#dropdown-frame-menu')).toHaveCount(0);
};
