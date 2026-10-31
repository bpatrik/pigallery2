import {ComponentFixture, fakeAsync, TestBed, tick} from '@angular/core/testing';
import {ChangeDetectorRef, QueryList} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {BehaviorSubject, of} from 'rxjs';

import {GalleryLightboxComponent, LightboxStates} from './lightbox.gallery.component';
import {GalleryPhotoComponent} from '../grid/photo/photo.grid.gallery.component';
import {FullScreenService} from '../fullscreen.service';
import {OverlayService} from '../overlay.service';
import {WakeLockService} from '../wakelock.service';
import {QueryService} from '../../../model/query.service';
import {PiTitleService} from '../../../model/pi-title.service';
import {LightboxService} from './lightbox.service';
import {PhotoDTO} from '../../../../../common/entities/PhotoDTO';
import {GridMedia} from '../grid/GridMedia';
import {QueryParams} from '../../../../../common/QueryParams';
import {AuthenticationService} from '../../../model/network/authentication.service';
import {GalleryCacheService} from '../cache.gallery.service';
import {Utils} from '../../../../../common/Utils';
import {MediaDTO} from '../../../../../common/entities/MediaDTO';
import {provideIcons} from '@ng-icons/core';
import {appIcons} from '../../../icons';

// Mock classes
class MockFullScreenService {
  isFullScreenEnabled() {
    return false;
  }

  exitFullScreen() {
  }

  showFullScreen() {
  }
}

class MockOverlayService {
  showOverlay() {
  }

  hideOverlay() {
  }
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
  getMediaStringId(media: any) {
    return media.name;
  }

