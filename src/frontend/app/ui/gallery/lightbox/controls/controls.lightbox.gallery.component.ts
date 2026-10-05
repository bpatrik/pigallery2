import {Component, ElementRef, EventEmitter, HostListener, Input, type OnChanges, type OnDestroy, Output, ViewChild, ChangeDetectionStrategy} from '@angular/core';
import {MediaDTOUtils} from '../../../../../../common/entities/MediaDTO';
import {FullScreenService} from '../../fullscreen.service';
import {type LightboxItem} from '../LightboxSource';
import {interval, Subscription} from 'rxjs';
import {filter, skip} from 'rxjs/operators';
import {type PhotoDTO} from '../../../../../../common/entities/PhotoDTO';
import {GalleryLightboxMediaComponent} from '../media/media.lightbox.gallery.component';
import {Config} from '../../../../../../common/config/public/Config';
import {SearchQueryTypes, type TextSearch, TextSearchQueryMatchTypes,} from '../../../../../../common/entities/SearchQueryDTO';
import {AuthenticationService} from '../../../../model/network/authentication.service';
import {LightboxService} from '../lightbox.service';
import {Utils} from '../../../../../../common/Utils';
import {FileSizePipe} from '../../../../pipes/FileSizePipe';
import { DatePipe } from '@angular/common';
import {LightBoxTitleTexts} from '../../../../../../common/config/public/ClientConfig';
import {NgIconComponent} from '@ng-icons/core';
import {BsDropdownDirective, BsDropdownMenuDirective, BsDropdownToggleDirective} from 'ngx-bootstrap/dropdown';
import {FormsModule} from '@angular/forms';
import {RouterLink} from '@angular/router';
import {SearchQueryUtils} from '../../../../../../common/SearchQueryUtils';
import {LightboxGesturesDirective} from './lightbox-gestures.directive';


@Component({
  selector: 'app-lightbox-controls',
  styleUrls: ['./controls.lightbox.gallery.component.css', './inputrange.css'],
  templateUrl: './controls.lightbox.gallery.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [
    LightboxGesturesDirective,
    NgIconComponent,
    BsDropdownDirective,
    BsDropdownToggleDirective,
    BsDropdownMenuDirective,
    FormsModule,
    RouterLink
]
})
export class ControlsLightboxComponent implements OnDestroy, OnChanges {
  readonly MAX_ZOOM = 10;
  @ViewChild('canvas')
  canvas: ElementRef<HTMLCanvasElement>;
  @ViewChild('root', {static: false}) root: ElementRef;
  @Output() closed = new EventEmitter();
  @Output() toggleInfoPanel = new EventEmitter();
  @Output() toggleFullScreen = new EventEmitter();
  @Output() nextPhoto = new EventEmitter();
  @Output() previousPhoto = new EventEmitter();
  @Input() navigation = {hasPrev: true, hasNext: true};
  @Input() activePhoto: LightboxItem;
  @Input() mediaElement: GalleryLightboxMediaComponent;
  @Input() photoFrameDim = {width: 1, height: 1, aspect: 1};
  @Input() slideShowRunning: boolean;
  public readonly facesEnabled = Config.Faces.enabled;
  public zoom = 1;
  public playBackDurations = [1, 2, 5, 10, 15, 20, 30, 60];
  public controllersDimmed = false;
  public drag = {x: 0, y: 0};
  public SearchQueryTypes = SearchQueryTypes;
  public faceContainerDim = {width: 0, height: 0};
  public searchEnabled: boolean;
  private ctx: CanvasRenderingContext2D;
  private visibilityTimer: number = null;
  private timerSub: Subscription;
  private prevDrag = {x: 0, y: 0};
  private prevZoom = 1;

  constructor(
    public lightboxService: LightboxService,
    public fullScreenService: FullScreenService,
    private authService: AuthenticationService,
    private fileSizePipe: FileSizePipe,
    private datePipe: DatePipe
  ) {
    this.controllersDimmed = this.lightboxService.controllersDimmed;
    this.searchEnabled = this.authService.canSearch();
    if(this.playBackDurations.indexOf(this.lightboxService.slideshowSpeed) === -1) {
      this.playBackDurations.push(this.lightboxService.slideshowSpeed);
      this.playBackDurations.sort((a, b) => a - b);
    }
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

  get TopLeftTitle(): string {
    return this.getText(this.lightboxService.topLeftTitle);
  }

  get TopLeftSubtitle(): string {
    return this.getText(this.lightboxService.topLeftSubtitle);
  }

  get BottomLeftTitle(): string {
    return this.getText(this.lightboxService.bottomLeftTitle);
  }

  get BottomLeftSubtitle(): string {
    return this.getText(this.lightboxService.bottomLeftSubtitle);
  }

  public containerWidth(): void {
    return this.root.nativeElement.width;
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

  pinchstart(): void {
    this.prevZoom = this.zoom;
  }

  pinch($event: { scale: number }): void {
    if (!this.activePhoto || this.activePhoto.gridMedia.isVideo()) {
      return;
    }
    this.showControls();
    this.Zoom = this.prevZoom * $event.scale;
  }

  pinchend($event: { scale: number }): void {
    if (!this.activePhoto || this.activePhoto.gridMedia.isVideo()) {
      return;
    }
    this.showControls();
    this.Zoom = this.prevZoom * $event.scale;
    this.prevZoom = this.zoom;
  }

  tap($event: {tapCount: number}): void {
    if (!this.activePhoto) {
      return;
    }
    if (this.activePhoto.gridMedia.isVideo()) {
      this.mediaElement.playPause();
      return;
    }
    if ($event.tapCount < 2) {
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
        return t % (this.lightboxService.slideshowSpeed * 10) === 0; // ticks every 100 ms
      }))
      .pipe(skip(1)) // do not skip to next photo right away
      .subscribe(this.showNextMedia);
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
    this.lightboxService.playback = true;
  }

  pauseClicked() {
    this.lightboxService.playback = false;
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
    return SearchQueryUtils.urlify({
      type: SearchQueryTypes.person,
      matchType: TextSearchQueryMatchTypes.exact_match,
      value: name,
    } as TextSearch);
  }

  nextMediaManuallyTriggered() {
    this.resetSlideshowTimer();
    this.nextPhoto.emit();
  }

  getText(type: LightBoxTitleTexts[]): string {
    if (!this.activePhoto?.gridMedia?.media) {
      return null;
    }
    const m = this.activePhoto.gridMedia.media as PhotoDTO;
    let retTexts = [];
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
          retTexts.push(this.fileSizePipe.transform(m.metadata.fileSize));
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
        case LightBoxTitleTexts.date:
          const isThisYear = MediaDTOUtils.createdThisYear(m);
          retTexts.push(this.datePipe.transform(Utils.getTimeMS(m.metadata.creationDate, m.metadata.creationDateOffset, Config.Gallery.ignoreTimestampOffset), isThisYear ? 'MMMM d' : 'longDate', 'UTC'));
          break;
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
        case LightBoxTitleTexts.fstop:
          if (m.metadata.cameraData?.fStop > 1) {
            retTexts.push(m.metadata.cameraData?.fStop?.toString());
            break;
          }
          retTexts.push('1/' + Math.round(1 / m.metadata.cameraData?.fStop));
          break;
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
    if (!this.navigation.hasNext) {
      this.pauseClicked();
      return;
    }
    if (!this.mediaElement.isRenderedMediaLoaded() ||
      !this.mediaElement.isNextMediaLoaded()) {
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
      p = (t % (this.lightboxService.slideshowSpeed * 10)) / this.lightboxService.slideshowSpeed / 10;  // ticks every 100 ms

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

}
