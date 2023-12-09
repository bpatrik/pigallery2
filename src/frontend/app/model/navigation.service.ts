import {Injectable} from '@angular/core';

import {IsActiveMatchOptions, Router} from '@angular/router';
import {ShareService} from '../ui/gallery/share.service';
import {Config} from '../../../common/config/public/Config';
import {NavigationLinkTypes} from '../../../common/config/public/ClientConfig';

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

  public async toLogin(): Promise<boolean> {
    await this.shareService.wait();
    if (this.shareService.isSharing()) {
      return this.router.navigate(['shareLogin'], {
        queryParams: {sk: this.shareService.getSharingKey()},
      });
    } else {
      return this.router.navigate(['login']);
    }
  }

  public async toDefault(): Promise<boolean> {
    await this.shareService.wait();
    if (this.shareService.isSharing()) {
      return this.router.navigate(['share', this.shareService.getSharingKey()]);
    } else {
      if (Config.Gallery.NavBar.links && Config.Gallery.NavBar.links.length > 0) {
        switch (Config.Gallery.NavBar.links[0].type) {
          case NavigationLinkTypes.gallery:
            return this.router.navigate(['gallery', '']);
          case NavigationLinkTypes.albums:
            return this.router.navigate(['albums', '']);
          case NavigationLinkTypes.faces:
            return this.router.navigate(['faces', '']);
          case NavigationLinkTypes.search:
            return this.router.navigate(['search', JSON.stringify(Config.Gallery.NavBar.links[0].SearchQuery)]);
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
}
