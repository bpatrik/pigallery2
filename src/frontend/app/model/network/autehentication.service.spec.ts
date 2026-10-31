import {inject, TestBed} from '@angular/core/testing';
import {UserService} from './user.service';
import {UserDTO} from '../../../../common/entities/UserDTO';
import {LoginCredential} from '../../../../common/entities/LoginCredential';
import {AuthenticationService} from './authentication.service';
import {NetworkService} from './network.service';
import {ErrorDTO} from '../../../../common/entities/Error';
import {VersionService} from '../version.service';
import {ShareService} from '../../ui/gallery/share.service';
import {NavigationService} from '../navigation.service';
import {PublicSharingDTO} from '../../../../common/entities/SharingDTO';

class MockUserService {
  public login(credential: LoginCredential): Promise<UserDTO> {
    return Promise.resolve({name: 'testUserName'} as UserDTO);
  }

  public async getSessionUser(): Promise<UserDTO> {
    return null;
  }

  public async logout(): Promise<string> {
    return 'ok';
  }
}

class MockNetworkService {
  addGlobalErrorHandler(fn: (error: ErrorDTO) => boolean): void {
    // mock fn
  }
}

class MockShareService {
  onNewUser(user: any): void {
    // mock fn
  }

  wait(): Promise<void> {
    return Promise.resolve();
  }

  isSharing(): boolean {
    return false;
  }

  getPublicSharing(): Promise<PublicSharingDTO> {
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

  it('should call UserDTO service login', inject(
      [AuthenticationService, UserService],
      async (authService: AuthenticationService, userService: UserService) => {
        spyOn(userService, 'login').and.callThrough();

        expect(userService.login).not.toHaveBeenCalled();
        await authService.login(null);
        expect(userService.login).toHaveBeenCalled();
      }
  ));

  it('should have NO Authenticated use', inject(
      [AuthenticationService],
      (authService: AuthenticationService) => {
        expect(authService.user.value).toBe(null);
        expect(authService.isAuthenticated()).toBe(false);
      }
  ));

  it('should have Authenticated use', (done) =>
      inject([AuthenticationService], (authService: AuthenticationService) => {
        spyOn(authService.user, 'next').and.callThrough();
        authService.user.subscribe((user) => {
          if (user == null) {
            return;
          }
          expect(authService.user.next).toHaveBeenCalled();
          expect(authService.user.value).not.toBe(null);
          expect(authService.isAuthenticated()).toBe(true);
          done();
        });
        authService.login({} as any);
      })());

  describe('logout', () => {
    const setUpLogout = async (authService: AuthenticationService, userService: UserService, shareService: ShareService,
                         sharing: PublicSharingDTO) => {
      // let the session pickup of the service constructor finish first
      await new Promise(resolve => setTimeout(resolve, 0));
      authService.user.next({name: 'logged in'} as UserDTO);
      const users: UserDTO[] = [];
      authService.user.subscribe(u => users.push(u));
      spyOn(userService, 'logout').and.callThrough();
      spyOn(userService, 'getSessionUser').and.returnValue(Promise.resolve({name: 'Guest'} as UserDTO));
      spyOn(shareService, 'isSharing').and.returnValue(!!sharing);
      spyOn(shareService, 'getPublicSharing').and.returnValue(Promise.resolve(sharing));
      return users;
    };

    it('should log out the user', inject(
      [AuthenticationService, UserService, ShareService],
      async (authService: AuthenticationService, userService: UserService, shareService: ShareService) => {
        const users = await setUpLogout(authService, userService, shareService, null);
        await authService.logout();
        expect(userService.logout).toHaveBeenCalled();
        expect(userService.getSessionUser).not.toHaveBeenCalled();
        expect(authService.user.value).toBe(null);
        expect(users[users.length - 1]).toBe(null);
      }
    ));

    it('should log out from password protected sharing', inject(
      [AuthenticationService, UserService, ShareService],
      async (authService: AuthenticationService, userService: UserService, shareService: ShareService) => {
        const users = await setUpLogout(authService, userService, shareService, {sharingKey: 'key', passwordProtected: true});
        (userService.getSessionUser as jasmine.Spy).and.returnValue(Promise.reject('not authenticated'));
        spyOn(console, 'error');
        await authService.logout();
        expect(userService.logout).toHaveBeenCalled();
        expect(users).toContain(null);
        expect(authService.user.value).toBe(null);
        expect(console.error).toHaveBeenCalledWith('not authenticated');
      }
    ));

    it('should drop the sharing without password on logout', inject(
      [AuthenticationService, UserService, ShareService],
      async (authService: AuthenticationService, userService: UserService, shareService: ShareService) => {
        await setUpLogout(authService, userService, shareService, {sharingKey: 'key', passwordProtected: false});
        spyOn(shareService, 'dropSharing').and.callThrough();
        await authService.logout();
        expect(userService.logout).toHaveBeenCalled();
        expect(shareService.dropSharing).toHaveBeenCalled();
        // it would log in again with the sharing key
        expect(userService.getSessionUser).not.toHaveBeenCalled();
        expect(authService.user.value).toBe(null);
      }
    ));

    it('should not drop password protected sharing on logout', inject(
      [AuthenticationService, UserService, ShareService],
      async (authService: AuthenticationService, userService: UserService, shareService: ShareService) => {
        await setUpLogout(authService, userService, shareService, {sharingKey: 'key', passwordProtected: true});
        (userService.getSessionUser as jasmine.Spy).and.returnValue(Promise.reject('not authenticated'));
        spyOn(shareService, 'dropSharing').and.callThrough();
        spyOn(console, 'error');
        await authService.logout();
        expect(shareService.dropSharing).not.toHaveBeenCalled();
        expect(console.error).toHaveBeenCalledWith('not authenticated');
      }
    ));
  });
});
