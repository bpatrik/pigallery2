import {inject, TestBed} from '@angular/core/testing';
import {HttpClientTestingModule} from '@angular/common/http/testing';
import {NetworkService} from './network.service';
import {UserService} from './user.service';
import {LoginCredential} from '../../../../common/entities/LoginCredential';
import {LoadingBarService} from '@ngx-loading-bar/core';
import {ShareService} from '../../ui/gallery/share.service';
import {VersionService} from '../version.service';

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
      imports: [HttpClientTestingModule],
      providers: [
        VersionService,
        UserService,
        LoadingBarService,
        NetworkService,
        {provide: ShareService, useClass: MockShareService},
      ],
    });
  });

  it('should call postJson at login', inject(
      [UserService, NetworkService],
      async (
          userService: UserService,
          networkService: NetworkService
      ): Promise<void> => {
        spyOn(networkService, 'postJson');
        const credential = new LoginCredential('name', 'pass');
        await userService.login(credential);
        expect(networkService.postJson).toHaveBeenCalled();
        expect((networkService.postJson as any).calls.argsFor(0)).toEqual([
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
        spyOn(networkService, 'getJson');
        await userService.getSessionUser();
        expect(networkService.getJson).toHaveBeenCalled();
        expect((networkService.getJson as any).calls.argsFor(0)).toEqual([
          '/user/me',
        ]);
      }
  ));
});

