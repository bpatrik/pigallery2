import {ComponentFixture, TestBed} from '@angular/core/testing';
import {signal} from '@angular/core';
import {provideRouter} from '@angular/router';
import {NgIconsModule} from '@ng-icons/core';
import {
  ionChevronBackOutline,
  ionChevronForwardOutline,
  ionCloseOutline,
  ionContractOutline,
  ionExpandOutline,
  ionInformationOutline,
  ionMenuOutline,
  ionPauseOutline,
  ionPlayOutline,
  ionAddOutline,
  ionRemoveOutline,
} from '@ng-icons/ionicons';

import {ControlsLightboxComponent} from './controls.lightbox.gallery.component';
import {LightboxService} from '../lightbox.service';
import {FullScreenService} from '../../fullscreen.service';
import {AuthenticationService} from '../../../../model/network/authentication.service';
import {GridMedia} from '../../grid/GridMedia';
import {PhotoDTO} from '../../../../../../common/entities/PhotoDTO';
import {LightBoxTitleTexts} from '../../../../../../common/config/public/ClientConfig';
import {Config} from '../../../../../../common/config/public/Config';
import {GalleryLightboxMediaComponent} from '../media/media.lightbox.gallery.component';

class MockLightboxService {
  readonly controllersDimmed = signal(false);
  readonly slideshowSpeed = signal(5);
  readonly captionAlwaysOn = signal(false);
  readonly facesAlwaysOn = signal(false);
  readonly loopSlideshow = signal(false);
  readonly loopVideos = signal(false);
  readonly playback = signal(false);
  readonly topLeftTitle = signal<LightBoxTitleTexts[]>([]);
  readonly topLeftSubtitle = signal<LightBoxTitleTexts[]>([]);
  readonly bottomLeftTitle = signal<LightBoxTitleTexts[]>([]);
  readonly bottomLeftSubtitle = signal<LightBoxTitleTexts[]>([]);

  setCaptionAlwaysOn(value: boolean): void {
    this.captionAlwaysOn.set(value);
  }

  setFacesAlwaysOn(value: boolean): void {
    this.facesAlwaysOn.set(value);
  }

  setPlayback(value: boolean): void {
    this.playback.set(value);
  }
}

class MockFullScreenService {
  readonly fullScreenEnabled = signal(false);

  isFullScreenEnabled() {
    return false;
  }
}

class MockAuthenticationService {
  canSearch() {
    return false;
  }
}

describe('ControlsLightboxComponent - cursor visibility', () => {
  let component: ControlsLightboxComponent;
  let fixture: ComponentFixture<ControlsLightboxComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        ControlsLightboxComponent,
        NgIconsModule.withIcons({
          ionInformationOutline,
          ionContractOutline,
          ionExpandOutline,
          ionMenuOutline,
          ionCloseOutline,
          ionChevronBackOutline,
          ionChevronForwardOutline,
          ionPlayOutline,
          ionPauseOutline,
          ionAddOutline,
          ionRemoveOutline,
        }),
      ],
      providers: [
        {provide: LightboxService, useClass: MockLightboxService},
        {provide: FullScreenService, useClass: MockFullScreenService},
        {provide: AuthenticationService, useClass: MockAuthenticationService},
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ControlsLightboxComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should hide the cursor while the controls are dimmed', () => {
    component.controllersDimmed.set(true);
    fixture.detectChanges();

    const swipeable: HTMLElement = fixture.nativeElement.querySelector('#swipeable-container');
    expect(swipeable).toBeTruthy();
    expect(swipeable.classList.contains('hide-cursor')).toBe(true);
  });

  it('should keep the cursor visible while the controls are shown', () => {
    component.controllersDimmed.set(false);
    fixture.detectChanges();

    const swipeable: HTMLElement = fixture.nativeElement.querySelector('#swipeable-container');
    expect(swipeable).toBeTruthy();
    expect(swipeable.classList.contains('hide-cursor')).toBe(false);
  });
});

