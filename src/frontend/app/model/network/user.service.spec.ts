import {inject, TestBed} from '@angular/core/testing';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import {NetworkService} from './network.service';
import {UserService} from './user.service';
import {LoginCredential} from '../../../../common/entities/LoginCredential';
import {LoadingBarService} from '@ngx-loading-bar/core';
import {ShareService} from '../../ui/gallery/share.service';
import {VersionService} from '../version.service';
import {provideHttpClient} from '@angular/common/http';

class MockShareService {
  wait(): Promise<boolean> {
    return Promise.resolve(true);
  }

  isSharing(): boolean {
    return false;
  }
}

describe('UserService', (): void => {
  beforeEach((): void => {
    TestBed.configureTestingModule({
    imports: [],
    providers: [
        VersionService,
        UserService,
        LoadingBarService,
        NetworkService,
        { provide: ShareService, useClass: MockShareService },
        provideHttpClient(),
        provideHttpClientTesting(),
    ]
});
  });

  it('should call postJson at login', inject(
      [UserService, NetworkService],
      async (
          userService: UserService,
          networkService: NetworkService
      ): Promise<void> => {
        vi.spyOn(networkService, 'postJson').mockImplementation(() => undefined);
        const credential = new LoginCredential('name', 'pass');
        await userService.login(credential);
        expect(networkService.postJson).toHaveBeenCalled();
        expect((networkService.postJson as any).mock.calls[0]).toEqual([
          '/user/login',
          {loginCredential: credential},
        ]);
      }
  ));

  it('should call getJson at getSessionUser', inject(
      [UserService, NetworkService],
      async (
          userService: UserService,
          networkService: NetworkService
      ): Promise<void> => {
        vi.spyOn(networkService, 'getJson').mockImplementation(() => undefined);
        await userService.getSessionUser();
        expect(networkService.getJson).toHaveBeenCalled();
        expect((networkService.getJson as any).mock.calls[0]).toEqual([
          '/user/me',
        ]);
      }
  ));
});

