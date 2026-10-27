import {TestBed} from '@angular/core/testing';
import {Location} from '@angular/common';
import {SpyLocation} from '@angular/common/testing';
import {NavigationEnd, provideRouter, Router} from '@angular/router';
import {GalleryBackService} from './gallery-back.service';

describe('GalleryBackService', () => {
  let service: GalleryBackService;
  let location: SpyLocation;
  let router: Router;
  let id = 0;

  // as the router leaves the history after a navigation, then the service
  const navigate = (url: string, how: 'push' | 'replace' | 'popstate' = 'push', state: unknown = {}): void => {
    if (how === 'push') {
      location.go(url, '', state);
    } else if (how === 'replace') {
      location.replaceState(url, '', state);
    }
    Object.defineProperty(router, 'lastSuccessfulNavigation', {
      configurable: true,
      value: {trigger: how === 'popstate' ? 'popstate' : 'imperative', extras: {replaceUrl: how === 'replace'}},
    });
    (service as any).onNavigationEnd(new NavigationEnd(++id, url, url));
  };
  // the history as a list of urls, oldest first, up to the current entry
  const history = (): string[] => {
    const h = (location as any)._history as { path: string }[];
    return h.slice(0, (location as any)._historyIndex + 1).map((e) => e.path);
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), {provide: Location, useClass: SpyLocation}],
    });
    service = TestBed.inject(GalleryBackService);
    location = TestBed.inject(Location) as SpyLocation;
    router = TestBed.inject(Router);
  });

  it('should find the folder of a gallery url and its parent', () => {
    expect(GalleryBackService.directoryOf(router.parseUrl('/gallery/2015%2F01%2Fx?p=a.jpg'))).toBe('2015/01/x');
    expect(GalleryBackService.directoryOf(router.parseUrl('/gallery'))).toBe('');
    expect(GalleryBackService.directoryOf(router.parseUrl('/timeline'))).toBeNull();
    expect(GalleryBackService.parentOf('2015/01/x')).toBe('2015/01');
    expect(GalleryBackService.parentOf('2015')).toBe('');
  });

  it('should leave the history alone when going down from the parent', () => {
    navigate('/gallery/2015');
    navigate('/gallery/2015%2F01');
    expect(history().slice(-2)).toEqual(['/gallery/2015', '/gallery/2015%2F01']);
  });

  it('should put the parent before a folder reached from elsewhere', () => {
    navigate('/timeline');
    navigate('/gallery/2015%2F01');
    expect(history().slice(-3)).toEqual(['/timeline', '/gallery/2015', '/gallery/2015%2F01']);
  });

  it('should put the folder before a photo opened from a link', () => {
    navigate('/gallery/2015%2F01?p=a.jpg');
    expect(history().slice(-2)).toEqual(['/gallery/2015%2F01', '/gallery/2015%2F01?p=a.jpg']);
    expect(service.photoOverDir()).toBeTrue();
  });

  it('should know a photo opened from its folder, also after next/previous', () => {
    navigate('/gallery/2015');
    navigate('/gallery/2015?p=a.jpg');
    expect(service.photoOverDir()).toBeTrue();
    navigate('/gallery/2015?p=b.jpg', 'replace');
    expect(service.photoOverDir()).toBeTrue();
    expect(history().slice(-2)).toEqual(['/gallery/2015', '/gallery/2015?p=b.jpg']);
  });

  it('should go on up when back reaches an entry it put there', () => {
    navigate('/timeline');
    navigate('/gallery/2015%2F01%2Fx');
    location.back();
    navigate('/gallery/2015%2F01', 'popstate');
    expect(history().slice(-3)).toEqual(['/timeline', '/gallery/2015', '/gallery/2015%2F01']);
  });
});
