import {Injectable} from '@angular/core';
import {BehaviorSubject} from 'rxjs';
import {ThemeModes} from '../../../common/config/public/ClientConfig';
import {Config} from '../../../common/config/public/Config';
import {GalleryCacheService} from '../ui/gallery/cache.gallery.service';


@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  mode: ThemeModes = ThemeModes.light;
  public readonly darkMode: BehaviorSubject<boolean> = new BehaviorSubject(false);
  public readonly matcher = window.matchMedia('(prefers-color-scheme: dark)');

  constructor(private cachingService: GalleryCacheService) {
    this.init();
  }

  public init() {
    if (this.cachingService.getThemeMode()) {
      this.setMode(this.cachingService.getThemeMode());
    } else {
      this.setMode(Config.Gallery.Themes.defaultMode);
    }
    this.darkMode.subscribe((darkMode: boolean) => {
          this.applyMode(darkMode);
        }
    );
  }

  listenToModePreference() {
    if (this.mode !== ThemeModes.auto) {
      return;
    }
    this.darkMode.next(window.matchMedia('(prefers-color-scheme: dark)').matches);

    this.matcher.addEventListener('change', event => {
      this.darkMode.next(event.matches);
    });
  }

  stopListening() {
    this.matcher.removeAllListeners();
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
    if (this.mode === mode) {
      return;
    }
    this.mode = mode;
    if (this.mode === ThemeModes.light) {
      this.darkMode.next(false);
      this.stopListening();
    } else if (this.mode === ThemeModes.dark) {
      this.darkMode.next(true);
      this.stopListening();
    } else if (this.mode === ThemeModes.auto) {
      this.listenToModePreference();
    }
    this.cachingService.setThemeMode(this.mode);
  }


  toggleMode() {
    switch (this.mode) {
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
}