// #1310, CUJ 13-18: the controls of the lightbox
describe('ControlsLightboxComponent', () => {
  let component: ControlsLightboxComponent;
  let fixture: ComponentFixture<ControlsLightboxComponent>;
  let lightboxService: MockLightboxService;
  let next: ReturnType<typeof vi.fn<() => void>>;
  let previous: ReturnType<typeof vi.fn<() => void>>;
  const facesEnabled = Config.Faces.enabled;

  // a landscape photo (3:2) with a face; the caption has accents, to check that it shows as it is
  const photo = (name = 'autumn hike.jpg'): GridMedia => new GridMedia({
    name,
    directory: {name: 'Vacation', path: './'},
    metadata: {
      size: {width: 3000, height: 2000},
      caption: 'Árvíztűrő tükörfúrógép',
      creationDate: Date.UTC(2020, 0, 1),
      fileSize: 1024,
      faces: [{name: 'Jane Doe', box: {left: 300, top: 200, width: 600, height: 400}}]
    }
  } as unknown as PhotoDTO, 300, 200, 0);

  const create = (): void => {
    fixture = TestBed.createComponent(ControlsLightboxComponent);
    component = fixture.componentInstance;
    next = vi.fn<() => void>();
    previous = vi.fn<() => void>();
    component.nextPhoto.subscribe(next);
    component.previousPhoto.subscribe(previous);
    fixture.componentRef.setInput('mediaElement', {playPause: vi.fn(), paused: () => true} as unknown as GalleryLightboxMediaComponent);
    fixture.componentRef.setInput('activePhoto', photo());
    // the screen is wider than the photo (16:9)
    fixture.componentRef.setInput('photoFrameDim', {width: 1600, height: 900, aspect: 16 / 9});
    fixture.detectChanges();
  };
  const setNavigation = (navigation: { hasPrev: boolean, hasNext: boolean }): void => {
    fixture.componentRef.setInput('navigation', navigation);
    fixture.detectChanges();
  };
  const key = (k: string): void => {
    window.dispatchEvent(new KeyboardEvent('keydown', {key: k}));
    fixture.detectChanges();
  };
  const query = (selector: string): HTMLElement | null => fixture.nativeElement.querySelector(selector);

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        ControlsLightboxComponent,
        NgIconsModule.withIcons({
          ionInformationOutline,
          ionContractOutline,
          ionExpandOutline,
          ionMenuOutline,
          ionCloseOutline,
          ionChevronBackOutline,
          ionChevronForwardOutline,
          ionPlayOutline,
          ionPauseOutline,
          ionAddOutline,
          ionRemoveOutline,
        }),
      ],
      providers: [
        {provide: LightboxService, useClass: MockLightboxService},
        {provide: FullScreenService, useClass: MockFullScreenService},
        {provide: AuthenticationService, useClass: MockAuthenticationService},
        provideRouter([]),
      ],
    }).compileComponents();
    lightboxService = TestBed.inject(LightboxService) as unknown as MockLightboxService;
  });

  afterEach(() => {
    Config.Faces.enabled = facesEnabled;
  });

  describe('paging', () => {
    beforeEach(create);

    it('should page with the arrow keys and the arrow buttons', () => {
      setNavigation({hasPrev: true, hasNext: true});
      key('ArrowRight');
      key('ArrowLeft');
      expect(next).toHaveBeenCalledTimes(1);
      expect(previous).toHaveBeenCalledTimes(1);

      query('#rightArrow')!.click();
      query('#leftArrow')!.click();
      expect(next).toHaveBeenCalledTimes(2);
      expect(previous).toHaveBeenCalledTimes(2);
    });

    it('should not go back from the first photo', () => {
      setNavigation({hasPrev: false, hasNext: true});
      expect(query('#leftArrow')).toBeNull();
      key('ArrowLeft');
      expect(previous).not.toHaveBeenCalled();
    });

    it('should not go further from the last photo', () => {
      setNavigation({hasPrev: true, hasNext: false});
      expect(query('#rightArrow')).toBeNull();
      key('ArrowRight');
      expect(next).not.toHaveBeenCalled();
    });

    it('should page with the horizontal scroll of a touchpad, within the first and the last photo', () => {
      setNavigation({hasPrev: false, hasNext: true});
      component.wheel({deltaX: -10, deltaY: 0});
      component.wheel({deltaX: 10, deltaY: 0});
      expect(previous).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('should close with Escape', () => {
      const closed = vi.fn<() => void>();
      component.closed.subscribe(closed);
      key('Escape');
      expect(closed).toHaveBeenCalledTimes(1);
    });
  });

  describe('zoom and pan', () => {
    beforeEach(create);

    it('should zoom between 1 and the max zoom', () => {
      key('+');
      expect(component.zoom()).toBeCloseTo(1.1);
      key('-');
      key('-');
      key('-');
      expect(component.zoom()).toBe(1);

      component.setZoom(100);
      expect(component.zoom()).toBe(component.MAX_ZOOM);
      component.setZoom(-5);
      expect(component.zoom()).toBe(1);
    });

    it('should hide the arrows and show the zoom bar while zoomed in', () => {
      setNavigation({hasPrev: true, hasNext: true});
      component.setZoom(2);
      fixture.detectChanges();
      expect(query('#rightArrow')).toBeNull();
      expect(query('#leftArrow')).toBeNull();
      expect(query('.controls-zoom')).not.toBeNull();
      // the keys still page
      key('ArrowRight');
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('should not pan when not zoomed in', () => {
      component.pan({deltaX: 500, deltaY: 500, isFinal: true} as never);
      expect(component.drag()).toEqual({x: 0, y: 0});
    });

    it('should not pan the photo out of the screen', () => {
      // 2x: the photo is 2700 x 1800 on the 1600 x 900 screen
      component.setZoom(2);
      component.pan({deltaX: 10000, deltaY: -10000, isFinal: true} as never);
      expect(component.drag()).toEqual({x: (2700 - 1600) / 2, y: -(1800 - 900) / 2});

      component.pan({deltaX: -100000, deltaY: 100000, isFinal: true} as never);
      expect(component.drag()).toEqual({x: -(2700 - 1600) / 2, y: (1800 - 900) / 2});
    });

    it('should keep a smaller than the screen side centered', () => {
      // 1.1x: the photo is 1485 x 990 on the 1600 x 900 screen: only its height can be panned
      component.setZoom(1.1);
      component.pan({deltaX: 300, deltaY: 300, isFinal: true} as never);
      expect(component.drag().x).toBe(0);
      expect(component.drag().y).toBeGreaterThan(0);
    });

    it('should pull the photo back to the screen when zooming out', () => {
      component.setZoom(4);
      component.pan({deltaX: 10000, deltaY: 10000, isFinal: true} as never);
      component.setZoom(2);
      expect(component.drag()).toEqual({x: (2700 - 1600) / 2, y: (1800 - 900) / 2});
      component.setZoom(1);
      expect(component.drag()).toEqual({x: 0, y: 0});
    });

    it('should zoom in and out with a double tap', () => {
      component.doubleTap();
      expect(component.zoom()).toBe(5);
      component.doubleTap();
      expect(component.zoom()).toBe(1);
    });
  });

  describe('faces and captions', () => {
    const faceNames = (): string[] => [...fixture.nativeElement.querySelectorAll('.faces-container .face-name')]
      .map((e: Element) => e.textContent!.trim());

    it('should show the face boxes with the names when faces are enabled', () => {
      Config.Faces.enabled = true;
      create();
      expect(faceNames()).toEqual(['Jane Doe']);
      const face = query('.faces-container .face')!;
      // in % of the photo
      expect(face.style.left).toBe('10%');
      expect(face.style.top).toBe('10%');
      expect(face.style.width).toBe('20%');
      expect(face.style.height).toBe('20%');
    });

    it('should not show the face boxes when faces are disabled', () => {
      Config.Faces.enabled = false;
      create();
      expect(query('.faces-container')).toBeNull();
    });

    it('should keep the face boxes on with the "Always show faces" setting and its key', () => {
      Config.Faces.enabled = true;
      create();
      expect(query('.face-box.controls-nodim')).toBeNull();
      key('a');
      expect(lightboxService.facesAlwaysOn()).toBe(true);
      expect(query('.face-box.controls-nodim')).not.toBeNull();
      key('a');
      expect(query('.face-box.controls-nodim')).toBeNull();
    });

    it('should show the caption of the photo', () => {
      lightboxService.bottomLeftTitle.set([LightBoxTitleTexts.caption]);
      create();
      expect(query('.controls-bottom-left-title')!.textContent).toContain('Árvíztűrő tükörfúrógép');
    });

    it('should show no caption box when the title setting is empty', () => {
      create();
      expect(query('.controls-bottom-left-title')).toBeNull();
    });

    it('should keep the caption on with the "Always show captions" setting and its key', () => {
      lightboxService.bottomLeftTitle.set([LightBoxTitleTexts.caption]);
      create();
      expect(query('.controls-bottom-left-title')!.classList).not.toContain('controls-nodim');
      key('c');
      expect(lightboxService.captionAlwaysOn()).toBe(true);
      expect(query('.controls-bottom-left-title')!.classList).toContain('controls-nodim');
      key('c');
      expect(query('.controls-bottom-left-title')!.classList).not.toContain('controls-nodim');
    });
  });
});
