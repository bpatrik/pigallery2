import {Component, ElementRef, EventEmitter, HostListener, Input, OnChanges, OnDestroy, OnInit, Output, ViewChild,} from '@angular/core';
import {MediaDTOUtils} from '../../../../../../common/entities/MediaDTO';
import {FullScreenService} from '../../fullscreen.service';
import {GalleryPhotoComponent} from '../../grid/photo/photo.grid.gallery.component';
import {interval, Subscription} from 'rxjs';
import {filter, skip} from 'rxjs/operators';
import {PhotoDTO} from '../../../../../../common/entities/PhotoDTO';
import {GalleryLightboxMediaComponent} from '../media/media.lightbox.gallery.component';
import {Config} from '../../../../../../common/config/public/Config';
import {SearchQueryTypes, TextSearch, TextSearchQueryMatchTypes,} from '../../../../../../common/entities/SearchQueryDTO';
import {AuthenticationService} from '../../../../model/network/authentication.service';
import {LightboxService} from '../lightbox.service';
import {GalleryCacheService} from '../../cache.gallery.service';
import {Utils} from '../../../../../../common/Utils';
import {FileSizePipe} from '../../../../pipes/FileSizePipe';
import {DatePipe} from '@angular/common';
import {LightBoxTitleTexts} from '../../../../../../common/config/public/ClientConfig';


@Component({
  selector: 'app-lightbox-controls',
  styleUrls: ['./controls.lightbox.gallery.component.css', './inputrange.css'],
  templateUrl: './controls.lightbox.gallery.component.html',
})
export class ControlsLightboxComponent implements OnDestroy, OnInit, OnChanges {
  readonly MAX_ZOOM = 10;
  @ViewChild('canvas')
  canvas: ElementRef<HTMLCanvasElement>;
  private ctx: CanvasRenderingContext2D;

  @ViewChild('root', {static: false}) root: ElementRef;
  @Output() closed = new EventEmitter();
  @Output() toggleInfoPanel = new EventEmitter();
  @Output() toggleFullScreen = new EventEmitter();
  @Output() nextPhoto = new EventEmitter();
  @Output() previousPhoto = new EventEmitter();
  @Output() togglePlayback = new EventEmitter<boolean>();

  @Input() navigation = {hasPrev: true, hasNext: true};
  @Input() activePhoto: GalleryPhotoComponent;
  @Input() mediaElement: GalleryLightboxMediaComponent;
  @Input() photoFrameDim = {width: 1, height: 1, aspect: 1};
  @Input() slideShowRunning: boolean;

  public readonly facesEnabled = Config.Faces.enabled;

  public zoom = 1;
  public playBackDurations = [1, 2, 5, 10, 15, 20, 30, 60];
  public selectedSlideshowSpeed: number = null;
  public controllersDimmed = false;

  public controllersVisible = true;
  public drag = {x: 0, y: 0};
  public SearchQueryTypes = SearchQueryTypes;
  public faceContainerDim = {width: 0, height: 0};
  public searchEnabled: boolean;

  private visibilityTimer: number = null;
  private timerSub: Subscription;
  private prevDrag = {x: 0, y: 0};
  private prevZoom = 1;

  constructor(
    public lightboxService: LightboxService,
    public fullScreenService: FullScreenService,
    private authService: AuthenticationService,
    private cacheService: GalleryCacheService,
    private fileSizePipe: FileSizePipe,
    private datePipe: DatePipe
  ) {
    this.searchEnabled = this.authService.canSearch();
  }


  public get Zoom(): number {
    return this.zoom;
  }

  public set Zoom(zoom: number) {
    if (!this.activePhoto || this.activePhoto.gridMedia.isVideo()) {
      return;
    }
    if (zoom < 1) {
      zoom = 1;
    }
    if (zoom > this.MAX_ZOOM) {
      zoom = this.MAX_ZOOM;
    }
    if (this.zoom === zoom) {
      return;
    }
    this.stopSlideShow();
    this.drag.x = (this.drag.x / this.zoom) * zoom;
    this.drag.y = (this.drag.y / this.zoom) * zoom;
    this.prevDrag.x = this.drag.x;
    this.prevDrag.y = this.drag.y;
    this.zoom = zoom;
    this.showControls();
    this.checkZoomAndDrag();
  }

  public containerWidth(): void {
    return this.root.nativeElement.width;
  }

