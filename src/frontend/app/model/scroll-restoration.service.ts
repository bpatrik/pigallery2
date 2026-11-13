import {Injectable, inject} from '@angular/core';
import {NavigationEnd, NavigationStart, Router} from '@angular/router';

/**
 * Restores the scroll position of a page on browser back and forward (#1308).
 *
 * The browser can't do it: it scrolls right on popstate, but the gallery renders its photos later and only as many rows
 * as the screen needs, so the page is too short there and stays at the top. Its scroll also beat the lightbox, which
 * scrolls the grid to the last shown photo when back closes it (#1310).
 * This service remembers the position of each history entry, and the page that renders the content (the grid)
 * takes the position once it rendered enough to scroll there.
 * Only a change of the path is restored: the query params (e.g. the lightbox ?p=, sorting) keep the page where it is.
 */
@Injectable({providedIn: 'root'})
export class ScrollRestorationService {
  private router = inject(Router);
  // scroll position of each history entry, by the id of the navigation that created the entry
  private readonly positions = new Map<number, number>();
  private lastId = 0;
  private lastPath: string | null = null;
  private restoring: { id: number, y: number } | null = null;
  private pending: number | null = null;

  constructor() {
    history.scrollRestoration = 'manual';
    this.router.events.subscribe((e): void => {
      if (e instanceof NavigationStart) {
        this.positions.set(this.lastId, window.scrollY);
        this.pending = null;
        const restoredId = e.restoredState?.navigationId;
        this.restoring = e.navigationTrigger === 'popstate' && restoredId !== undefined &&
        ScrollRestorationService.path(e.url) !== this.lastPath ?
          {id: e.id, y: this.positions.get(restoredId) ?? 0} : null;
      } else if (e instanceof NavigationEnd) {
        this.lastId = e.id;
        this.lastPath = ScrollRestorationService.path(e.urlAfterRedirects);
        if (this.restoring?.id === e.id) {
          this.pending = this.restoring.y;
        }
        this.restoring = null;
      }
    });
  }

  private static path(url: string): string {
    return url.split(/[?#]/)[0];
  }

  /**
   * The scroll position to restore after a browser back or forward, once; null if there is nothing to restore.
   */
  takePending(): number | null {
    const y = this.pending;
    this.pending = null;
    return y;
  }
}
