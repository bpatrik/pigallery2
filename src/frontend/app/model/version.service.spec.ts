import {TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
import {VersionService} from './version.service';

describe('VersionService', () => {

  const setUp = (): VersionService => {
    TestBed.configureTestingModule({
      providers: [provideRouter([])]
    });
    return TestBed.inject(VersionService);
  };

  const cachedContent = 'CONTENT:dir';

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should keep the cache when the version is the stored one', () => {
    localStorage.setItem('VERSION', 'v1');
    localStorage.setItem(cachedContent, '{}');
    const service = setUp();

    service.onNewVersion('v1');

    expect(service.version()).toBe('v1');
    expect(localStorage.getItem(cachedContent)).toBe('{}');
  });

  it('should clear the cache synchronously when the version changes', () => {
    localStorage.setItem('VERSION', 'v1');
    localStorage.setItem(cachedContent, '{}');
    const service = setUp();

    service.onNewVersion('v2');

    expect(service.version()).toBe('v2');
    expect(localStorage.getItem(cachedContent)).toBeNull();
    expect(localStorage.getItem('VERSION')).toBe('v2');
  });
});
