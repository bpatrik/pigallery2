import {Component, ElementRef, LOCALE_ID, OnDestroy, computed, effect, inject, input, model, output, signal, untracked, viewChild} from '@angular/core';
import {MediaDTOUtils} from '../../../../../../common/entities/MediaDTO';
import {FullScreenService} from '../../fullscreen.service';
import {GridMedia} from '../../grid/GridMedia';
import {interval, Subscription} from 'rxjs';
import {filter, skip} from 'rxjs/operators';
import {PhotoDTO} from '../../../../../../common/entities/PhotoDTO';
import {GalleryLightboxMediaComponent} from '../media/media.lightbox.gallery.component';
import {Config} from '../../../../../../common/config/public/Config';
import {SearchQueryTypes, TextSearch, TextSearchQueryMatchTypes,} from '../../../../../../common/entities/SearchQueryDTO';
import {AuthenticationService} from '../../../../model/network/authentication.service';
import {LightboxService} from '../lightbox.service';
import {Utils} from '../../../../../../common/Utils';
import {formatFileSize} from '../../../../pipes/FileSizePipe';
import {formatDate} from '@angular/common';
import {LightBoxTitleTexts} from '../../../../../../common/config/public/ClientConfig';
import {NgIconComponent} from '@ng-icons/core';
import {BsDropdownDirective, BsDropdownMenuDirective, BsDropdownToggleDirective} from 'ngx-bootstrap/dropdown';
import {FormsModule} from '@angular/forms';
import {RouterLink} from '@angular/router';
import {SearchQueryUtils} from '../../../../../../common/SearchQueryUtils';
import {GestureDirective, PanEvent, PinchEvent} from '../../../utils/gesture/gesture.directive';


@Component({
  selector: 'app-lightbox-controls',
  host: {
    '(window:keydown)': 'onKeyPress($event)',
    '(mousemove)': 'onMouseMove()'
  },
  styleUrls: ['./controls.lightbox.gallery.component.css', './inputrange.css'],
  templateUrl: './controls.lightbox.gallery.component.html',
  imports: [
    NgIconComponent,
    BsDropdownDirective,
    BsDropdownToggleDirective,
    BsDropdownMenuDirective,
    FormsModule,
    RouterLink,
    GestureDirective
]
})
export class ControlsLightboxComponent implements OnDestroy {
  lightboxService = inject(LightboxService);
  fullScreenService = inject(FullScreenService);
  private authService = inject(AuthenticationService);
  private locale = inject(LOCALE_ID);

  readonly MAX_ZOOM = 10;
  readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('canvas');
  readonly closed = output();
  readonly toggleInfoPanel = output();
  readonly toggleFullScreen = output();
  readonly nextPhoto = output();
  readonly previousPhoto = output();
  readonly navigation = input({hasPrev: true, hasNext: true});
  readonly activePhoto = input<GridMedia | null>(null);
  readonly mediaElement = input.required<GalleryLightboxMediaComponent>();
  readonly photoFrameDim = input({width: 1, height: 1, aspect: 1});
  readonly slideShowRunning = input<boolean>(false);
  readonly zoom = model(1);
  readonly drag = model({x: 0, y: 0});
  public readonly facesEnabled = Config.Faces.enabled;
  public playBackDurations = [1, 2, 5, 10, 15, 20, 30, 60];
  public readonly controllersDimmed = signal(this.lightboxService.controllersDimmed());
  public searchEnabled: boolean;

  readonly topLeftTitle = computed((): string | null => this.getText(this.lightboxService.topLeftTitle()));
  readonly topLeftSubtitle = computed((): string | null => this.getText(this.lightboxService.topLeftSubtitle()));
  readonly bottomLeftTitle = computed((): string | null => this.getText(this.lightboxService.bottomLeftTitle()));
  readonly bottomLeftSubtitle = computed((): string | null => this.getText(this.lightboxService.bottomLeftSubtitle()));
  readonly isPhoto = computed((): boolean => !!this.activePhoto()?.isPhoto());
  readonly isVideo = computed((): boolean => !!this.activePhoto()?.isVideo());
  readonly originalMediaPath = computed((): string | null => this.activePhoto()?.getOriginalMediaPath() ?? null);
  // the faces with their position in % of the photo and their search link
  readonly faces = computed(() => {
    const photo = this.activePhoto()?.Photo;
    if (!photo?.metadata?.faces) {
      return [];
    }
    const size = photo.metadata.size;
    // a face without a box can't be placed on the photo
    return photo.metadata.faces.filter(face => !!face.box).map(face => ({
      name: face.name,
      query: SearchQueryUtils.urlify({
        type: SearchQueryTypes.person,
        matchType: TextSearchQueryMatchTypes.exact_match,
        value: face.name,
      } as TextSearch),
      top: face.box!.top / size.height * 100,
      left: face.box!.left / size.width * 100,
      height: face.box!.height / size.height * 100,
      width: face.box!.width / size.width * 100,
    }));
  });
  // the size of the photo on the screen, without zoom
  readonly faceContainerDim = computed((): { width: number, height: number } => {
    const activePhoto = this.activePhoto();
    const frame = this.photoFrameDim();
    if (!activePhoto) {
      return {width: 0, height: 0};
    }
    const photoAspect = MediaDTOUtils.calcAspectRatio(activePhoto.media);
    if (photoAspect < frame.aspect) {
      return {width: frame.height * photoAspect, height: frame.height};
    }
    return {width: frame.width, height: frame.width / photoAspect};
  });

