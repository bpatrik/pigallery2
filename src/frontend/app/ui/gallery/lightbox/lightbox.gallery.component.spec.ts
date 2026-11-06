import {ComponentFixture, TestBed} from '@angular/core/testing';
import {signal} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {BehaviorSubject} from 'rxjs';

import {GalleryLightboxComponent, LightboxGrid, LightboxGridTile, LightboxStates} from './lightbox.gallery.component';
import {FullScreenService} from '../fullscreen.service';
import {OverlayService} from '../overlay.service';
import {WakeLockService} from '../wakelock.service';
import {QueryService} from '../../../model/query.service';
import {PiTitleService} from '../../../model/pi-title.service';
import {NotificationService} from '../../../model/notification.service';
import {PhotoDTO} from '../../../../../common/entities/PhotoDTO';
import {GridMedia} from '../grid/GridMedia';
import {QueryParams} from '../../../../../common/QueryParams';
import {AuthenticationService} from '../../../model/network/authentication.service';
import {MediaDTO} from '../../../../../common/entities/MediaDTO';
import {provideIcons} from '@ng-icons/core';
import {appIcons} from '../../../icons';

// Mock classes
class MockFullScreenService {
  readonly fullScreenEnabled = signal(false);

  isFullScreenEnabled() {
    return false;
  }

  exitFullScreen = vi.fn();

  showFullScreen = vi.fn();
}

class MockOverlayService {
  showOverlay = vi.fn();

  hideOverlay = vi.fn();
}

class MockWakeLockService {
  requestWakeLock() {
    return Promise.resolve();
  }

  releaseWakeLock() {
    return Promise.resolve();
  }
}

class MockQueryService {
  getMediaStringId(media: MediaDTO) {
    return media.name;
  }

  getParams(lightbox?: { media?: MediaDTO }): Record<string, string> {
    const query: Record<string, string> = {};
    if (lightbox?.media) {
      query[QueryParams.gallery.photo] = this.getMediaStringId(lightbox?.media);
    }
    return query;
  }
}

class MockAuthenticationService {
  canSearch() {
    return true;
  }
}

class MockPiTitleService {
  setMediaTitle = vi.fn();

  setLastNonMedia = vi.fn();
}

class MockNotificationService {
  info = vi.fn();
}

// Finishes on the next timer tick, so fake-timer tests don't wait for the 200 ms animation
function mockAnimate(): Animation {
  const animation = new EventTarget() as Animation;
  animation.cancel = vi.fn();
  setTimeout(() => animation.dispatchEvent(new Event('finish')), 0);
  return animation;
}

class MockActivatedRoute {
  queryParams = new BehaviorSubject<Record<string, string>>({});
}

class MockRouter {
  constructor(private ac: MockActivatedRoute) {
  }

  navigate(commands: unknown, extras: { queryParams: Record<string, string | null>, queryParamsHandling?: string }) {
    let newQP: Record<string, string> = {};
    if (extras.queryParamsHandling == 'merge') {
      newQP = {...this.ac.queryParams.value};
    }
    for (const [k, v] of Object.entries(extras.queryParams)) {
      if (v === null || v === undefined) {
        delete newQP[k];
      } else {
        newQP[k] = String(v);
      }
    }
    this.ac.queryParams.next(newQP);
    return Promise.resolve(true);
  }
}

// The grid with all its media "rendered" on request
class FakeGrid implements LightboxGrid {
  readonly media = signal<MediaDTO[] | null>(null);
  readonly revealMedia = vi.fn((media: MediaDTO): Promise<LightboxGridTile | null> => {
    const found = this.media()?.find(m => m.name === media.name);
    return Promise.resolve(found ? {
      rect: {top: 10, left: 10, width: 100, height: 100},
      gridMedia: new GridMedia(found, 100, 100, 0)
    } : null);
  });
}

