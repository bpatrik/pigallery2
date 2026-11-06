import { Injectable, inject, signal } from '@angular/core';
import {ThemeModes} from '../../../common/config/public/ClientConfig';
import {Config} from '../../../common/config/public/Config';
import {GalleryCacheService} from '../ui/gallery/cache.gallery.service';


@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private cachingService = inject(GalleryCacheService);

  public readonly mode = signal<ThemeModes>(ThemeModes.light);
  private readonly _darkMode = signal(false);
  public readonly darkMode = this._darkMode.asReadonly();
  public readonly matcher = window.matchMedia('(prefers-color-scheme: dark)');
  private readonly onModePreferenceChange = (event: MediaQueryListEvent): void => {
    this.setDarkMode(event.matches);
  };

  constructor() {
    this.init();
  }

  public init() {
    const cachedMode = this.cachingService.getThemeMode();
    if (cachedMode) {
      this.setMode(cachedMode);
    } else {
      this.setMode(Config.Gallery.Themes.defaultMode);
    }
    // Applied synchronously (not in an effect), so the theme is already set while the app is being constructed
    this.applyMode(this.darkMode());
  }

  listenToModePreference() {
    if (this.mode() !== ThemeModes.auto) {
      return;
    }
    this.setDarkMode(window.matchMedia('(prefers-color-scheme: dark)').matches);

    this.matcher.removeEventListener('change', this.onModePreferenceChange);
    this.matcher.addEventListener('change', this.onModePreferenceChange);
  }

  stopListening() {
    this.matcher.removeEventListener('change', this.onModePreferenceChange);
  }

  applyMode(darkMode: boolean) {
    if (!Config.Gallery.Themes.enabled) {
      return;
    }
    if (!darkMode) {
      document.documentElement.removeAttribute('data-bs-theme');
    } else {
      document.documentElement.setAttribute('data-bs-theme', 'dark');
    }
  }

  setMode(mode: ThemeModes) {
    if (this.mode() === mode) {
      return;
    }
    this.mode.set(mode);
    if (mode === ThemeModes.light) {
      this.setDarkMode(false);
      this.stopListening();
    } else if (mode === ThemeModes.dark) {
      this.setDarkMode(true);
      this.stopListening();
    } else if (mode === ThemeModes.auto) {
      this.listenToModePreference();
    }
    this.cachingService.setThemeMode(mode);
  }


  toggleMode() {
    switch (this.mode()) {
      case ThemeModes.light:
        this.setMode(ThemeModes.dark);
        break;
      case ThemeModes.dark:
        this.setMode(ThemeModes.auto);
        break;
      case ThemeModes.auto:
        this.setMode(ThemeModes.light);
        break;
    }
  }

  private setDarkMode(dark: boolean): void {
    this._darkMode.set(dark);
    this.applyMode(dark);
  }
}
