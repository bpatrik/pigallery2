import {Injectable} from '@angular/core';
import {ActivatedRouteSnapshot, CanActivate, RouterStateSnapshot} from '@angular/router';
import {AuthenticationService} from '../authentication.service';
import {NavigationService} from '../../navigation.service';
import {ShareService} from '../../../ui/gallery/share.service';

@Injectable({providedIn: 'root'})
export class AuthGuard implements CanActivate {
  constructor(
    private authenticationService: AuthenticationService,
    private navigationService: NavigationService,
    private shareService: ShareService,
  ) {
  }

  async canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Promise<boolean> {
    // Wait for session cookie restoration (async HTTP call started in constructor)
    await this.authenticationService.waitForSessionUser();

    if (this.authenticationService.isAuthenticated()) {
      return true;
    }

    // For no-password shares, try backend auto-authentication via the sharing key
    await this.shareService.wait();
    if (this.shareService.isSharing() && this.shareService.sharingPasswordProtected === false) {
      await this.authenticationService.getSessionUser();
      if (this.authenticationService.isAuthenticated()) {
        return true;
      }
    }

    this.navigationService.toLogin().catch(console.error);
    return false;
  }
}
