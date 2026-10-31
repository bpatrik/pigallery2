import { Injectable, inject } from '@angular/core';
import {UserDTO, UserRoles} from '../../../../common/entities/UserDTO';
import {BehaviorSubject} from 'rxjs';
import {UserService} from './user.service';
import {LoginCredential} from '../../../../common/entities/LoginCredential';
import {Config} from '../../../../common/config/public/Config';
import {NetworkService} from './network.service';
import {ErrorCodes, ErrorDTO} from '../../../../common/entities/Error';
import {CookieNames} from '../../../../common/CookieNames';
import {ShareService} from '../../ui/gallery/share.service';
import {CookieService} from 'ngx-cookie-service';
import {getInjectedUser} from '../server-inject';

@Injectable({providedIn: 'root'})
export class AuthenticationService {
  private userService = inject(UserService);
  private shareService = inject(ShareService);
  private cookieService = inject(CookieService);

  public readonly user: BehaviorSubject<UserDTO>;

  constructor() {
    const networkService = inject(NetworkService);

    this.user = new BehaviorSubject(null);

    // picking up session..
    if (
      this.isAuthenticated() === false &&
      this.cookieService.get(CookieNames.session) != null
    ) {
      const injectedUser = getInjectedUser();
      if (typeof injectedUser !== 'undefined') {
        this.user.next(injectedUser);
      }
      this.getSessionUser().catch(console.error);
    } else {
      if (Config.Users.authenticationRequired === false) {
        this.user.next({
          name: UserRoles[Config.Users.unAuthenticatedUserRole],
          role: Config.Users.unAuthenticatedUserRole,
        } as UserDTO);
      }
    }

    networkService.addGlobalErrorHandler((error: ErrorDTO) => {
      if (error.code === ErrorCodes.NOT_AUTHENTICATED) {
        this.user.next(null);
        return true;
      }
      if (error.code === ErrorCodes.NOT_AUTHORISED) {
        this.logout().catch(console.error);
        return true;
      }
      return false;
    });

    // TODO: refactor architecture remove shareService dependency
    window.setTimeout(() => {
      this.user.subscribe((u) => {
        this.shareService.onNewUser(u);
      });
    }, 0);
  }

  public async login(credential: LoginCredential): Promise<UserDTO> {
    const user = await this.userService.login(credential);
    this.user.next(user);
    return user;
  }

  public async shareLogin(password: string): Promise<UserDTO> {
    const user = await this.userService.shareLogin(password);
    this.user.next(user);
    return user;
  }

  public isAuthenticated(): boolean {
    if (Config.Users.authenticationRequired === false) {
      return true;
    }
    return !!this.user.value;
  }

  public isAuthorized(role: UserRoles): boolean {
    return this.user.value && this.user.value.role >= role;
  }

  public canSearch(): boolean {
    return Config.Search.enabled && this.isAuthorized(UserRoles.Guest);
  }

  public async logout(reason?: ErrorCodes): Promise<void> {
    await this.userService.logout();
    await this.shareService.wait();
    if (this.shareService.isSharing() && reason !== ErrorCodes.NOT_AUTHENTICATED_SHARING) {
      const publicSharing = await this.shareService.getPublicSharing();
      if (publicSharing && !publicSharing.passwordProtected) {
        // There is no login for this sharing (anyone with the link is logged in),
        // so logging out leaves the sharing and goes to the normal login.
        this.shareService.dropSharing();
        this.user.next(null);
        return;
      }
    }
    this.user.next(null);
    // even on logout try to get sharing user if it's a sharing
    if (this.shareService.isSharing() && reason !== ErrorCodes.NOT_AUTHENTICATED_SHARING) {
      await this.getSessionUser();
    }
  }

  private async getSessionUser(): Promise<void> {
    try {
      this.user.next(await this.userService.getSessionUser());
    } catch (error) {
      console.error(error);
    }
  }
}
