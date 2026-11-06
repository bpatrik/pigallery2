import {TestBed} from '@angular/core/testing';
import {signal} from '@angular/core';
import {GalleryCacheService} from './cache.gallery.service';
import {VersionService} from '../../model/version.service';
import {AuthenticationService} from '../../model/network/authentication.service';
import {UserDTO, UserRoles} from '../../../../common/entities/UserDTO';
import {PackedContentWrapperWithError} from '../../../../common/entities/ContentWrapper';

describe('GalleryCacheService', () => {

  const setUp = () => {
    const versionService = {version: signal<string | null>(null)};
    const authService = {user: signal<UserDTO | null>(null)};
    // a fresh injector per setUp, like a page reload
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        {provide: VersionService, useValue: versionService},
        {provide: AuthenticationService, useValue: authService},
      ]
    });
    const service = TestBed.inject(GalleryCacheService);
    return {service, authService};
  };

  const cacheDir = (service: GalleryCacheService) =>
    service.setDirectory({directory: {name: 'dir', path: './', lastModified: 1, lastScanned: 1}} as PackedContentWrapperWithError);

  const admin = {id: 1, name: 'admin', role: UserRoles.Admin} as UserDTO;

  beforeEach(() => {
    localStorage.clear();
  });

  it('should keep the cached content for the same user', () => {
    const {service, authService} = setUp();
    authService.user.set(admin);
    TestBed.tick();
    cacheDir(service);
    authService.user.set(null); // logged out
    TestBed.tick();
    authService.user.set({...admin});
    TestBed.tick();
    expect(service.getDirectory('dir')!.directory).toBeDefined();
  });

  it('should drop the cached content when the user changes', () => {
    const {service, authService} = setUp();
    authService.user.set(admin);
    TestBed.tick();
    cacheDir(service);
    authService.user.set(null); // logged out
    TestBed.tick();
    authService.user.set({id: 0, name: 'Guest', role: UserRoles.LimitedGuest, usedSharingKey: 'key'} as UserDTO);
    TestBed.tick();
    expect(service.getDirectory('dir')!.directory).toBeUndefined();
  });

  it('should drop the cached content when the projection of the user changes', () => {
    const {service, authService} = setUp();
    authService.user.set(admin);
    TestBed.tick();
    cacheDir(service);
    authService.user.set({...admin, projectionKey: 'other'});
    TestBed.tick();
    expect(service.getDirectory('dir')!.directory).toBeUndefined();
  });

  it('should drop the cached content of an other user after reload', () => {
    const first = setUp();
    first.authService.user.set(admin);
    TestBed.tick();
    cacheDir(first.service);

    const second = setUp();
    second.authService.user.set({id: 2, name: 'user', role: UserRoles.User} as UserDTO);
    TestBed.tick();
    expect(second.service.getDirectory('dir')!.directory).toBeUndefined();
  });
});
