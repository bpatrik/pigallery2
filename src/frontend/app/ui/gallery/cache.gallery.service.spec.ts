import {BehaviorSubject} from 'rxjs';
import {GalleryCacheService} from './cache.gallery.service';
import {UserDTO, UserRoles} from '../../../../common/entities/UserDTO';
import {PackedContentWrapperWithError} from '../../../../common/entities/ContentWrapper';

describe('GalleryCacheService', () => {

  const setUp = () => {
    const versionService = {version: new BehaviorSubject<string>(null)};
    const authService = {user: new BehaviorSubject<UserDTO>(null)};
    const service = new GalleryCacheService(versionService as any, authService as any);
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
    authService.user.next(admin);
    cacheDir(service);
    authService.user.next(null); // logged out
    authService.user.next({...admin});
    expect(service.getDirectory('dir').directory).toBeDefined();
  });

  it('should drop the cached content when the user changes', () => {
    const {service, authService} = setUp();
    authService.user.next(admin);
    cacheDir(service);
    authService.user.next(null); // logged out
    authService.user.next({id: 0, name: 'Guest', role: UserRoles.LimitedGuest, usedSharingKey: 'key'} as UserDTO);
    expect(service.getDirectory('dir').directory).toBeUndefined();
  });

  it('should drop the cached content when the projection of the user changes', () => {
    const {service, authService} = setUp();
    authService.user.next(admin);
    cacheDir(service);
    authService.user.next({...admin, projectionKey: 'other'});
    expect(service.getDirectory('dir').directory).toBeUndefined();
  });

  it('should drop the cached content of an other user after reload', () => {
    const first = setUp();
    first.authService.user.next(admin);
    cacheDir(first.service);

    const second = setUp();
    second.authService.user.next({id: 2, name: 'user', role: UserRoles.User} as UserDTO);
    expect(second.service.getDirectory('dir').directory).toBeUndefined();
  });
});
