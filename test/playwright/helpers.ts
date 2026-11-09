import {expect, Locator, Page, TestInfo, ViewportSize} from '@playwright/test';
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

// below this width (bootstrap md) the navbar tabs are in the menu
const SMALL_SCREEN_WIDTH = 768;

/**
 * Overrides the viewport of a desktop browser (test.use(desktopViewport(...))). A phone keeps the viewport of its device preset.
 */
export const desktopViewport = (viewport: ViewportSize) => ({
  viewport: async ({isMobile}: { isMobile: boolean }, use: (v: ViewportSize | null) => Promise<void>, testInfo: TestInfo) =>
    use(isMobile ? testInfo.project.use.viewport ?? null : viewport),
});

/**
 * Checks (softly) what the navbar offers to the current user.
 * On a small screen (phone) the tabs and the share button are in the menu.
 */
export const expectNavbar = async (page: Page, expected: NavbarExpectation): Promise<void> => {
  const smallScreen = (page.viewportSize()?.width ?? 1280) < SMALL_SCREEN_WIDTH;
  await expect.soft(page.locator('app-frame nav app-gallery-search'), 'search bar').toHaveCount(expected.search ? 1 : 0);
  if (!smallScreen) {
    await expect.soft(page.locator('app-frame nav ul.navbar-nav.mb-0 .nav-link'), 'navbar tabs').toHaveText(expected.tabs);
    await expect.soft(page.locator('app-frame nav button#shareButton'), 'share button').toHaveCount(expected.share ? 1 : 0);
  }

  const menuButton = page.locator('button#button-frame-menu');
  await menuButton.click();
  const menu = page.locator('#dropdown-frame-menu');
  await expect(menu).toBeVisible();
  if (smallScreen) {
    await expect.soft(menu.locator('li.d-md-none a.dropdown-item').filter({visible: true}), 'tabs in the menu')
      .toHaveText(expected.tabs);
    await expect.soft(menu.locator('app-gallery-share button.dropdown-item').filter({visible: true}), 'share in the menu')
      .toHaveCount(expected.share ? 1 : 0);
  }
  // the Tools submenu is there for every user, the admin link only for admins
  await menu.locator('a.dropdown-item').filter({hasText: 'Tools'}).click();
  // the submenu is rendered in the body
  const toolsMenu = page.locator('ul.dropdown-menu').filter({has: page.locator('a.dropdown-item')}).last();
  await expect(toolsMenu).toBeVisible();
  await expect.soft(page.locator('a.dropdown-item[href="/admin"]'), 'admin menu').toHaveCount(expected.admin ? 1 : 0);
  await menuButton.click();
  await expect(menu).toHaveCount(0);
};

/**
 * Opens a tab of the navbar (e.g.: Faces). On a small screen (phone) the tabs are in the menu.
 */
export const clickNavbarTab = async (page: Page, tab: string): Promise<void> => {
  if ((page.viewportSize()?.width ?? 1280) < SMALL_SCREEN_WIDTH) {
    await page.locator('button#button-frame-menu').click();
    await page.locator('#dropdown-frame-menu li.d-md-none a.dropdown-item').filter({hasText: tab}).click();
    return;
  }
  await page.locator('app-frame nav ul.navbar-nav.mb-0 .nav-link').filter({hasText: tab}).click();
};

/**
 * Checks (softly) that the page fits the width of the screen: no horizontal scroll (e.g.: on a phone).
 * On failure, the message lists the innermost elements whose box or content (e.g.: text that does not wrap)
 * sticks out on the right of the screen, and by how much.
 */
export const expectNoHorizontalScroll = async (page: Page, where: string): Promise<void> => {
  await expect.soft.poll(() => page.evaluate(() => {
    const root = document.documentElement;
    const width = root.clientWidth;
    if (root.scrollWidth <= width && document.body.scrollWidth <= document.body.clientWidth) {
      return 'fits';
    }
    const name = (el: Element): string => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') +
      [...el.classList].slice(0, 3).map(c => '.' + c).join('');
    const inFixed = (el: Element | null): boolean => !!el && (getComputedStyle(el).position === 'fixed' || inFixed(el.parentElement));
    // the right edge of the element or of its overflowing content; fixed elements don't scroll the page
    const right = (el: Element): number => inFixed(el) ? 0 :
      el.getBoundingClientRect().right + Math.max(0, el.scrollWidth - el.clientWidth);
    const overflows = (el: Element): boolean => right(el) > width + 0.5;
    const culprits = [...document.body.querySelectorAll('*')]
      .filter(el => overflows(el) && ![...el.children].some(overflows))
      .slice(0, 5)
      .map(el => name(el) + ' in ' + (el.parentElement ? name(el.parentElement) : '-') +
        ' "' + (el.textContent ?? '').trim().replace(/\s+/g, ' ').substring(0, 40) + '"' +
        ' by ' + Math.round(right(el) - width) + 'px');
    return 'html scrollWidth ' + root.scrollWidth + ' > clientWidth ' + width +
      ', body scrollWidth ' + document.body.scrollWidth + ' > clientWidth ' + document.body.clientWidth +
      '; sticking out: ' + culprits.join(', ');
  }), {message: 'no horizontal scroll: ' + where, timeout: 2000}).toBe('fits');
};

/**
 * Swipes with a real touch (Chromium only, the context needs hasTouch, e.g.: a phone device preset).
 * dx < 0 swipes to the left (next photo in the lightbox).
 */
export const swipe = async (page: Page, dx: number, dy = 0): Promise<void> => {
  const size = page.viewportSize() ?? {width: 400, height: 800};
  const start = {x: Math.round(size.width / 2 - dx / 2), y: Math.round(size.height / 2 - dy / 2)};
  const cdp = await page.context().newCDPSession(page);
  const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', x: number, y: number) => cdp.send('Input.dispatchTouchEvent', {
    type, touchPoints: type === 'touchEnd' ? [] : [{x, y}],
  });
  await touch('touchStart', start.x, start.y);
  const steps = 5;
  for (let i = 1; i <= steps; i++) {
    await touch('touchMove', start.x + dx * i / steps, start.y + dy * i / steps);
  }
  await touch('touchEnd', start.x + dx, start.y + dy);
  await cdp.detach();
};

/**
 * Pinches with two real touch points around the middle of the screen (Chromium only, the context needs hasTouch).
 * scale > 1 spreads the fingers (zoom in), scale < 1 pinches them together (zoom out).
 */
export const pinch = async (page: Page, scale: number): Promise<void> => {
  const size = page.viewportSize() ?? {width: 400, height: 800};
  const center = {x: size.width / 2, y: size.height / 2};
  const startDistance = scale >= 1 ? 50 : 150;
  const endDistance = startDistance * scale;
  const cdp = await page.context().newCDPSession(page);
  const points = (distance: number) => [
    {x: Math.round(center.x - distance / 2), y: Math.round(center.y), id: 0},
    {x: Math.round(center.x + distance / 2), y: Math.round(center.y), id: 1},
  ];
  await cdp.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: points(startDistance)});
  const steps = 5;
  for (let i = 1; i <= steps; i++) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove', touchPoints: points(startDistance + (endDistance - startDistance) * i / steps),
    });
  }
  await cdp.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
  await cdp.detach();
};

/**
 * Double taps with a real touch in the middle of the screen (the context needs hasTouch).
 */
export const doubleTap = async (page: Page): Promise<void> => {
  const size = page.viewportSize() ?? {width: 400, height: 800};
  await page.touchscreen.tap(size.width / 2, size.height / 2);
  await page.touchscreen.tap(size.width / 2, size.height / 2);
};