  getParams(lightbox?: { media?: MediaDTO}): { [key: string]: string } {
    const query: { [key: string]: string } = {};
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

class MockGalleryCacheService {
  getSlideshowSpeed() {
    return 1000;
  }
}

class MockPiTitleService {
  setMediaTitle() {
  }

  setLastNonMedia() {
  }
}


// Finishes on the next timer tick, so fakeAsync tests don't wait for the 200 ms animation
function mockAnimate(): Animation {
  const animation = new EventTarget() as Animation;
  animation.cancel = () => {
  };
  setTimeout(() => animation.dispatchEvent(new Event('finish')), 0);
  return animation;
}

class MockRouter {
  constructor(private ac: MockActivatedRoute) {
  }

  navigate(commands: any, extras: any) {
    let newQP = {};
    if (extras.queryParamsHandling == 'merge') {
      newQP = this.ac.queryParams.value;
    }
    newQP = {...newQP, ...extras.queryParams};
    // prevent infinite loop
    if (!Utils.equalsFilter(this.ac.queryParams.value, newQP)) {
      this.ac.queryParams.next(newQP);
    }
    return Promise.resolve(true);
  }
}

class MockActivatedRoute {
  queryParams = new BehaviorSubject({});
}

// Mock photo components
function createMockPhotoComponent(media: PhotoDTO, index: number): GalleryPhotoComponent {
  const gridMedia = new GridMedia(media, 1, 1, index);
  const mockComponent = {
    gridMedia: () => gridMedia,
    getDimension: () => ({top: 0, left: 0, width: 100, height: 100})
  } as unknown as GalleryPhotoComponent;
  return mockComponent;
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

describe('GalleryLightboxComponent - Slideshow Tests', () => {
  let component: GalleryLightboxComponent;
  let lightboxService: LightboxService;
  let fixture: ComponentFixture<GalleryLightboxComponent>;
  let mockActivatedRoute: MockActivatedRoute;
  let mockRouter: MockRouter;
  let mockAuthenticationService: MockAuthenticationService;
  let mockGalleryCacheService: MockGalleryCacheService;
  let photoComponents: GalleryPhotoComponent[];

  beforeEach(async () => {
    mockActivatedRoute = new MockActivatedRoute();
    mockRouter = new MockRouter(mockActivatedRoute);
    mockAuthenticationService = new MockAuthenticationService();
    mockGalleryCacheService = new MockGalleryCacheService();
    spyOn(HTMLElement.prototype, 'animate').and.callFake(mockAnimate);

    await TestBed.configureTestingModule({
      imports: [GalleryLightboxComponent],
      providers: [
        provideIcons(appIcons),
        ChangeDetectorRef,
        {provide: FullScreenService, useClass: MockFullScreenService},
        {provide: OverlayService, useClass: MockOverlayService},
        {provide: WakeLockService, useClass: MockWakeLockService},
        {provide: Router, useValue: mockRouter},
        {provide: QueryService, useClass: MockQueryService},
        {provide: ActivatedRoute, useValue: mockActivatedRoute},
        {provide: PiTitleService, useClass: MockPiTitleService},
        {provide: AuthenticationService, useValue: mockAuthenticationService},
        {provide: GalleryCacheService, useValue: mockGalleryCacheService},
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(GalleryLightboxComponent);
    component = fixture.componentInstance;

    lightboxService = TestBed.inject(LightboxService);
    // Create mock photo components
    const photos = [
      createMockPhoto('photo1.jpg', 0),
      createMockPhoto('photo2.jpg', 1),
      createMockPhoto('photo3.jpg', 2)
    ];

    photoComponents = photos.map((photo, index) => createMockPhotoComponent(photo, index));

    // Create mock QueryList
    const mockQueryList = {
      length: photoComponents.length,
      toArray: () => photoComponents,
      get: (index: number) => photoComponents[index],
      find: (predicate: (item: GalleryPhotoComponent) => boolean) => photoComponents.find(predicate),
      changes: of([])
    } as any as QueryList<GalleryPhotoComponent>;

    component.setGridPhotoQL(mockQueryList);

    // Mock controls component (replaces the view query)
    const controls = {
      resetZoom: jasmine.createSpy('resetZoom'),
      runSlideShow: jasmine.createSpy('runSlideShow'),
      stopSlideShow: jasmine.createSpy('stopSlideShow')
    };
    (component as any).controls = () => controls;

    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should start slideshow when playback button is clicked', fakeAsync(() => {
    // Arrange
    component.status = LightboxStates.Open;
    (component as any).navigateToPhoto(0);

    // Act
    lightboxService.playback = true;
    tick();

    // Assert
    expect(component.status).toBe(LightboxStates.Open);
    expect(component.slideShowRunning).toBe(true);
  }));

  it('should cycle through images during slideshow', fakeAsync(() => {
    expect(lightboxService).toBeTruthy();
    // Arrange
    spyOn(mockRouter, 'navigate').and.returnValue(Promise.resolve(true));
    component.status = LightboxStates.Open;
    (component as any).navigateToPhoto(0);
    component.slideShowRunning = true;

    // Act - simulate next image calls during slideshow
    component.nextImage();
    tick();

    // Assert
    expect(mockRouter.navigate).toHaveBeenCalled();
  }));

  it('should stop slideshow at last image when loopSlideshow is disabled', fakeAsync(() => {
    component.status = LightboxStates.Open;
    (component as any).navigateToPhoto(2);
    // Arrange
    lightboxService.loopSlideshow = false;
    component.slideShowRunning = true;

    // Act - try to go to next image from last photo
    component.nextImage();
    tick();

    // Assert - should wrap to first photo but slideshow should stop in real scenario
    // The nextImage method always wraps, but slideshow logic in controls should stop
    expect(component.NexGridMedia).toBeNull(); // No next media when not looping
  }));

  it('should continue slideshow from first image when loopSlideshow is enabled', fakeAsync(() => {
    // Arrange
    component.status = LightboxStates.Open;
    (component as any).navigateToPhoto(2); // Navigate to last photo
    lightboxService.loopSlideshow = true;
    component.slideShowRunning = true;

    expect(component.NexGridMedia).toBe(photoComponents[0].gridMedia()) // Should return first media when looping
    // Act - go to next image from last photo
    component.nextImage();
    tick();

    // Assert - should wrap to first photo and continue slideshow
    expect(component.NexGridMedia).toBe(photoComponents[1].gridMedia()); // Should return first media when looping
  }));

  it('should stop slideshow when pause button is clicked', fakeAsync(() => {
    // Arrange
    component.slideShowRunning = true;
    (component as any).navigateToPhoto(0);

    // Act
    lightboxService.playback = false;
    tick();

    // Assert
    expect(component.slideShowRunning).toBe(false);
  }));

  it('should handle slideshow with route params', fakeAsync(() => {
    // Arrange - spy on public property instead
    const initialSlideShowState = component.slideShowRunning;

    // Act - simulate playback param in route
    mockActivatedRoute.queryParams.next({[QueryParams.gallery.lightbox.playback]: 'true'});
    tick();

    // Assert
    expect(component.slideShowRunning).toBe(true);

    // Act - simulate removing playback param
    mockActivatedRoute.queryParams.next({});
    tick();

    // Assert
    expect(component.slideShowRunning).toBe(false);
  }));

  it('should navigate to specific photo and start slideshow', fakeAsync(() => {
    // Arrange
    component.status = LightboxStates.Open;

    // Act
    mockActivatedRoute.queryParams.next({
      [QueryParams.gallery.photo]: 'photo2.jpg',
      [QueryParams.gallery.lightbox.playback]: 'true'
    });
    tick();

    // Assert
    expect(component.slideShowRunning).toBe(true);
  }));

  it('should not advance to next photo when no more photos and loopSlideshow disabled', () => {
    // Arrange
    lightboxService.loopSlideshow = false;
    component.status = LightboxStates.Open;
    (component as any).navigateToPhoto(2); // Navigate to last photo

    // Act & Assert
    expect(component.navigation.hasNext).toBe(false);
    expect(component.NexGridMedia).toBeNull();
  });

  it('should advance to first photo when at last photo and loopSlideshow enabled', () => {
    // Arrange
    lightboxService.loopSlideshow = true;
    component.status = LightboxStates.Open;
    (component as any).navigateToPhoto(2); // Navigate to last photo

    // Act & Assert
    expect(component.NexGridMedia).toBe(photoComponents[0].gridMedia());
  });

  it('should release the scroll lock and full screen when destroyed while open', () => {
    const overlayService = TestBed.inject(OverlayService);
    const fullScreenService = TestBed.inject(FullScreenService);
    spyOn(overlayService, 'hideOverlay');
    spyOn(fullScreenService, 'exitFullScreen');
    component.status = LightboxStates.Open;

    fixture.destroy();

    expect(overlayService.hideOverlay).toHaveBeenCalledWith('lightbox');
    expect(fullScreenService.exitFullScreen).toHaveBeenCalled();
  });

  it('should not touch the scroll lock when destroyed while closed', () => {
    const overlayService = TestBed.inject(OverlayService);
    spyOn(overlayService, 'hideOverlay');
    component.status = LightboxStates.Closed;

    fixture.destroy();

    expect(overlayService.hideOverlay).not.toHaveBeenCalled();
  });
});