  private ctx: CanvasRenderingContext2D | null;
  private visibilityTimer: number | null = null;
  private timerSub: Subscription | null;
  // the drag and the zoom when the current pan or pinch started
  private panStart: { x: number, y: number } | null = null;
  private pinchStart: number | null = null;

  constructor() {
    this.searchEnabled = this.authService.canSearch();
    const speed = this.lightboxService.slideshowSpeed();
    if (this.playBackDurations.indexOf(speed) === -1) {
      this.playBackDurations.push(speed);
      this.playBackDurations.sort((a, b) => a - b);
    }
    // the slideshow timer
    effect((): void => {
      const running = this.slideShowRunning();
      untracked((): void => running ? this.runSlideShow() : this.stopSlideShow());
    });
  }

  ngOnDestroy(): void {
    this.stopSlideShow();

    if (this.visibilityTimer != null) {
      clearTimeout(this.visibilityTimer);
      this.visibilityTimer = null;
    }
  }

  setZoom(zoom: number): void {
    const activePhoto = this.activePhoto();
    if (!activePhoto || activePhoto.isVideo()) {
      return;
    }
    zoom = Math.min(Math.max(Number(zoom), 1), this.MAX_ZOOM);
    const prevZoom = this.zoom();
    if (prevZoom === zoom) {
      return;
    }
    this.pauseClicked();
    const scale = (d: { x: number, y: number }) => ({x: (d.x / prevZoom) * zoom, y: (d.y / prevZoom) * zoom});
    this.zoom.set(zoom);
    this.drag.set(this.fixDrag(scale(this.drag())));
    if (this.panStart) {
      this.panStart = this.fixDrag(scale(this.panStart));
    }
    this.showControls();
  }

  pan($event: PanEvent): void {
    const activePhoto = this.activePhoto();
    if (!activePhoto || activePhoto.isVideo()) {
      return;
    }
    if (this.zoom() === 1) {
      return;
    }
    if (this.panStart === null) {
      this.panStart = this.drag();
    }
    this.drag.set(this.fixDrag({x: this.panStart.x + $event.deltaX, y: this.panStart.y + $event.deltaY}));
    this.showControls();
    if ($event.isFinal) {
      this.panStart = null;
    }
  }

  wheel($event: { deltaX: number, deltaY: number }): void {
    const activePhoto = this.activePhoto();
    if (!activePhoto) {
      return;
    }
    if ($event.deltaX < 0) {
      if (this.navigation().hasPrev) {
        this.previousPhoto.emit();
      }
    } else if ($event.deltaX > 0) {
      if (this.navigation().hasNext) {
        this.nextMediaManuallyTriggered();
      }
    }
    if (activePhoto.isVideo()) {
      return;
    }
    if ($event.deltaY < 0) {
      this.zoomIn();
    } else if ($event.deltaY > 0) {
      this.zoomOut();
    }
  }

  pinch($event: PinchEvent): void {
    const activePhoto = this.activePhoto();
    if (!activePhoto || activePhoto.isVideo()) {
      return;
    }
    this.showControls();
    if (this.pinchStart === null) {
      this.pinchStart = this.zoom();
    }
    this.setZoom(this.pinchStart * $event.scale);
    if ($event.isFinal) {
      this.pinchStart = null;
    }
  }

  doubleTap(): void {
    const activePhoto = this.activePhoto();
    if (!activePhoto || activePhoto.isVideo()) {
      return;
    }

    this.showControls();
    this.setZoom(this.zoom() > 1 ? 1 : 5);
  }

  zoomIn(): void {
    this.showControls();
    this.setZoom(this.zoom() + this.zoom() / 10);
  }

  zoomOut(): void {
    this.showControls();
    this.setZoom(this.zoom() - this.zoom() / 10);
  }

