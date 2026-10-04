import {ComponentFixture, fakeAsync, TestBed, tick} from '@angular/core/testing';
import {ChangeDetectorRef, QueryList} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {AnimationBuilder} from '@angular/animations';
import {BehaviorSubject, of, Subject} from 'rxjs';

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
import {FileSizePipe} from '../../../pipes/FileSizePipe';
import {DatePipe} from '@angular/common';
import {Utils} from '../../../../../common/Utils';
import {MediaDTO} from '../../../../../common/entities/MediaDTO';
import {LightboxSource} from './LightboxSource';

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

class MockFileSizePipe {
}

class MockPiTitleService {
  setMediaTitle() {
  }

  setLastNonMedia() {
  }
}


class MockAnimationBuilder {
  build() {
    return {
      create() {
        return {
          play() {
          },
          onDone(callback: () => void) {
            setTimeout(callback, 0);
            return this;
          }
        };
      }
    };
  }
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
  const mockComponent = {
    gridMedia: new GridMedia(media, 1, 1, index),
    getDimension: () => ({top: 0, left: 0, width: 100, height: 100})
  } as GalleryPhotoComponent;
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

    await TestBed.configureTestingModule({
      imports: [GalleryLightboxComponent],
      providers: [
        ChangeDetectorRef,
        {provide: FullScreenService, useClass: MockFullScreenService},
        {provide: OverlayService, useClass: MockOverlayService},
        {provide: WakeLockService, useClass: MockWakeLockService},
        {provide: AnimationBuilder, useClass: MockAnimationBuilder},
        {provide: Router, useValue: mockRouter},
        {provide: QueryService, useClass: MockQueryService},
        {provide: ActivatedRoute, useValue: mockActivatedRoute},
        {provide: PiTitleService, useClass: MockPiTitleService},
        {provide: AuthenticationService, useValue: mockAuthenticationService},
        {provide: GalleryCacheService, useValue: mockGalleryCacheService},
        {provide: FileSizePipe, useValue: MockFileSizePipe},
        {provide: DatePipe, useValue: MockFileSizePipe},
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

    // Mock controls component
    component.controls = {
      resetZoom: jasmine.createSpy('resetZoom'),
      runSlideShow: jasmine.createSpy('runSlideShow'),
      stopSlideShow: jasmine.createSpy('stopSlideShow')
    } as any;

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

    expect(component.NexGridMedia).toBe(photoComponents[0].gridMedia) // Should return first media when looping
    // Act - go to next image from last photo
    component.nextImage();
    tick();

    // Assert - should wrap to first photo and continue slideshow
    expect(component.NexGridMedia).toBe(photoComponents[1].gridMedia); // Should return first media when looping
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
    expect(component.NexGridMedia).toBe(photoComponents[0].gridMedia);
  });
});

describe('GalleryLightboxComponent - paged source', () => {
  let component: GalleryLightboxComponent;
  let mockActivatedRoute: MockActivatedRoute;

  beforeEach(async () => {
    mockActivatedRoute = new MockActivatedRoute();
    await TestBed.configureTestingModule({
      imports: [GalleryLightboxComponent],
      providers: [
        ChangeDetectorRef,
        {provide: FullScreenService, useClass: MockFullScreenService},
        {provide: OverlayService, useClass: MockOverlayService},
        {provide: WakeLockService, useClass: MockWakeLockService},
        {provide: AnimationBuilder, useClass: MockAnimationBuilder},
        {provide: Router, useValue: new MockRouter(mockActivatedRoute)},
        {provide: QueryService, useClass: MockQueryService},
        {provide: ActivatedRoute, useValue: mockActivatedRoute},
        {provide: PiTitleService, useClass: MockPiTitleService},
        {provide: AuthenticationService, useValue: new MockAuthenticationService()},
        {provide: GalleryCacheService, useValue: new MockGalleryCacheService()},
        {provide: FileSizePipe, useValue: MockFileSizePipe},
        {provide: DatePipe, useValue: MockFileSizePipe},
      ]
    }).compileComponents();
    const fixture = TestBed.createComponent(GalleryLightboxComponent);
    component = fixture.componentInstance;
    component.controls = {
      resetZoom: jasmine.createSpy('resetZoom'),
      runSlideShow: jasmine.createSpy('runSlideShow'),
      stopSlideShow: jasmine.createSpy('stopSlideShow')
    } as any;
    fixture.detectChanges();
  });

  it('loads the next page at the end of loaded media and opens the next item without a rendered thumbnail', fakeAsync(() => {
    const items = ['a.jpg', 'b.jpg'].map((n, i) => new GridMedia(createMockPhoto(n, i), 1, 1, 0));
    const changes = new Subject<void>();
    let more = true;
    let pending: Promise<void> = null;
    let finishLoad: () => void;
    const loadMore = jasmine.createSpy('loadMore').and.callFake(() => {
      pending = pending || new Promise<void>(resolve => {
        finishLoad = () => {
          items.push(new GridMedia(createMockPhoto('c.jpg', 2), 1, 1, 0));
          more = false;
          pending = null;
          changes.next();
          resolve();
        };
      });
      return pending;
    });
    const source: LightboxSource = {
      changes,
      get length() {
        return items.length;
      },
      get loadState() {
        return pending ? 'loading' as const : 'idle' as const;
      },
      get: (i: number) => items[i],
      getMediaId: (m: MediaDTO) => m.name,
      indexOfId: (id: string) => items.findIndex(g => g.media.name === id),
      animationTarget: () => null,
      queryParams: (m?: MediaDTO) => m ? {[QueryParams.gallery.photo]: m.name} : {},
      hasMore: () => more,
      loadMore,
    };
    component.setSource(source);
    component.status = LightboxStates.Open;
    mockActivatedRoute.queryParams.next({[QueryParams.gallery.photo]: 'b.jpg'});
    tick();

    expect(component.activePhoto.gridMedia.media.name).toBe('b.jpg');
    expect(component.navigation.hasNext).toBeTrue();
    expect(component.NexGridMedia).toBeNull();

    component.nextImage();
    component.nextImage();
    expect(loadMore).toHaveBeenCalled();
    expect(component.IsAtLoadedEnd).toBeTrue();

    finishLoad();
    tick();

    expect(mockActivatedRoute.queryParams.value).toEqual({[QueryParams.gallery.photo]: 'c.jpg'});
    expect(component.activePhoto.gridMedia.media.name).toBe('c.jpg');
    expect(component.navigation.hasNext).toBeFalse();
  }));
});
