import {Component, inject, Injectable, OnInit} from '@angular/core';
import {NavigationError, PreloadingStrategy, Route} from '@angular/router';
import {EMPTY, Observable} from 'rxjs';
import {AuthenticationService} from './network/authentication.service';
import {Config} from '../../../common/config/public/Config';
import {UserRoles} from '../../../common/entities/UserDTO';

/**
 * Preloads the lazy routes marked with `data: {preload: true}` once a guest or higher user is logged in.
 * Sharing users (limited guests) can't open these pages, so they don't get them.
 * Admin is left out on purpose: most users never open it, and the Pi should not serve it to everyone.
 */
@Injectable({providedIn: 'root'})
export class PreloadMarkedRoutes implements PreloadingStrategy {
  private authService = inject(AuthenticationService);

  preload(route: Route, load: () => Observable<unknown>): Observable<unknown> {
    // the router preloads after every navigation, so the routes load after the login too
    if (route.data?.['preload'] === true && this.authService.isAuthorized(UserRoles.Guest)) {
      return load();
    }
    return EMPTY;
  }
}

export const isChunkLoadError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error);
  // Chrome / Firefox / Safari wording of a failed dynamic import
  return /dynamically imported module|module script failed/i.test(message);
};

const LAST_RELOAD_KEY = 'pigallery2-chunk-reload';

// a separate object, so the tests can replace it
export const PageLoader = {
  assign: (url: string): void => location.assign(url),
};

/**
 * After an upgrade, a tab that is still open references lazy files that no longer exist on the server.
 * Reloading the page loads the new index.html and the new files.
 */
export const reloadAfterUpgrade = (url: string): void => {
  // reload only once in a while, in case the files are really missing from the server
  try {
    const last = Number(sessionStorage.getItem(LAST_RELOAD_KEY) || 0);
    if (Date.now() - last < 10000) {
      return;
    }
    sessionStorage.setItem(LAST_RELOAD_KEY, String(Date.now()));
  } catch {
    // no sessionStorage (e.g. privacy settings): reload anyway
  }
  PageLoader.assign(url);
};

/**
 * Lazy routes: a failed load ends the navigation with an error.
 */
export const reloadOnChunkLoadError = (event: NavigationError): void => {
  if (!isChunkLoadError(event.error)) {
    return;
  }
  reloadAfterUpgrade(Config.Server.getAppUrl(event.url));
};

/**
 * @defer blocks: put it in the @error block, it shows up when the deferred files fail to load.
 * Angular does not tell why the loading failed, so it reloads for any error.
 */
@Component({
  selector: 'app-reload-after-upgrade',
  template: '',
})
export class ReloadAfterUpgradeComponent implements OnInit {
  ngOnInit(): void {
    reloadAfterUpgrade(location.href);
  }
}
