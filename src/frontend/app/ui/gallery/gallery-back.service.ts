import {Injectable} from '@angular/core';
import {Location} from '@angular/common';
import {NavigationEnd, Router, UrlTree} from '@angular/router';
import {QueryParams} from '../../../../common/QueryParams';

/**
 * The back key (Android, browser) goes up to the parent folder in the
 * gallery, like a file manager, instead of to whatever was before: a folder
 * reached from the timeline, a search, a link or after a reload has its
 * parent put just before it in the history. Entries known to have the right
 * one before them are marked in history.state.
 */
@Injectable({providedIn: 'root'})
export class GalleryBackService {
  public static readonly MARK = 'pgParentBelow';
  public static readonly OVER_DIR = 'pgPhotoOverDir';
  private started = false;

  constructor(private router: Router, private location: Location) {
  }

  /** The folder a gallery url shows ('' = root), null for other pages. */
  public static directoryOf(url: UrlTree): string {
    const segments = url.root.children['primary']?.segments || [];
    if (segments[0]?.path !== 'gallery') {
      return null;
    }
    return (segments[1]?.path || '').replace(/^\/+|\/+$/g, '');
  }

  public static parentOf(dir: string): string {
    const i = dir.lastIndexOf('/');
    return i < 0 ? '' : dir.substring(0, i);
  }

  public start(): void {
    if (this.started) {
      return;
    }
    this.started = true;
    this.router.events.subscribe((e) => {
      if (e instanceof NavigationEnd) {
        this.onNavigationEnd(e);
      }
    });
  }

  private onNavigationEnd(e: NavigationEnd): void {
    const tree = this.router.parseUrl(e.urlAfterRedirects);
    const dir = GalleryBackService.directoryOf(tree);
    const photo = dir !== null && !!tree.queryParams[QueryParams.gallery.photo];
    const previous = this.current;
    this.current = {dir, photo, fine: false, overDir: false};
    if (dir === null) {
      return;
    }
    const state = (this.location.getState() || {}) as Record<string, unknown>;
    if (state[GalleryBackService.MARK]) {
      this.current.fine = true;
      this.current.overDir = !!state[GalleryBackService.OVER_DIR];
      return;
    }
    const nav = this.router.lastSuccessfulNavigation;
    const pushed = nav && nav.trigger !== 'popstate' && !nav.extras?.replaceUrl;
    const replaced = nav && nav.trigger !== 'popstate' && nav.extras?.replaceUrl;
    // What is just before this entry in the history: the previous page when
    // pushed, the one before the replaced entry when replaced.
    let overDir = photo && ((pushed && previous.dir === dir && !previous.photo) || (replaced && previous.overDir));
    const fine = overDir || (dir === '' && !photo) ||
      (pushed && previous.dir === dir) ||
      (pushed && !photo && previous.dir === GalleryBackService.parentOf(dir)) ||
      (replaced && previous.fine);
    const url = e.urlAfterRedirects;
    if (!fine) {
      // Put before it what back should show: the folder itself when a photo
      // is open, else its parent (same query otherwise). That entry gets its
      // own one when back reaches it.
      const below = this.router.createUrlTree(['/gallery', photo ? dir : GalleryBackService.parentOf(dir)], {
        queryParams: {...tree.queryParams, [QueryParams.gallery.photo]: null},
      });
      this.location.replaceState(this.router.serializeUrl(below));
      overDir = photo;
    }
    const marked = {...state, [GalleryBackService.MARK]: true, [GalleryBackService.OVER_DIR]: overDir};
    if (fine) {
      this.location.replaceState(url, '', marked);
    } else {
      this.location.go(url, '', marked);
    }
    this.current = {dir, photo, fine: true, overDir};
  }

  /**
   * Closing the photo: true when its folder is just before it in the
   * history (the caller goes back to it instead of adding the folder again,
   * so back does not open the photo again).
   */
  public photoOverDir(): boolean {
    return !!(this.location.getState() as Record<string, unknown>)?.[GalleryBackService.OVER_DIR];
  }

  private current: { dir: string; photo: boolean; fine: boolean; overDir: boolean } =
    {dir: null, photo: false, fine: false, overDir: false};
}