  onKeyPress(event: KeyboardEvent): void {
    const activePhoto = this.activePhoto();
    switch (event.key) {
      case 'ArrowLeft':
        if (this.navigation().hasPrev) {
          this.previousPhoto.emit();
        }
        break;
      case 'ArrowRight':
        if (this.navigation().hasNext) {
          this.nextMediaManuallyTriggered();
        }
        break;
      case 'i':
      case 'I':
        this.toggleInfoPanel.emit();
        break;
      case 'f':
      case 'F':
        this.toggleFullScreen.emit();
        break;
      case '-':
        this.zoomOut();
        break;
      case '+':
        this.zoomIn();
        break;
      case 'c':
      case 'C':
        this.lightboxService.setCaptionAlwaysOn(!this.lightboxService.captionAlwaysOn());
        break;
      case 'a':
      case 'A':
        this.lightboxService.setFacesAlwaysOn(!this.lightboxService.facesAlwaysOn());
        break;
      case 'l':
      case 'L':
        this.lightboxService.setLoopVideos(!this.lightboxService.loopVideos());
        break;
      case 'd':
      case 'D':
        if (event.shiftKey && activePhoto) {
          const link = document.createElement('a');
          link.setAttribute('type', 'hidden');
          link.href = activePhoto.getOriginalMediaPath();
          link.download = activePhoto.media.name;
          document.body.appendChild(link);
          link.click();
          link.remove();
        }
        break;
      case 'Escape': // escape
        this.closed.emit();
        break;
      case ' ': // space
        if (activePhoto && activePhoto.isVideo()) {
          this.mediaElement()?.playPause();
        }
        break;
    }
  }

  private runSlideShow(): void {
    //timer already running, do not reset it.
    if (this.timerSub) {
      return;
    }
    this.drawSliderProgress(0);
    this.timerSub = interval(100)
      .pipe(filter((t) => {
        this.drawSliderProgress(t);
        return t % (this.lightboxService.slideshowSpeed() * 10) === 0; // ticks every 100 ms
      }))
      .pipe(skip(1)) // do not skip to next photo right away
      .subscribe(this.showNextMedia);
  }

  onMouseMove(): void {
    this.showControls();
  }

  private stopSlideShow(): void {
    if (this.timerSub != null) {
      this.timerSub.unsubscribe();
      this.timerSub = null;
    }
    this.ctx = null;
  }

  playClicked(): void {
    this.lightboxService.setPlayback(true);
  }

  pauseClicked(): void {
    if (this.slideShowRunning()) {
      this.lightboxService.setPlayback(false);
    }
  }

  public closeLightbox(): void {
    this.hideControls();
    this.closed.emit();
  }

  nextMediaManuallyTriggered(): void {
    this.resetSlideshowTimer();
    this.nextPhoto.emit();
  }

  private getText(type: LightBoxTitleTexts[]): string | null {
    const gridMedia = this.activePhoto();
    if (!gridMedia?.media) {
      return null;
    }
    const m = gridMedia.media as PhotoDTO;
    const retTexts = [];
    const getDir = () => {
      const p = Utils.concatUrls(
        m.directory.path,
        m.directory.name
      );
      if (p === '.') {
        return $localize`Home`;
      }
      if (p.length > 35) {
        return '...' + p.slice(-32);
      }
      return p;
    };
    for (const t of type) {
      switch (t) {
        case LightBoxTitleTexts.file:
          retTexts.push(Utils.concatUrls(
            m.directory.path,
            m.directory.name,
            m.name
          ));
          break;
        case LightBoxTitleTexts.resolution:
          retTexts.push(`${m.metadata.size.width}x${m.metadata.size.height}`);
          break;
        case LightBoxTitleTexts.size:
          retTexts.push(formatFileSize(m.metadata.fileSize));
          break;
        case LightBoxTitleTexts.title:
          retTexts.push(m.metadata.title);
          break;
        case LightBoxTitleTexts.caption:
          retTexts.push(m.metadata.caption);
          break;
        case LightBoxTitleTexts.keywords:
          retTexts.push(m.metadata.keywords?.join(', '));
          break;
        case LightBoxTitleTexts.persons:
          retTexts.push(m.metadata?.faces?.map(f => f.name)?.join(', '));
          break;
        case LightBoxTitleTexts.date: {
          const isThisYear = MediaDTOUtils.createdThisYear(m);
          retTexts.push(formatDate(Utils.getTimeMS(m.metadata.creationDate, m.metadata.creationDateOffset, Config.Gallery.ignoreTimestampOffset), isThisYear ? 'MMMM d' : 'longDate', this.locale, 'UTC'));
          break;
        }
        case LightBoxTitleTexts.location:
          if (!m.metadata?.positionData) {
            break;
          }
          retTexts.push([
            m.metadata.positionData.city,
            m.metadata.positionData.state,
            m.metadata.positionData.country
          ].filter(elm => elm).join(', ').trim()); //Filter removes empty elements, join concat the values separated by ', '
          break;
        case LightBoxTitleTexts.camera:
          retTexts.push(m.metadata.cameraData?.model);
          break;
        case LightBoxTitleTexts.lens:
          retTexts.push(m.metadata.cameraData?.lens);
          break;
        case LightBoxTitleTexts.iso:
          retTexts.push(m.metadata.cameraData?.ISO?.toString());
          break;
        case LightBoxTitleTexts.fstop: {
          const fStop = m.metadata.cameraData?.fStop ?? NaN;
          if (fStop > 1) {
            retTexts.push(fStop.toString());
            break;
          }
          retTexts.push('1/' + Math.round(1 / fStop));
          break;
        }
        case LightBoxTitleTexts.focal_length:
          retTexts.push(m.metadata.cameraData?.focalLength?.toString());
          break;
        case LightBoxTitleTexts.directory:
          retTexts.push(getDir());
          break;
        case LightBoxTitleTexts.titleOrCaption:
          retTexts.push(m.metadata.title || m.metadata.caption);
          break;
        case LightBoxTitleTexts.titleOrDirectory:
          retTexts.push(m.metadata.title || getDir());
          break;
        case LightBoxTitleTexts.titleOrCaptionOrDirectory:
          retTexts.push(m.metadata.title || m.metadata.caption || getDir());
          break;
      }
    }
    return retTexts.map(s => s?.trim()).filter(Boolean).join(' - ');
  }

