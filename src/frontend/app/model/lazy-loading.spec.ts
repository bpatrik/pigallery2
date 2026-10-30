import {TestBed} from '@angular/core/testing';
import {Route} from '@angular/router';
import {of} from 'rxjs';
import {isChunkLoadError, PreloadMarkedRoutes} from './lazy-loading';
import {AuthenticationService} from './network/authentication.service';

describe('PreloadMarkedRoutes', () => {

  const setUp = (authenticated: boolean): PreloadMarkedRoutes => {
    TestBed.configureTestingModule({
      providers: [
        {provide: AuthenticationService, useValue: {isAuthenticated: () => authenticated}},
      ]
    });
    return TestBed.inject(PreloadMarkedRoutes);
  };

  const preloads = (strategy: PreloadMarkedRoutes, route: Route): boolean => {
    const load = jasmine.createSpy('load').and.returnValue(of(true));
    strategy.preload(route, load).subscribe();
    return load.calls.any();
  };

  it('should preload the marked routes of a logged in user', () => {
    expect(preloads(setUp(true), {path: 'albums', data: {preload: true}})).toBeTrue();
  });

  it('should not preload the routes that are not marked', () => {
    expect(preloads(setUp(true), {path: 'admin'})).toBeFalse();
  });

  it('should not preload before the login', () => {
    expect(preloads(setUp(false), {path: 'albums', data: {preload: true}})).toBeFalse();
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
