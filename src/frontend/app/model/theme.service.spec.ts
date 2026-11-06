import {TestBed} from '@angular/core/testing';
import {ThemeService} from './theme.service';
import {GalleryCacheService} from '../ui/gallery/cache.gallery.service';
import {ThemeModes} from '../../../common/config/public/ClientConfig';

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
});
