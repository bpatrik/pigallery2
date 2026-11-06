import type {Mock} from 'vitest';
import {signal} from '@angular/core';
import {inject, TestBed} from '@angular/core/testing';
import {UserService} from './user.service';
import {UserDTO} from '../../../../common/entities/UserDTO';
import {LoginCredential} from '../../../../common/entities/LoginCredential';
import {AuthenticationService} from './authentication.service';
import {NetworkService} from './network.service';
import {VersionService} from '../version.service';
import {ShareService} from '../../ui/gallery/share.service';
import {NavigationService} from '../navigation.service';
import {PublicSharingDTO} from '../../../../common/entities/SharingDTO';
import {Config} from '../../../../common/config/public/Config';

class MockUserService {
  public login(): Promise<UserDTO> {
    return Promise.resolve({name: 'testUserName'} as UserDTO);
  }

  public async getSessionUser(): Promise<UserDTO | null> {
    return null;
  }

  public async logout(): Promise<string> {
    return 'ok';
  }
}

class MockNetworkService {
  addGlobalErrorHandler(): void {
    // mock fn
  }
}

class MockShareService {
  readonly routeRecognized = signal(true);

  onNewUser(): Promise<void> {
    return Promise.resolve();
  }

  wait(): Promise<void> {
    return Promise.resolve();
  }

  isSharing(): boolean {
    return false;
  }

  getPublicSharing(): Promise<PublicSharingDTO | null> {
    return Promise.resolve(null);
  }

  dropSharing(): void {
    // mock fn
  }
}

class MockNavigationService {
  toError(): Promise<boolean> {
    return Promise.resolve(true);
  }
}

describe('AuthenticationService', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        VersionService,
        {provide: NetworkService, useClass: MockNetworkService},
        {provide: UserService, useClass: MockUserService},
        {provide: ShareService, useClass: MockShareService},
        {provide: NavigationService, useClass: MockNavigationService},
        AuthenticationService,
      ],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should call UserDTO service login', inject(
      [AuthenticationService, UserService],
      async (authService: AuthenticationService, userService: UserService) => {
        vi.spyOn(userService, 'login');

        expect(userService.login).not.toHaveBeenCalled();
        await authService.login({} as LoginCredential);
        expect(userService.login).toHaveBeenCalled();
      }
  ));

  it('should have NO Authenticated use', inject(
      [AuthenticationService],
      (authService: AuthenticationService) => {
        expect(authService.user()).toBe(null);
        expect(authService.isAuthenticated()).toBe(false);
      }
  ));

  it('should have Authenticated use', inject(
      [AuthenticationService],
      async (authService: AuthenticationService) => {
        await authService.login({} as any);
        expect(authService.user()).not.toBe(null);
        expect(authService.isAuthenticated()).toBe(true);
      }
  ));

  describe('sharing of the user', () => {
    const authenticationRequired = Config.Users.authenticationRequired;

    afterEach(() => {
      Config.Users.authenticationRequired = authenticationRequired;
    });

    it('should wait for the sharing key of the route', async () => {
      const shareService = TestBed.inject(ShareService) as unknown as MockShareService;
      shareService.routeRecognized.set(false);
      vi.spyOn(shareService, 'onNewUser');
      const authService = TestBed.inject(AuthenticationService);

      await authService.login({} as LoginCredential);
      TestBed.tick();
      // the user's own sharing key would override the one in the url
      expect(shareService.onNewUser).not.toHaveBeenCalled();

      shareService.routeRecognized.set(true);
      TestBed.tick();
      expect(shareService.onNewUser).toHaveBeenCalledWith({name: 'testUserName'});
    });

    it('should not load the sharing while the service is created', () => {
      // the user is set in the constructor
      Config.Users.authenticationRequired = false;
      const shareService = TestBed.inject(ShareService) as unknown as MockShareService;
      // loading the sharing goes through the error interceptor, which injects the AuthenticationService
      vi.spyOn(shareService, 'onNewUser').mockImplementation(() => {
        TestBed.inject(AuthenticationService);
        return Promise.resolve();
      });

      const authService = TestBed.inject(AuthenticationService);
      expect(shareService.onNewUser).not.toHaveBeenCalled();

      TestBed.tick();
      expect(shareService.onNewUser).toHaveBeenCalledWith(authService.user());
    });
  });

  describe('logout', () => {
    const setUpLogout = async (authService: AuthenticationService, userService: UserService, shareService: ShareService,
                         sharing: PublicSharingDTO | null) => {
      // let the session pickup of the service constructor finish first
      await new Promise(resolve => setTimeout(resolve, 0));
      await authService.login({} as LoginCredential);
      vi.spyOn(userService, 'logout');
      vi.spyOn(userService, 'getSessionUser').mockReturnValue(Promise.resolve({name: 'Guest'} as UserDTO));
      vi.spyOn(shareService, 'isSharing').mockReturnValue(!!sharing);
      vi.spyOn(shareService, 'getPublicSharing').mockReturnValue(Promise.resolve(sharing));
    };

    it('should log out the user', inject(
      [AuthenticationService, UserService, ShareService],
      async (authService: AuthenticationService, userService: UserService, shareService: ShareService) => {
        await setUpLogout(authService, userService, shareService, null);
        await authService.logout();
        expect(userService.logout).toHaveBeenCalled();
        expect(userService.getSessionUser).not.toHaveBeenCalled();
        expect(authService.user()).toBe(null);
      }
    ));

    it('should log out from password protected sharing', inject(
      [AuthenticationService, UserService, ShareService],
      async (authService: AuthenticationService, userService: UserService, shareService: ShareService) => {
        await setUpLogout(authService, userService, shareService, {sharingKey: 'key', passwordProtected: true});
        (userService.getSessionUser as Mock).mockReturnValue(Promise.reject('not authenticated'));
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        await authService.logout();
        expect(userService.logout).toHaveBeenCalled();
        expect(authService.user()).toBe(null);
        expect(console.error).toHaveBeenCalledWith('not authenticated');
      }
    ));

    it('should drop the sharing without password on logout', inject(
      [AuthenticationService, UserService, ShareService],
      async (authService: AuthenticationService, userService: UserService, shareService: ShareService) => {
        await setUpLogout(authService, userService, shareService, {sharingKey: 'key', passwordProtected: false});
        vi.spyOn(shareService, 'dropSharing');
        await authService.logout();
        expect(userService.logout).toHaveBeenCalled();
        expect(shareService.dropSharing).toHaveBeenCalled();
        // it would log in again with the sharing key
        expect(userService.getSessionUser).not.toHaveBeenCalled();
        expect(authService.user()).toBe(null);
      }
    ));

    it('should not drop password protected sharing on logout', inject(
      [AuthenticationService, UserService, ShareService],
      async (authService: AuthenticationService, userService: UserService, shareService: ShareService) => {
        await setUpLogout(authService, userService, shareService, {sharingKey: 'key', passwordProtected: true});
        (userService.getSessionUser as Mock).mockReturnValue(Promise.reject('not authenticated'));
        vi.spyOn(shareService, 'dropSharing');
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        await authService.logout();
        expect(shareService.dropSharing).not.toHaveBeenCalled();
        expect(console.error).toHaveBeenCalledWith('not authenticated');
      }
    ));
  });
});
