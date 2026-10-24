import {Injectable} from '@angular/core';

import {IsActiveMatchOptions, Router} from '@angular/router';
import {ShareService} from '../ui/gallery/share.service';
import {Config} from '../../../common/config/public/Config';
import {NavigationLinkTypes} from '../../../common/config/public/ClientConfig';
import {SearchQueryUtils} from '../../../common/SearchQueryUtils';

@Injectable()
export class NavigationService {
  constructor(private router: Router, private shareService: ShareService) {
  }

  public isLoginPage(): boolean {
    return (
      this.router.isActive('login',
        {paths: 'exact', queryParams: 'exact', fragment: 'ignored', matrixParams: 'ignored'} as IsActiveMatchOptions) ||
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

  public async toLogin(): Promise<boolean> {
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
        this.toError();
      }
    } else {
      return this.router.navigate(['login']);
    }
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
