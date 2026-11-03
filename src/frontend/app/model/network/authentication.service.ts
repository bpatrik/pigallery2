import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import {UserDTO, UserRoles} from '../../../../common/entities/UserDTO';
import {UserService} from './user.service';
import {LoginCredential} from '../../../../common/entities/LoginCredential';
import {Config} from '../../../../common/config/public/Config';
import {NetworkService} from './network.service';
import {ErrorCodes, ErrorDTO} from '../../../../common/entities/Error';
import {ShareService} from '../../ui/gallery/share.service';
import {getInjectedUser} from '../server-inject';

@Injectable({providedIn: 'root'})
export class AuthenticationService {
  private userService = inject(UserService);
  private shareService = inject(ShareService);

  private readonly currentUser = signal<UserDTO | null>(null);
  public readonly user = this.currentUser.asReadonly();
  public readonly isAuthenticated = computed((): boolean =>
    Config.Users.authenticationRequired === false || !!this.user()
  );
  public readonly isAdmin = computed((): boolean => this.isAuthorized(UserRoles.Admin));

  constructor() {
    const networkService = inject(NetworkService);

    // Picking up the session. Its cookie is httpOnly, so JS can't check if it exists: always ask the server.
    if (this.isAuthenticated() === false) {
      const injectedUser = getInjectedUser();
      if (typeof injectedUser !== 'undefined') {
        this.currentUser.set(injectedUser);
      }
      this.getSessionUser().catch(console.error);
    } else {
      if (Config.Users.authenticationRequired === false) {
        this.currentUser.set({
          name: UserRoles[Config.Users.unAuthenticatedUserRole],
          role: Config.Users.unAuthenticatedUserRole,
        } as UserDTO);
      }
    }

    networkService.addGlobalErrorHandler((error: ErrorDTO) => {
      if (error.code === ErrorCodes.NOT_AUTHENTICATED) {
        this.currentUser.set(null);
        return true;
      }
      if (error.code === ErrorCodes.NOT_AUTHORISED) {
        this.logout().catch(console.error);
        return true;
      }
      return false;
    });

    // The sharing of a sharing user (or the one a logged-in user opened) depends on the user.
    // It waits for the sharing key of the route, as the user's own key overrides it.
    // An effect also runs after this constructor: loading the sharing calls the error interceptor, which injects this service.
    effect(() => {
      if (!this.shareService.routeRecognized()) {
        return;
      }
      const user = this.user();
      untracked(() => this.shareService.onNewUser(user).catch(console.error));
    });
  }

  public async login(credential: LoginCredential): Promise<UserDTO> {
    const user = await this.userService.login(credential);
    this.currentUser.set(user);
    return user;
  }

  public async shareLogin(password: string): Promise<UserDTO> {
    const user = await this.userService.shareLogin(password);
    this.currentUser.set(user);
    return user;
  }

  public isAuthorized(role: UserRoles): boolean {
    const user = this.user();
    return !!user && user.role >= role;
  }

  public readonly canSearch = computed((): boolean => Config.Search.enabled && this.isAuthorized(UserRoles.Guest));

  public async logout(reason?: ErrorCodes): Promise<void> {
    await this.userService.logout();
    await this.shareService.wait();
    if (this.shareService.isSharing() && reason !== ErrorCodes.NOT_AUTHENTICATED_SHARING) {
      const publicSharing = await this.shareService.getPublicSharing();
      if (publicSharing && !publicSharing.passwordProtected) {
        // There is no login for this sharing (anyone with the link is logged in),
        // so logging out leaves the sharing and goes to the normal login.
        this.shareService.dropSharing();
        this.currentUser.set(null);
        return;
      }
    }
    this.currentUser.set(null);
    // even on logout try to get sharing user if it's a sharing
    if (this.shareService.isSharing() && reason !== ErrorCodes.NOT_AUTHENTICATED_SHARING) {
      await this.getSessionUser();
    }
  }

  private async getSessionUser(): Promise<void> {
    try {
      this.currentUser.set(await this.userService.getSessionUser());
    } catch (error) {
      console.error(error);
    }
  }
}
