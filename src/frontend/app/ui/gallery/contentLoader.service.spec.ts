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
import {ToastService} from '../toast/toast.service';

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
  let toast: {open: ReturnType<typeof vi.fn>};
  const sharing = {sharingKey: 'key123', directoryQuery: {value: 'Balaton nyár'}} as ResponseSharingDTO;

  beforeEach(() => {
    router = {navigate: vi.fn().mockResolvedValue(true)};
    toast = {open: vi.fn()};
    TestBed.configureTestingModule({
      providers: [
        ContentLoaderService,
        {provide: NetworkService, useClass: MockNetworkService},
        {provide: GalleryCacheService, useValue: {getDirectory: (): null => null, setDirectory: (): void => undefined}},
        {provide: ShareService, useClass: MockShareService},
        {provide: GalleryService, useValue: {autoPollIntervalS: signal(0)}},
        {provide: Router, useValue: router},
        {provide: ToastService, useValue: toast},
      ]
    });
    service = TestBed.inject(ContentLoaderService);
    share = TestBed.inject(ShareService) as unknown as MockShareService;
  });

  afterEach(() => {
    vi.restoreAllMocks();
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
  // #1308: the user is told why the gallery shows another folder
  it('should tell with a warning toast that the folder was not found', async () => {
    share.sharing.set(sharing);
    TestBed.tick();

    await service.loadDirectory('Árvíztűrő tükörfúrógép');

    expect(toast.open).toHaveBeenCalledWith(expect.objectContaining({
      type: 'warning', text: 'Folder "Árvíztűrő tükörfúrógép" not found. Showing Home.'
    }));
  });

  // #1305: never an endless spinner
  it('should show an error that can be retried when the folder load fails', async () => {
    const network = TestBed.inject(NetworkService) as unknown as MockNetworkService;
    network.getJson.mockRejectedValueOnce(new Error('Failed to fetch'));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await service.loadDirectory('timestamps');

    expect(service.content().error).toContain('Failed to fetch');
    expect(service.canRetry()).toBe(true);
    expect(router.navigate).not.toHaveBeenCalled();

    network.getJson.mockResolvedValueOnce({directory: {name: 'timestamps', path: './', media: [], directories: []}});
    await service.reloadCurrentContent();
    expect(service.content().error).toBeUndefined();
    expect(service.content().directory?.name).toBe('timestamps');
  });

  // e.g. the polling of a photo frame while the server is unreachable: keep showing the photos, retry quietly
  it('should keep the shown folder when reloading it fails', async () => {
    const network = TestBed.inject(NetworkService) as unknown as MockNetworkService;
    network.getJson.mockResolvedValueOnce({directory: {name: 'timestamps', path: './', media: [], directories: []}});
    await service.loadDirectory('timestamps');
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    network.getJson.mockRejectedValueOnce(new Error('Failed to fetch'));

    await service.reloadCurrentContent();

    expect(service.content().error).toBeUndefined();
    expect(service.content().directory?.name).toBe('timestamps');
  });

  // #1309: loading it again would not help
  it('should not offer a retry for a broken search link', () => {
    service.showBrokenSearchLink();
    expect(service.content().error).toBe('This search link is broken');
    expect(service.canRetry()).toBe(false);
  });
});
