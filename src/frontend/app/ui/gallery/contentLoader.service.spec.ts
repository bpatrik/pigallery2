import {TestBed} from '@angular/core/testing';
import {Router} from '@angular/router';
import {signal} from '@angular/core';
import {toObservable} from '@angular/core/rxjs-interop';
import {filter} from 'rxjs/operators';
import {ContentLoaderService} from './contentLoader.service';
import {NetworkService} from '../../model/network/network.service';
import {GalleryCacheService} from './cache.gallery.service';
import {ShareService} from './share.service';
import {GalleryService} from './gallery.service';
import {ErrorCodes} from '../../../../common/entities/Error';
import {ResponseSharingDTO} from '../../../../common/entities/SharingDTO';
import {QueryParams} from '../../../../common/QueryParams';

class MockNetworkService {
  getJson = vi.fn().mockRejectedValue({code: ErrorCodes.DIRECTORY_NOT_FOUND});
}

class MockShareService {
  readonly sharing = signal<ResponseSharingDTO | null>(null);
  currentSharing = toObservable(this.sharing).pipe(filter((s) => s !== null));

  isSharing(): boolean {
    return true;
  }

  getSharingKey(): string {
    return 'key123';
  }

  getDefaultRoute(sharing: ResponseSharingDTO | null): string[] | null {
    return sharing?.directoryQuery ? ['/gallery', sharing.directoryQuery.value] : null;
  }
}

describe('ContentLoaderService', () => {
  let service: ContentLoaderService;
  let share: MockShareService;
  let router: {navigate: ReturnType<typeof vi.fn>};
  const sharing = {sharingKey: 'key123', directoryQuery: {value: 'Balaton nyár'}} as ResponseSharingDTO;

  beforeEach(() => {
    router = {navigate: vi.fn().mockResolvedValue(true)};
    TestBed.configureTestingModule({
      providers: [
        ContentLoaderService,
        {provide: NetworkService, useClass: MockNetworkService},
        {provide: GalleryCacheService, useValue: {getDirectory: (): null => null}},
        {provide: ShareService, useClass: MockShareService},
        {provide: GalleryService, useValue: {autoPollIntervalS: signal(0)}},
        {provide: Router, useValue: router},
      ]
    });
    service = TestBed.inject(ContentLoaderService);
    share = TestBed.inject(ShareService) as unknown as MockShareService;
  });

  it('should open the shared directory when a not shared one is not found', async () => {
    share.sharing.set(sharing);
    TestBed.tick();

    await service.loadDirectory('timestamps');

    expect(router.navigate).toHaveBeenCalledWith(['/gallery', 'Balaton nyár'],
      {queryParams: {[QueryParams.gallery.sharingKey_query]: 'key123'}});
  });

  it('should wait for the sharing if the not found answer arrives first', async () => {
    const loading = service.loadDirectory('timestamps');
    await Promise.resolve();
    expect(router.navigate).not.toHaveBeenCalled();

    share.sharing.set(sharing);
    TestBed.tick();
    await loading;

    expect(router.navigate).toHaveBeenCalledWith(['/gallery', 'Balaton nyár'],
      {queryParams: {[QueryParams.gallery.sharingKey_query]: 'key123'}});
  });
});
