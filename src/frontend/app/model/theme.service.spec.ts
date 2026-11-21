import {ThemeModes} from '../../../common/config/Enums';
import {TestBed} from '@angular/core/testing';
import {ThemeService} from './theme.service';
import {GalleryCacheService} from '../ui/gallery/cache.gallery.service';


describe('ThemeService', () => {

  // jsdom has no window.matchMedia: a fake media query whose change event the test can fire
  let prefersDark: boolean;
  let changeListeners: ((e: MediaQueryListEvent) => void)[];
  const fireChange = (matches: boolean): void => {
    prefersDark = matches;
    changeListeners.forEach((l) => l({matches} as MediaQueryListEvent));
  };

  const setUp = (cachedMode: ThemeModes | null = null) => {
    const cacheService = {
      getThemeMode: (): ThemeModes | null => cachedMode,
      setThemeMode: vi.fn(),
    };
    TestBed.configureTestingModule({
      providers: [{provide: GalleryCacheService, useValue: cacheService}]
    });
    return TestBed.inject(ThemeService);
  };

  const theme = (): string | null => document.documentElement.getAttribute('data-bs-theme');

  beforeEach(() => {
    prefersDark = false;
    changeListeners = [];
    window.matchMedia = ((): MediaQueryList => ({
      get matches() {
        return prefersDark;
      },
      addEventListener: (_: string, l: (e: MediaQueryListEvent) => void) => changeListeners.push(l),
      removeEventListener: (_: string, l: (e: MediaQueryListEvent) => void) =>
        changeListeners = changeListeners.filter((c) => c !== l),
    } as unknown as MediaQueryList));
  });

  afterEach(() => {
    delete (window as { matchMedia?: unknown }).matchMedia;
    document.documentElement.removeAttribute('data-bs-theme');
  });

  it('should apply the cached mode while it is being created', () => {
    setUp(ThemeModes.dark);
    expect(theme()).toBe('dark');
  });

  it('should apply the mode synchronously on setMode', () => {
    const service = setUp(ThemeModes.light);
    expect(theme()).toBeNull();

    service.setMode(ThemeModes.dark);
    expect(service.mode()).toBe(ThemeModes.dark);
    expect(service.darkMode()).toBe(true);
    expect(theme()).toBe('dark');

    service.setMode(ThemeModes.light);
    expect(service.darkMode()).toBe(false);
    expect(theme()).toBeNull();
  });

  it('should follow the system preference synchronously in auto mode', () => {
    const service = setUp(ThemeModes.auto);
    expect(theme()).toBeNull();

    fireChange(true);
    expect(service.darkMode()).toBe(true);
    expect(theme()).toBe('dark');

    fireChange(false);
    expect(theme()).toBeNull();
  });

  describe('theme-color', () => {
    let meta: HTMLMetaElement;
    let style: HTMLStyleElement;
    const themeColor = (): string | null => meta.getAttribute('content');

    beforeEach(() => {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'theme-color');
      meta.setAttribute('content', '#000000');
      document.head.appendChild(meta);
      style = document.createElement('style');
      document.head.appendChild(style);
    });

    afterEach(() => {
      meta.remove();
      style.remove();
    });

    it('should follow the background of the page', () => {
      style.textContent = 'body {background-color: rgb(255, 255, 255);} ' +
        '[data-bs-theme=dark] body {background-color: rgb(33, 37, 41);}';
      const service = setUp(ThemeModes.light);
      expect(themeColor()).toBe('rgb(255, 255, 255)');

      service.setMode(ThemeModes.dark);
      expect(themeColor()).toBe('rgb(33, 37, 41)');

      service.setMode(ThemeModes.light);
      expect(themeColor()).toBe('rgb(255, 255, 255)');
    });

    it('should keep the colour of index.html when the page has no background', () => {
      const service = setUp(ThemeModes.light);
      service.setMode(ThemeModes.dark);
      expect(themeColor()).toBe('#000000');
    });
  });
});