  ngOnInit(): void {
    if (this.cacheService.getSlideshowSpeed()) {
      this.selectedSlideshowSpeed = this.cacheService.getSlideshowSpeed();
    } else {
      this.selectedSlideshowSpeed = Config.Gallery.Lightbox.defaultSlideshowSpeed;
    }
  }

  ngOnDestroy(): void {
    this.stopSlideShow();

    if (this.visibilityTimer != null) {
      clearTimeout(this.visibilityTimer);
      this.visibilityTimer = null;
    }
  }

  ngOnChanges(): void {
    this.updateFaceContainerDim();
    if (this.slideShowRunning) {
      this.runSlideShow();
    }
  }

  pan($event: { deltaY: number; deltaX: number; isFinal: boolean }): void {
    if (!this.activePhoto || this.activePhoto.gridMedia.isVideo()) {
      return;
    }
    if (this.zoom === 1) {
      return;
    }
    this.drag.x = this.prevDrag.x + $event.deltaX;
    this.drag.y = this.prevDrag.y + $event.deltaY;
    this.showControls();
    this.checkZoomAndDrag();
    if ($event.isFinal) {
      this.prevDrag = {
        x: this.drag.x,
        y: this.drag.y,
      };
    }
  }

  wheel($event: { deltaX: number, deltaY: number }): void {
    if (!this.activePhoto) {
      return;
    }
    if ($event.deltaX < 0) {
      if (this.navigation.hasPrev) {
        this.previousPhoto.emit();
      }
    } else if ($event.deltaX > 0) {
      if (this.navigation.hasNext) {
        this.nextMediaManuallyTriggered();
      }
    }
    if (this.activePhoto.gridMedia.isVideo()) {
      return;
    }
    if ($event.deltaY < 0) {
      this.zoomIn();
    } else if ($event.deltaY > 0) {
      this.zoomOut();
    }
  }

  @HostListener('pinch', ['$event'])
  pinch($event: { scale: number }): void {
    if (!this.activePhoto || this.activePhoto.gridMedia.isVideo()) {
      return;
    }
    this.showControls();
    this.Zoom = this.prevZoom * $event.scale;
  }

  @HostListener('pinchend', ['$event'])
  pinchend($event: { scale: number }): void {
    if (!this.activePhoto || this.activePhoto.gridMedia.isVideo()) {
      return;
    }
    this.showControls();
    this.Zoom = this.prevZoom * $event.scale;
    this.prevZoom = this.zoom;
  }

  tap($event: Event): void {
    if (!this.activePhoto || this.activePhoto.gridMedia.isVideo()) {
      return;
    }
    if (($event as unknown as { tapCount: number }).tapCount < 2) {
      return;
    }

    this.showControls();
    if (this.zoom > 1) {
      this.Zoom = 1;
      this.prevZoom = this.zoom;
      return;
    } else {
      this.Zoom = 5;
      this.prevZoom = this.zoom;
      return;
    }
  }

  zoomIn(): void {
    this.showControls();
    this.Zoom = this.zoom + this.zoom / 10;
  }

  zoomOut(): void {
    this.showControls();
    this.Zoom = this.zoom - this.zoom / 10;
  }

