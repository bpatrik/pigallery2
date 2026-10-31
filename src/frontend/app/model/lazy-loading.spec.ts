import {TestBed} from '@angular/core/testing';
import {NavigationError, Route} from '@angular/router';
import {of} from 'rxjs';
import {
  isChunkLoadError,
  PageLoader,
  PreloadMarkedRoutes,
  ReloadAfterUpgradeComponent,
  reloadAfterUpgrade,
  reloadOnChunkLoadError
} from './lazy-loading';
import {Config} from '../../../common/config/public/Config';
import {AuthenticationService} from './network/authentication.service';
import {UserRoles} from '../../../common/entities/UserDTO';

describe('PreloadMarkedRoutes', () => {

  // role: null if not logged in
  const setUp = (role: UserRoles): PreloadMarkedRoutes => {
    TestBed.configureTestingModule({
      providers: [
        {provide: AuthenticationService, useValue: {isAuthorized: (r: UserRoles) => role !== null && role >= r}},
      ]
    });
    return TestBed.inject(PreloadMarkedRoutes);
  };

  const preloads = (strategy: PreloadMarkedRoutes, route: Route): boolean => {
    const load = jasmine.createSpy('load').and.returnValue(of(true));
    strategy.preload(route, load).subscribe();
    return load.calls.any();
  };

  it('should preload the marked routes of a guest or higher user', () => {
    expect(preloads(setUp(UserRoles.Guest), {path: 'albums', data: {preload: true}})).toBeTrue();
  });

  it('should not preload the routes that are not marked', () => {
    expect(preloads(setUp(UserRoles.Admin), {path: 'admin'})).toBeFalse();
  });

  it('should not preload before the login', () => {
    expect(preloads(setUp(null), {path: 'albums', data: {preload: true}})).toBeFalse();
  });

  it('should not preload for sharing users', () => {
    expect(preloads(setUp(UserRoles.LimitedGuest), {path: 'albums', data: {preload: true}})).toBeFalse();
  });
});

describe('reloadAfterUpgrade', () => {

  beforeEach(() => {
    sessionStorage.removeItem('pigallery2-chunk-reload');
    spyOn(PageLoader, 'assign');
  });

  afterEach(() => {
    sessionStorage.removeItem('pigallery2-chunk-reload');
  });

  it('should reload a lazy route that failed to load', () => {
    reloadOnChunkLoadError(new NavigationError(1, '/albums', new TypeError('Failed to fetch dynamically imported module: x')));
    expect(PageLoader.assign).toHaveBeenCalledOnceWith(Config.Server.getAppUrl('/albums'));
  });

  it('should not reload for other navigation errors', () => {
    reloadOnChunkLoadError(new NavigationError(1, '/albums', new Error('Cannot match any routes')));
    expect(PageLoader.assign).not.toHaveBeenCalled();
  });

  it('should reload only once in a while', () => {
    reloadAfterUpgrade('/a');
    reloadAfterUpgrade('/b');
    expect(PageLoader.assign).toHaveBeenCalledOnceWith('/a');
  });

  it('should reload the page from the @error block of a @defer', () => {
    TestBed.createComponent(ReloadAfterUpgradeComponent).detectChanges();
    expect(PageLoader.assign).toHaveBeenCalledOnceWith(location.href);
  });
});

describe('isChunkLoadError', () => {

  it('should recognize a failed dynamic import', () => {
    // Chrome, Firefox and Safari
    expect(isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: http://x/hu.chunk-ABC.js'))).toBeTrue();
    expect(isChunkLoadError(new TypeError('error loading dynamically imported module: http://x/hu.chunk-ABC.js'))).toBeTrue();
    expect(isChunkLoadError(new TypeError('Importing a module script failed.'))).toBeTrue();
  });

  it('should ignore other navigation errors', () => {
    expect(isChunkLoadError(new Error('Cannot match any routes'))).toBeFalse();
    expect(isChunkLoadError(null)).toBeFalse();
  });
});
