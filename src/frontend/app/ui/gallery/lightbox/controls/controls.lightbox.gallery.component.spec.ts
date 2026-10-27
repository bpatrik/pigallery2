import {ComponentFixture, TestBed} from '@angular/core/testing';
import {provideNoopAnimations} from '@angular/platform-browser/animations';
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
} from '@ng-icons/ionicons';

import {ControlsLightboxComponent} from './controls.lightbox.gallery.component';
import {LightboxService} from '../lightbox.service';
import {FullScreenService} from '../../fullscreen.service';
import {AuthenticationService} from '../../../../model/network/authentication.service';
import {FileSizePipe} from '../../../../pipes/FileSizePipe';
import {DatePipe} from '@angular/common';

class MockLightboxService {
  controllersDimmed = false;
  slideshowSpeed = 5;
  captionAlwaysOn = false;
  facesAlwaysOn = false;
}

class MockFullScreenService {
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
        }),
      ],
      providers: [
        {provide: LightboxService, useClass: MockLightboxService},
        {provide: FullScreenService, useClass: MockFullScreenService},
        {provide: AuthenticationService, useClass: MockAuthenticationService},
        {provide: FileSizePipe, useValue: {}},
        {provide: DatePipe, useValue: {}},
        provideNoopAnimations(),
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ControlsLightboxComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should hide the cursor while the controls are dimmed', () => {
    component.controllersDimmed = true;
    fixture.detectChanges();

    const swipeable: HTMLElement = fixture.nativeElement.querySelector('#swipeable-container');
    expect(swipeable).toBeTruthy();
    expect(swipeable.classList.contains('hide-cursor')).toBe(true);
  });

  it('should keep the cursor visible while the controls are shown', () => {
    component.controllersDimmed = false;
    fixture.detectChanges();

    const swipeable: HTMLElement = fixture.nativeElement.querySelector('#swipeable-container');
    expect(swipeable).toBeTruthy();
    expect(swipeable.classList.contains('hide-cursor')).toBe(false);
  });

  describe('share', () => {
    let shared: ShareData[];
    let shareError: DOMException;
    let canShare: boolean;
    let saved: PropertyDescriptor[];

    beforeEach(() => {
      shared = [];
      shareError = null;
      canShare = true;
      saved = ['share', 'canShare'].map((k) => Object.getOwnPropertyDescriptor(navigator, k));
      Object.defineProperty(navigator, 'share', {
        configurable: true,
        value: async (data: ShareData) => {
          if (shareError) {
            throw shareError;
          }
          shared.push(data);
        },
      });
      Object.defineProperty(navigator, 'canShare', {configurable: true, value: () => canShare});
      spyOn(ControlsLightboxComponent as any, 'toJpeg').and.resolveTo(new Blob(['x'], {type: 'image/jpeg'}));
      component.activePhoto = {
        gridMedia: {
          isVideo: () => false,
          media: {name: 'IMG_1234.HEIC'},
          getBestSizedMediaPath: () => '/pgapi/gallery/content/a/IMG_1234.HEIC/1080',
        },
      } as any;
    });

    afterEach(() => {
      ['share', 'canShare'].forEach((k, i) => {
        if (saved[i]) {
          Object.defineProperty(navigator, k, saved[i]);
        } else {
          delete (navigator as any)[k];
        }
      });
    });

    it('should share the large preview as a JPEG', async () => {
      await component.share();
      expect((ControlsLightboxComponent as any).toJpeg).toHaveBeenCalledWith('/pgapi/gallery/content/a/IMG_1234.HEIC/1080');
      expect(shared.length).toBe(1);
      expect(shared[0].files[0].name).toBe('IMG_1234.jpg');
      expect(shared[0].files[0].type).toBe('image/jpeg');
      expect(component.shareFile).toBeNull();
    });

    it('should offer a share button when the phone wants a tap first', async () => {
      shareError = new DOMException('no gesture', 'NotAllowedError');
      await component.share();
      expect(component.shareFile.name).toBe('IMG_1234.jpg');
      shareError = null;
      await component.shareNow();
      expect(shared.length).toBe(1);
      expect(component.shareFile).toBeNull();
    });

    it('should do nothing more when the share sheet is closed', async () => {
      shareError = new DOMException('closed', 'AbortError');
      await component.share();
      expect(component.shareFile).toBeNull();
    });

    it('should not share a video', async () => {
      (component.activePhoto.gridMedia as any).isVideo = () => true;
      await component.share();
      expect((ControlsLightboxComponent as any).toJpeg).not.toHaveBeenCalled();
    });
  });
});