  @HostListener('window:keydown', ['$event'])
  onKeyPress(event: KeyboardEvent): void {
    switch (event.key) {
      case 'ArrowLeft':
        if (this.navigation.hasPrev) {
          this.previousPhoto.emit();
        }
        break;
      case 'ArrowRight':
        if (this.navigation.hasNext) {
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
        this.lightboxService.captionAlwaysOn = !this.lightboxService.captionAlwaysOn;
        break;
      case 'a':
      case 'A':
        this.lightboxService.facesAlwaysOn = !this.lightboxService.facesAlwaysOn;
        break;
      case 'l':
      case 'L':
        this.lightboxService.loopVideos = !this.lightboxService.loopVideos;
        break;
      case 'd':
      case 'D':
        if (event.shiftKey) {
          const link = document.createElement('a');
          link.setAttribute('type', 'hidden');
          link.href = this.activePhoto.gridMedia.getOriginalMediaPath();
          link.download = this.activePhoto.gridMedia.media.name;
          document.body.appendChild(link);
          link.click();
          link.remove();
        }
        break;
      case 'Escape': // escape
        this.closed.emit();
        break;
      case ' ': // space
        if (this.activePhoto && this.activePhoto.gridMedia.isVideo()) {
          this.mediaElement.playPause();
        }
        break;
    }
  }

  private showNextMedia = () => {
    if (this.mediaElement.imageLoadFinished.this === false ||
      this.mediaElement.imageLoadFinished.next === false) {
      return;
    }
    // do not skip video if its playing
    if (
      this.activePhoto &&
      this.activePhoto.gridMedia.isVideo() &&
      !this.mediaElement.Paused
    ) {
      return;
    }
    this.nextPhoto.emit();
  };

  private drawSliderProgress(t: number) {
    let p = 0;

    // Video is a special snowflake. It won't go to next media if a video is playing
    if (!(this.activePhoto &&
      this.activePhoto.gridMedia.isVideo() &&
      !this.mediaElement.Paused)) {
      p = (t % (this.selectedSlideshowSpeed * 10)) / this.selectedSlideshowSpeed / 10;  // ticks every 100 ms

    }
    if (!this.canvas) {
      return;
    }
    if (!this.ctx) {
      this.ctx = this.canvas.nativeElement.getContext('2d');
    }

    this.ctx.lineWidth = 5;
    this.ctx.strokeStyle = 'white';
    this.ctx.lineCap = 'round';
    this.ctx.clearRect(0, 0, this.canvas.nativeElement.width, this.canvas.nativeElement.height);
    this.ctx.beginPath();
    this.ctx.arc(this.canvas.nativeElement.width / 2, this.canvas.nativeElement.height / 2, this.canvas.nativeElement.width / 2 - this.ctx.lineWidth, 0, p * 2 * Math.PI);

    this.ctx.stroke();
  }

  private resetSlideshowTimer(): void {
    if (this.slideShowRunning === true) {
      this.stopSlideShow();
      this.runSlideShow();
    }
  }

  public runSlideShow(): void {
    //timer already running, do not reset it.
    if (this.timerSub) {
      return;
    }
    this.stopSlideShow();
    this.drawSliderProgress(0);
    this.timerSub = interval(100)
      .pipe(filter((t) => {
        this.drawSliderProgress(t);
        return t % (this.selectedSlideshowSpeed * 10) === 0; // ticks every 100 ms
      }))
      .pipe(skip(1)) // do not skip to next photo right away
      .subscribe(this.showNextMedia);
  }

  public slideshowSpeedChanged() {
    this.cacheService.setSlideshowSpeed(this.selectedSlideshowSpeed);
  }

  @HostListener('mousemove')
  onMouseMove(): void {
    this.showControls();
  }

  public stopSlideShow(): void {
    if (this.timerSub != null) {
      this.timerSub.unsubscribe();
      this.timerSub = null;
    }
    this.ctx = null;
  }

  playClicked() {
    this.togglePlayback.emit(true);
  }

  pauseClicked() {
    this.togglePlayback.emit(false);
  }

  resetZoom(): void {
    this.Zoom = 1;
  }

  onResize(): void {
    this.checkZoomAndDrag();
  }

  public closeLightbox(): void {
    this.hideControls();
    this.closed.emit();
  }

  getPersonSearchQuery(name: string): string {
    return JSON.stringify({
      type: SearchQueryTypes.person,
      matchType: TextSearchQueryMatchTypes.exact_match,
      text: name,
    } as TextSearch);
  }

  private checkZoomAndDrag(): void {
    const fixDrag = (drag: { x: number; y: number }) => {
      if (this.zoom === 1) {
        drag.y = 0;
        drag.x = 0;
        return;
      }
      if (!this.activePhoto) {
        return;
      }

      const photoAspect = MediaDTOUtils.calcAspectRatio(
        this.activePhoto.gridMedia.media
      );
      const widthFilled = photoAspect > this.photoFrameDim.aspect;
      const divWidth = this.photoFrameDim.width;
      const divHeight = this.photoFrameDim.height;
      const size = {
        width: (widthFilled ? divWidth : divHeight * photoAspect) * this.zoom,
        height: (widthFilled ? divWidth / photoAspect : divHeight) * this.zoom,
      };

      const widthDrag = Math.abs(divWidth - size.width) / 2;
      const heightDrag = Math.abs(divHeight - size.height) / 2;

      if (divWidth > size.width) {
        drag.x = 0;
      }
      if (divHeight > size.height) {
        drag.y = 0;
      }

      if (drag.x < -widthDrag) {
        drag.x = -widthDrag;
      }
      if (drag.x > widthDrag) {
        drag.x = widthDrag;
      }
      if (drag.y < -heightDrag) {
        drag.y = -heightDrag;
      }
      if (drag.y > heightDrag) {
        drag.y = heightDrag;
      }
    };
    if (this.zoom < 1) {
      this.zoom = 1;
    }
    if (this.zoom > this.MAX_ZOOM) {
      this.zoom = this.MAX_ZOOM;
    }
    fixDrag(this.drag);
    fixDrag(this.prevDrag);
  }

  private showControls(): void {
    this.controllersDimmed = false;
    if (this.visibilityTimer != null) {
      clearTimeout(this.visibilityTimer);
    }
    this.visibilityTimer = window.setTimeout(this.hideControls, 2000);
  }

  private hideControls = () => {
    this.controllersDimmed = true;
  };

  private updateFaceContainerDim(): void {
    if (!this.activePhoto) {
      return;
    }

    const photoAspect = MediaDTOUtils.calcAspectRatio(
      this.activePhoto.gridMedia.media
    );

    if (photoAspect < this.photoFrameDim.aspect) {
      this.faceContainerDim.height = this.photoFrameDim.height;
      this.faceContainerDim.width = this.photoFrameDim.height * photoAspect;
    } else {
      this.faceContainerDim.height = this.photoFrameDim.width / photoAspect;
      this.faceContainerDim.width = this.photoFrameDim.width;
    }
  }

  nextMediaManuallyTriggered() {
    this.resetSlideshowTimer();
    this.nextPhoto.emit();
  }


  getText(type: LightBoxTitleTexts): string {
    if (!this.activePhoto?.gridMedia?.media) {
      return null;
    }
    const m = this.activePhoto.gridMedia.media as PhotoDTO;
    switch (type) {
      case LightBoxTitleTexts.file:
        return Utils.concatUrls(
          m.directory.path,
          m.directory.name,
          m.name
        );
      case LightBoxTitleTexts.resolution:
        return `${m.metadata.size.width}x${m.metadata.size.height}`;
      case LightBoxTitleTexts.size:
        return this.fileSizePipe.transform(m.metadata.fileSize);
      case LightBoxTitleTexts.title:
        return m.metadata.title;
      case LightBoxTitleTexts.caption:
        return m.metadata.caption;
      case LightBoxTitleTexts.keywords:
        return m.metadata.keywords.join(', ');
      case LightBoxTitleTexts.persons:
        return m.metadata.faces?.map(f => f.name)?.join(', ');
      case LightBoxTitleTexts.date:
        return this.datePipe.transform(Utils.getTimeMS(m.metadata.creationDate, m.metadata.creationDateOffset, Config.Gallery.ignoreTimestampOffset) , 'longDate', 'UTC');
      case LightBoxTitleTexts.location:
        if (!m.metadata.positionData) {
          return '';
        }
        return [
          m.metadata.positionData.city,
          m.metadata.positionData.state,
          m.metadata.positionData.country
        ].filter(elm => elm).join(', ').trim(); //Filter removes empty elements, join concats the values separated by ', '
      case LightBoxTitleTexts.camera:
        return m.metadata.cameraData?.model;
      case LightBoxTitleTexts.lens:
        return m.metadata.cameraData?.lens;
      case LightBoxTitleTexts.iso:
        return m.metadata.cameraData?.ISO.toString();
      case LightBoxTitleTexts.fstop:
        if (m.metadata.cameraData?.fStop > 1) {
          return m.metadata.cameraData?.fStop.toString();
        }
        return '1/' + Math.round(1 / m.metadata.cameraData?.fStop);
      case LightBoxTitleTexts.focal_length:
        return m.metadata.cameraData?.focalLength.toString();
    }
    return null;
  }

  get TopLeftTitle(): string {
    return this.getText(Config.Gallery.Lightbox.Titles.topLeftTitle);
  }

  get TopLeftSubtitle(): string {
    return this.getText(Config.Gallery.Lightbox.Titles.topLeftSubtitle);
  }

  get BottomLeftTitle(): string {
    return this.getText(Config.Gallery.Lightbox.Titles.bottomLeftTitle);
  }

  get BottomLeftSubtitle(): string {
    return this.getText(Config.Gallery.Lightbox.Titles.bottomLeftSubtitle);
  }

}
