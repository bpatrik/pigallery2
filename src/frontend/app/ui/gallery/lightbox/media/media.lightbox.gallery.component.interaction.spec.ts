import {ComponentFixture, TestBed} from '@angular/core/testing';
import {DomSanitizer} from '@angular/platform-browser';

import {GalleryLightboxMediaComponent} from './media.lightbox.gallery.component';
import {LightboxService} from '../lightbox.service';
import {GridMedia} from '../../grid/GridMedia';
import {PhotoDTO} from '../../../../../../common/entities/PhotoDTO';

class MockLightboxService {
  loopVideos = false;
}

function makeGridMedia(overrides: Partial<PhotoDTO> = {}): GridMedia {
  const media = {
    name: 'IMG_001.HEIC',
    directory: {name: 'photos', path: '/'},
    metadata: {
      size: {width: 4032, height: 3024},
      creationDate: Date.now(),
      fileSize: 2048000,
    },
    liveVideoPath: 'photos/IMG_001_HEVC.MOV',
    ...overrides,
  } as any;
  const gridMedia = new GridMedia(media, 100, 100, 0);
  gridMedia.getThumbnailPath = () => 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';
  gridMedia.getBestSizedMediaPath = () => 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';
  gridMedia.getOriginalMediaPath = () => 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';
  gridMedia.getLiveVideoPath = () => 'data:video/mp4;base64,AAAA';
  return gridMedia;
}

function createMockVideoElement(): {
  currentTime: number;
  play: jasmine.Spy;
  pause: jasmine.Spy;
} {
  return {
    currentTime: 12,
    play: jasmine.createSpy('play').and.returnValue(Promise.resolve()),
    pause: jasmine.createSpy('pause'),
  };
}

describe('GalleryLightboxMediaComponent - Live Photo interactions', () => {
  let component: GalleryLightboxMediaComponent;
  let fixture: ComponentFixture<GalleryLightboxMediaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GalleryLightboxMediaComponent],
      providers: [
        {provide: LightboxService, useClass: MockLightboxService},
        {
          provide: DomSanitizer,
          useValue: {
            bypassSecurityTrustStyle: (val: string) => val,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(GalleryLightboxMediaComponent);
    component = fixture.componentInstance;
  });

  const renderLivePhoto = () => {
    component.gridMedia = makeGridMedia();
    component.loadMedia = true;
    component.ngOnChanges();
    fixture.detectChanges();
    return fixture.nativeElement.querySelector('.live-photo-badge') as HTMLElement;
  };

  it('should start and stop the companion video from badge hover events', () => {
    const badge = renderLivePhoto();
    const video = createMockVideoElement();
    component.liveVideo = {nativeElement: video as any} as any;

    badge.dispatchEvent(new Event('mouseenter'));
    fixture.detectChanges();

    expect(component.liveVideoPlaying).toBeTrue();
    expect(video.currentTime).toBe(0);
    expect(video.play).toHaveBeenCalled();

    badge.dispatchEvent(new Event('mouseleave'));
    fixture.detectChanges();

    expect(component.liveVideoPlaying).toBeFalse();
    expect(video.pause).toHaveBeenCalled();
  });

  it('should start and stop the companion video from badge touch events', () => {
    const badge = renderLivePhoto();
    const video = createMockVideoElement();
    component.liveVideo = {nativeElement: video as any} as any;

    badge.dispatchEvent(new Event('touchstart'));
    fixture.detectChanges();

    expect(component.liveVideoPlaying).toBeTrue();
    expect(video.currentTime).toBe(0);
    expect(video.play).toHaveBeenCalled();

    badge.dispatchEvent(new Event('touchend'));
    fixture.detectChanges();

    expect(component.liveVideoPlaying).toBeFalse();
    expect(video.pause).toHaveBeenCalled();
  });
});
