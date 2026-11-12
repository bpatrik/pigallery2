import {Injectable, computed, inject} from '@angular/core';

import {IsActiveMatchOptions, Router} from '@angular/router';
import {ShareService} from '../ui/gallery/share.service';
import {Config} from '../../../common/config/public/Config';
import {NavigationLinkTypes} from '../../../common/config/public/ClientConfig';
import {SearchQueryUtils} from '../../../common/SearchQueryUtils';

@Injectable({providedIn: 'root'})
export class NavigationService {
  private static readonly RETURN_URL = 'returnUrl';
  private router = inject(Router);
  private shareService = inject(ShareService);
  // the url of the last successful navigation (the same as router.url once the navigation finished)
  public readonly url = computed((): string => {
    const navigation = this.router.lastSuccessfulNavigation();
    return navigation?.finalUrl ? this.router.serializeUrl(navigation.finalUrl) : this.router.url;
  });
  // whether the app has shown a page yet (the first navigation can still be on its way, e.g. waiting for a guard)
  public readonly hasNavigated = computed((): boolean => this.router.lastSuccessfulNavigation() !== null);

  public isLoginPage(): boolean {
    return (
      // with or without the url to return to
      this.router.isActive('login',
        {paths: 'exact', queryParams: 'ignored', fragment: 'ignored', matrixParams: 'ignored'} as IsActiveMatchOptions) ||
      this.router.isActive('shareLogin',
        {paths: 'exact', queryParams: 'ignored', fragment: 'ignored', matrixParams: 'ignored'} as IsActiveMatchOptions)
    );
  }


  public isErrorPage(): boolean {
    return (
      this.router.isActive('error',
        {paths: 'exact', queryParams: 'exact', fragment: 'ignored', matrixParams: 'ignored'} as IsActiveMatchOptions)
    );
  }

  /**
   * @param returnUrl the url of this app to open after the login (e.g. where the session ended)
   */
  public async toLogin(returnUrl?: string): Promise<boolean> {
    await this.shareService.wait();
    if (this.shareService.isSharing()) {
      const publicSharing = await this.shareService.getPublicSharing();
      if (!publicSharing) {
        console.error('Navigating to share login with an invalid sharing');
        return this.toError();
      }
      if (publicSharing.passwordProtected === true) {
        return this.router.navigate(['shareLogin'], {
          queryParams: {sk: this.shareService.getSharingKey()},
        });
      } else {
        console.error('Navigating to share login without password protection. Something went somewhere off');
        return this.toError();
      }
    } else {
      if (returnUrl && NavigationService.isReturnUrl(returnUrl)) {
        return this.router.navigate(['login'], {queryParams: {[NavigationService.RETURN_URL]: returnUrl}});
      }
      return this.router.navigate(['login']);
    }
  }

  /**
   * Opens the url that the login page was opened for (#1306), or the default page.
   */
  public async toAfterLogin(): Promise<boolean> {
    const returnUrl: unknown = this.router.parseUrl(this.router.url).queryParams[NavigationService.RETURN_URL];
    if (typeof returnUrl === 'string' && NavigationService.isReturnUrl(returnUrl)) {
      return this.router.navigateByUrl(returnUrl);
    }
    return this.toDefault();
  }

  /**
   * Only a page of this app (a path, never another site), and not a login page.
   */
  private static isReturnUrl(url: string): boolean {
    return /^\/(?![/\\])/.test(url) && // a path, not another site
      !/^\/(login|shareLogin)?([?#/]|$)/.test(url); // not a login page ('/' redirects to the login page too)
  }

  public async toDefault(): Promise<boolean> {
    await this.shareService.wait();
    if (this.shareService.isSharing()) {
      return this.router.navigate(['/share', this.shareService.getSharingKey()]);
    } else {
      if (Config.Gallery.NavBar.links && Config.Gallery.NavBar.links.length > 0) {
        switch (Config.Gallery.NavBar.links[0].type) {
          case NavigationLinkTypes.gallery:
            return this.router.navigate(['gallery', '']);
          case NavigationLinkTypes.albums:
            return this.router.navigate(['albums']);
          case NavigationLinkTypes.faces:
            return this.router.navigate(['faces']);
          case NavigationLinkTypes.search:
            // a search link without a query has nowhere to go, fall back to the gallery
            if (Config.Gallery.NavBar.links[0].SearchQuery) {
              return this.router.navigate(['search', SearchQueryUtils.urlify(Config.Gallery.NavBar.links[0].SearchQuery)]);
            }
            console.error('First navbar link is a search without a query, falling back to the gallery.');
            break;
          default:
            console.error('nowhere to navigate.');
        }
      }

      return this.router.navigate(['gallery', '']);
    }
  }

  public async toGallery(): Promise<boolean> {
    await this.shareService.wait();
    if (this.shareService.isSharing()) {
      return this.router.navigate(['share', this.shareService.getSharingKey()]);
    } else {
      return this.router.navigate(['gallery', '']);
    }
  }

  public async search(searchText: string): Promise<boolean> {
    return this.router.navigate(['search', searchText]);
  }

  public async toError(): Promise<boolean> {
    return this.router.navigate(['error']);
  }
}