  private showNextMedia = () => {
    if (!this.navigation().hasNext) {
      this.pauseClicked();
      return;
    }
    const mediaElement = this.mediaElement();
    if (!mediaElement || !mediaElement.isRenderedMediaLoaded() ||
      !mediaElement.isNextMediaLoaded()) {
      return;
    }
    // do not skip video if its playing
    if (this.isVideo() && !mediaElement.paused()) {
      return;
    }
    this.nextPhoto.emit();
  };

  private drawSliderProgress(t: number): void {
    let p = 0;

    // Video is a special snowflake. It won't go to next media if a video is playing
    if (!(this.isVideo() && !this.mediaElement()?.paused())) {
      const speed = this.lightboxService.slideshowSpeed();
      p = (t % (speed * 10)) / speed / 10;  // ticks every 100 ms
    }
    const canvas = this.canvas();
    if (!canvas) {
      return;
    }
    const ctx = this.ctx ?? canvas.nativeElement.getContext('2d');
    if (!ctx) {
      return;
    }
    this.ctx = ctx;

    ctx.lineWidth = 5;
    ctx.strokeStyle = 'white';
    ctx.lineCap = 'round';
    ctx.clearRect(0, 0, canvas.nativeElement.width, canvas.nativeElement.height);
    ctx.beginPath();
    ctx.arc(canvas.nativeElement.width / 2, canvas.nativeElement.height / 2, canvas.nativeElement.width / 2 - ctx.lineWidth, 0, p * 2 * Math.PI);

    ctx.stroke();
  }

  private resetSlideshowTimer(): void {
    if (this.slideShowRunning() === true) {
      this.stopSlideShow();
      this.runSlideShow();
    }
  }

  // keeps the zoomed photo on the screen
  private fixDrag(drag: { x: number; y: number }): { x: number; y: number } {
    const zoom = this.zoom();
    if (zoom === 1) {
      return {x: 0, y: 0};
    }
    const activePhoto = this.activePhoto();
    if (!activePhoto) {
      return drag;
    }

    const frame = this.photoFrameDim();
    const photoAspect = MediaDTOUtils.calcAspectRatio(activePhoto.media);
    const widthFilled = photoAspect > frame.aspect;
    const divWidth = frame.width;
    const divHeight = frame.height;
    const size = {
      width: (widthFilled ? divWidth : divHeight * photoAspect) * zoom,
      height: (widthFilled ? divWidth / photoAspect : divHeight) * zoom,
    };

    const widthDrag = Math.abs(divWidth - size.width) / 2;
    const heightDrag = Math.abs(divHeight - size.height) / 2;
    const clamp = (v: number, max: number) => Math.min(Math.max(v, -max), max);
    return {
      x: divWidth > size.width ? 0 : clamp(drag.x, widthDrag),
      y: divHeight > size.height ? 0 : clamp(drag.y, heightDrag),
    };
  }

  private showControls(): void {
    this.controllersDimmed.set(false);
    if (this.visibilityTimer != null) {
      clearTimeout(this.visibilityTimer);
    }
    this.visibilityTimer = window.setTimeout(this.hideControls, 2000);
  }

  private hideControls = () => {
    this.controllersDimmed.set(true);
  };

}