function createMockPhoto(name: string, index: number): PhotoDTO {
  return {
    name: name,
    directory: {name: 'testdir', path: '/test'},
    metadata: {
      size: {width: 800, height: 600},
      caption: `Test photo ${index}`,
      creationDate: Date.now(),
      fileSize: 1024
    }
  } as PhotoDTO;
}

describe('GalleryLightboxComponent', () => {
  let component: GalleryLightboxComponent;
  let fixture: ComponentFixture<GalleryLightboxComponent>;
  let mockActivatedRoute: MockActivatedRoute;
  let mockRouter: MockRouter;
  let grid: FakeGrid;
  let photos: PhotoDTO[];
  let notifications: MockNotificationService;

  // runs the effects, the grid's reveal and the (mocked) animations
  const settle = async (): Promise<void> => {
    for (let i = 0; i < 3; ++i) {
      fixture.detectChanges();
      await vi.advanceTimersByTimeAsync(0);
    }
  };
  const openPhoto = async (name: string, extra: Record<string, string> = {}): Promise<void> => {
    mockActivatedRoute.queryParams.next({[QueryParams.gallery.photo]: name, ...extra});
    await settle();
  };
  const photoParam = (): string => mockActivatedRoute.queryParams.value[QueryParams.gallery.photo];

  beforeEach(async () => {
    vi.useFakeTimers();
    mockActivatedRoute = new MockActivatedRoute();
    mockRouter = new MockRouter(mockActivatedRoute);
    // jsdom has no Web Animations API
    HTMLElement.prototype.animate = mockAnimate;

    await TestBed.configureTestingModule({
      imports: [GalleryLightboxComponent],
      providers: [
        provideIcons(appIcons),
        {provide: FullScreenService, useClass: MockFullScreenService},
        {provide: OverlayService, useClass: MockOverlayService},
        {provide: WakeLockService, useClass: MockWakeLockService},
        {provide: Router, useValue: mockRouter},
        {provide: QueryService, useClass: MockQueryService},
        {provide: ActivatedRoute, useValue: mockActivatedRoute},
        {provide: PiTitleService, useClass: MockPiTitleService},
        {provide: AuthenticationService, useClass: MockAuthenticationService},
        {provide: NotificationService, useClass: MockNotificationService},
      ]
    }).compileComponents();

    notifications = TestBed.inject(NotificationService) as unknown as MockNotificationService;
    fixture = TestBed.createComponent(GalleryLightboxComponent);
    component = fixture.componentInstance;

    photos = [
      createMockPhoto('photo1.jpg', 0),
      createMockPhoto('photo2.jpg', 1),
      createMockPhoto('photo3.jpg', 2)
    ];
    grid = new FakeGrid();
    grid.media.set(photos);
    fixture.componentRef.setInput('grid', grid);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    vi.useRealTimers();
    delete (HTMLElement.prototype as Partial<HTMLElement>).animate;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
    expect(component.status()).toBe(LightboxStates.Closed);
  });

  it('should open the photo of the URL from its tile', async () => {
    await openPhoto('photo2.jpg');

    expect(grid.revealMedia).toHaveBeenCalledWith(photos[1]);
    expect(component.status()).toBe(LightboxStates.Open);
    expect(component.activePhoto()!.media).toBe(photos[1]);
    expect(component.activeIndex()).toBe(1);
  });

  it('should start slideshow when playback button is clicked', async () => {
    await openPhoto('photo1.jpg');

    mockRouter.navigate([], {queryParams: {[QueryParams.gallery.lightbox.playback]: 'true'}, queryParamsHandling: 'merge'});
    await settle();

    expect(component.status()).toBe(LightboxStates.Open);
    expect(component.slideShowRunning()).toBe(true);
  });

  it('should cycle through images during slideshow', async () => {
    await openPhoto('photo1.jpg', {[QueryParams.gallery.lightbox.playback]: 'true'});

    component.nextImage();
    await settle();

    expect(photoParam()).toBe('photo2.jpg');
    expect(component.activePhoto()!.media).toBe(photos[1]);
    expect(component.slideShowRunning()).toBe(true);
  });

  it('should stop slideshow at last image when loopSlideshow is disabled', async () => {
    await openPhoto('photo3.jpg', {
      [QueryParams.gallery.lightbox.playback]: 'true',
      [QueryParams.gallery.lightbox.loopSlideshow]: 'false'
    });

    component.nextImage();
    await settle();

    expect(component.nextMedia()).toBeNull();
    expect(component.hasNext()).toBe(false);
    expect(photoParam()).toBe('photo3.jpg');
  });

  it('should continue slideshow from first image when loopSlideshow is enabled', async () => {
    await openPhoto('photo3.jpg', {
      [QueryParams.gallery.lightbox.playback]: 'true',
      [QueryParams.gallery.lightbox.loopSlideshow]: 'true'
    });
    expect(component.nextMedia()).toBe(photos[0]);
    expect(component.nextGridMedia()!.media).toBe(photos[0]);

    component.nextImage();
    await settle();

    expect(photoParam()).toBe('photo1.jpg');
    expect(component.nextMedia()).toBe(photos[1]);
    expect(component.slideShowRunning()).toBe(true);
  });

  it('should stop slideshow when pause button is clicked', async () => {
    await openPhoto('photo1.jpg', {[QueryParams.gallery.lightbox.playback]: 'true'});
    expect(component.slideShowRunning()).toBe(true);

    mockRouter.navigate([], {queryParams: {[QueryParams.gallery.lightbox.playback]: null}, queryParamsHandling: 'merge'});
    await settle();

    expect(component.slideShowRunning()).toBe(false);
  });

  it('should pause the slideshow when going back', async () => {
    await openPhoto('photo2.jpg', {[QueryParams.gallery.lightbox.playback]: 'true'});

    component.prevImage();
    await settle();

    expect(photoParam()).toBe('photo1.jpg');
    expect(component.slideShowRunning()).toBe(false);
  });

  it('should handle slideshow with route params', async () => {
    mockActivatedRoute.queryParams.next({[QueryParams.gallery.lightbox.playback]: 'true'});
    await settle();
    // a slideshow URL without a photo starts at the first one
    expect(component.slideShowRunning()).toBe(true);
    expect(photoParam()).toBe('photo1.jpg');

    mockActivatedRoute.queryParams.next({[QueryParams.gallery.photo]: 'photo1.jpg'});
    await settle();

    expect(component.slideShowRunning()).toBe(false);
  });

  it('should navigate to specific photo and start slideshow', async () => {
    await openPhoto('photo2.jpg', {[QueryParams.gallery.lightbox.playback]: 'true'});

    expect(component.activePhoto()!.media).toBe(photos[1]);
    expect(component.slideShowRunning()).toBe(true);
  });

  it('should not advance to next photo when no more photos and loopSlideshow disabled', async () => {
    await openPhoto('photo3.jpg', {[QueryParams.gallery.lightbox.loopSlideshow]: 'false'});

    expect(component.navigation().hasNext).toBe(false);
    expect(component.nextGridMedia()).toBeNull();
    component.nextImage();
    expect(photoParam()).toBe('photo3.jpg');
  });

  it('should tell whether there is a previous and a next photo', async () => {
    await openPhoto('photo1.jpg', {[QueryParams.gallery.lightbox.loopSlideshow]: 'false'});
    expect(component.navigation()).toEqual({hasPrev: false, hasNext: true});

    await openPhoto('photo2.jpg', {[QueryParams.gallery.lightbox.loopSlideshow]: 'false'});
    expect(component.navigation()).toEqual({hasPrev: true, hasNext: true});

    await openPhoto('photo3.jpg', {[QueryParams.gallery.lightbox.loopSlideshow]: 'false'});
    expect(component.navigation()).toEqual({hasPrev: true, hasNext: false});
  });

  it('should navigate by the content order, also beyond the rendered photos', async () => {
    const many: PhotoDTO[] = [];
    for (let i = 0; i < 50; ++i) {
      many.push(createMockPhoto('p' + i + '.jpg', i));
    }
    grid.media.set(many);
    await openPhoto('p30.jpg');

    component.nextImage();
    await settle();

    expect(photoParam()).toBe('p31.jpg');
    expect(grid.revealMedia).toHaveBeenLastCalledWith(many[31]);
    expect(component.activePhoto()!.media).toBe(many[31]);

    component.prevImage();
    await settle();
    component.prevImage();
    await settle();
    expect(component.activePhoto()!.media).toBe(many[29]);
  });

  it('should show the first photo with a toast when the open photo is gone, and keep the slideshow playing', async () => {
    await openPhoto('photo2.jpg', {[QueryParams.gallery.lightbox.playback]: 'true'});

    // the fresh listing replaces the cached one
    grid.media.set([photos[0], photos[2]]);
    await settle();

    expect(notifications.info).toHaveBeenCalledTimes(1);
    expect(photoParam()).toBe('photo1.jpg');
    expect(component.activePhoto()!.media).toBe(photos[0]);
    expect(component.status()).toBe(LightboxStates.Open);
    expect(component.slideShowRunning()).toBe(true);
  });

  it('should show the first photo with a toast for a link to a photo that is not there', async () => {
    await openPhoto('missing.jpg');

    expect(notifications.info).toHaveBeenCalledTimes(1);
    expect(photoParam()).toBe('photo1.jpg');
    expect(component.status()).toBe(LightboxStates.Open);
  });

  it('should close when the content is empty', async () => {
    await openPhoto('photo2.jpg');

    grid.media.set([]);
    await settle();

    expect(photoParam()).toBeUndefined();
    expect(component.status()).toBe(LightboxStates.Closed);
  });

  it('should wait for the content on a cold link', async () => {
    grid.media.set(null);
    await openPhoto('photo3.jpg');
    expect(grid.revealMedia).not.toHaveBeenCalled();
    expect(component.status()).toBe(LightboxStates.Closed);

    grid.media.set(photos);
    await settle();

    expect(grid.revealMedia).toHaveBeenCalledWith(photos[2]);
    expect(component.status()).toBe(LightboxStates.Open);
    expect(component.activePhoto()!.media).toBe(photos[2]);
    expect(notifications.info).not.toHaveBeenCalled();
  });

  it('should reveal the open photo in the grid on close', async () => {
    await openPhoto('photo1.jpg');
    component.nextImage();
    await settle();
    grid.revealMedia.mockClear();

    component.hide();
    await settle();

    expect(grid.revealMedia).toHaveBeenCalledTimes(1);
    expect(grid.revealMedia).toHaveBeenCalledWith(photos[1]);
    expect(component.status()).toBe(LightboxStates.Closed);
    expect(component.activePhoto()).toBeNull();
  });

  it('should release the scroll lock and full screen when destroyed while open', () => {
    const overlayService = TestBed.inject(OverlayService);
    const fullScreenService = TestBed.inject(FullScreenService);
    vi.spyOn(overlayService, 'hideOverlay').mockImplementation(() => undefined);
    vi.spyOn(fullScreenService, 'exitFullScreen').mockImplementation(() => undefined);
    component.status.set(LightboxStates.Open);

    fixture.destroy();

    expect(overlayService.hideOverlay).toHaveBeenCalledWith('lightbox');
    expect(fullScreenService.exitFullScreen).toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it('should not touch the scroll lock when destroyed while closed', () => {
    const overlayService = TestBed.inject(OverlayService);
    vi.spyOn(overlayService, 'hideOverlay').mockImplementation(() => undefined);
    component.status.set(LightboxStates.Closed);

    fixture.destroy();

    expect(overlayService.hideOverlay).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});
