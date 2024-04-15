import {ChangeDetectorRef, Component, ElementRef, HostListener, OnDestroy, OnInit, QueryList, ViewChild,} from '@angular/core';
import {GalleryPhotoComponent} from '../grid/photo/photo.grid.gallery.component';
import {Dimension, DimensionUtils} from '../../../model/IRenderable';
import {FullScreenService} from '../fullscreen.service';
import {OverlayService} from '../overlay.service';
import {animate, AnimationBuilder, AnimationPlayer, style,} from '@angular/animations';
import {GalleryLightboxMediaComponent} from './media/media.lightbox.gallery.component';
import {Subscription} from 'rxjs';
import {ActivatedRoute, Params, Router} from '@angular/router';
import {PageHelper} from '../../../model/page.helper';
import {QueryService} from '../../../model/query.service';
import {MediaDTO} from '../../../../../common/entities/MediaDTO';
import {QueryParams} from '../../../../../common/QueryParams';
import {PhotoDTO} from '../../../../../common/entities/PhotoDTO';
import {ControlsLightboxComponent} from './controls/controls.lightbox.gallery.component';
import {SupportedFormats} from '../../../../../common/SupportedFormats';
import {GridMedia} from '../grid/GridMedia';
import {PiTitleService} from '../../../model/pi-title.service';

export enum LightboxStates {
  Open = 1,
  Opening = 2,
  Closing = 3,
  Closed = 4,
}

@Component({
  selector: 'app-gallery-lightbox',
  styleUrls: ['./lightbox.gallery.component.css'],
  templateUrl: './lightbox.gallery.component.html',
})
export class GalleryLightboxComponent implements OnDestroy, OnInit {
  @ViewChild('photo', { static: true })
  mediaElement: GalleryLightboxMediaComponent;
  @ViewChild('controls', { static: false }) controls: ControlsLightboxComponent;
  @ViewChild('lightbox', { static: false }) lightboxElement: ElementRef;
  @ViewChild('root', { static: false }) root: ElementRef;

  public navigation = { hasPrev: true, hasNext: true };
  public blackCanvasOpacity = 0;
  public activePhoto: GalleryPhotoComponent;
  public status: LightboxStates = LightboxStates.Closed;
  public infoPanelVisible = false;
  public infoPanelWidth = 0;
  private infoPanelMaxWidth = 400;
  public animating = false;
  public photoFrameDim = { width: 1, height: 1, aspect: 1 };
  public videoSourceError = false;
  public transcodeNeedVideos = SupportedFormats.TranscodeNeed.Videos;
  private startPhotoDimension: Dimension = {
    top: 0,
    left: 0,
    width: 0,
    height: 0,
  } as Dimension;
  private iPvisibilityTimer: number = null;
  private visibilityTimer: number = null;
  private delayedMediaShow: string = null;
  private activePhotoId: number = null;
  private gridPhotoQL: QueryList<GalleryPhotoComponent>;
  private subscription: {
    photosChange: Subscription;
    route: Subscription;
  } = {
    photosChange: null,
    route: null,
  };
  slideShowRunning: boolean;

  constructor(
    public fullScreenService: FullScreenService,
    private changeDetector: ChangeDetectorRef,
    private overlayService: OverlayService,
    private builder: AnimationBuilder,
    private router: Router,
    private queryService: QueryService,
    private route: ActivatedRoute,
    private piTitleService: PiTitleService
  ) {
  }

  get Title(): string {
    if (!this.activePhoto) {
      return null;
    }
    return (this.activePhoto.gridMedia.media as PhotoDTO).metadata.caption;
  }

  public toggleFullscreen(): void {
    if (this.fullScreenService.isFullScreenEnabled()) {
      this.fullScreenService.exitFullScreen();
    } else {
      this.fullScreenService.showFullScreen(this.root.nativeElement);
    }
  }

  private updateInfoPanelWidth() {
    this.infoPanelMaxWidth = Math.min(400, Math.ceil(window.innerWidth + 1));
    if ((window.innerWidth - this.infoPanelMaxWidth) < this.infoPanelMaxWidth * 0.3) {
      this.infoPanelMaxWidth = Math.ceil(window.innerWidth + 1);
    }
  }

  ngOnInit(): void {
    this.infoPanelMaxWidth = 1000;
    this.updatePhotoFrameDim();
    this.subscription.route = this.route.queryParams.subscribe(
      (params: Params) => {
        const validPhoto = params[QueryParams.gallery.photo] &&
          params[QueryParams.gallery.photo] !== '';


        if (params[QueryParams.gallery.playback]) {
          this.runSlideShow();
        } else {
          this.stopSlideShow();
        }

        this.delayedMediaShow = null;
        if (validPhoto
        ) {
          this.delayedMediaShow = params[QueryParams.gallery.photo];
          // photos are not yet available to show
          if (!this.gridPhotoQL) {
            return;
          }
          this.onNavigateTo(params[QueryParams.gallery.photo]);
        } else if (this.status === LightboxStates.Open) {
          this.delayedMediaShow = null;
          this.hideLightbox();
        }


      }
    );
  }

  private runSlideShow() {
    if (!this.activePhoto && this.gridPhotoQL?.length > 0) {
      this.navigateToPhoto(0);
    }
    this.slideShowRunning = true;
    this.controls?.runSlideShow();
  }

  private stopSlideShow() {
    this.slideShowRunning = false;
    this.controls?.stopSlideShow();
  }

  ngOnDestroy(): void {
    if (this.controls) {
      this.controls.stopSlideShow();
    }
    if (this.subscription.photosChange != null) {
      this.subscription.photosChange.unsubscribe();
    }
    if (this.subscription.route != null) {
      this.subscription.route.unsubscribe();
    }

    if (this.visibilityTimer != null) {
      clearTimeout(this.visibilityTimer);
    }
    if (this.iPvisibilityTimer != null) {
      clearTimeout(this.iPvisibilityTimer);
    }
  }

  onNavigateTo(photoStringId: string): string {
    if (
      this.activePhoto &&
      this.queryService.getMediaStringId(this.activePhoto.gridMedia.media) ===
      photoStringId
    ) {
      return;
    }

    if (this.controls) {
      this.controls.resetZoom();
    }
    const photo = this.gridPhotoQL.find(
      (i): boolean =>
        this.queryService.getMediaStringId(i.gridMedia.media) === photoStringId
    );
    if (!photo) {
      return (this.delayedMediaShow = photoStringId);
    }
    if (this.status === LightboxStates.Closed) {
      this.showLigthbox(photo.gridMedia.media);
    } else {
      this.showPhoto(this.gridPhotoQL.toArray().indexOf(photo));
    }
    this.delayedMediaShow = null;
  }

  setGridPhotoQL(value: QueryList<GalleryPhotoComponent>): void {
    if (this.subscription.photosChange != null) {
      this.subscription.photosChange.unsubscribe();
    }
    this.gridPhotoQL = value;
    this.subscription.photosChange = this.gridPhotoQL.changes.subscribe(
      (): void => {
        if (
          this.activePhotoId != null &&
          this.gridPhotoQL.length > this.activePhotoId
        ) {
          this.updateActivePhoto(this.activePhotoId);
        }
        if (this.delayedMediaShow) {
          this.onNavigateTo(this.delayedMediaShow);
        }
        if (this.slideShowRunning) {
          this.runSlideShow();
        }
      }
    );

    if (this.delayedMediaShow) {
      this.onNavigateTo(this.delayedMediaShow);
    }
    if (this.slideShowRunning) {
      this.runSlideShow();
    }
  }

  @HostListener('window:resize', ['$event'])
  onResize(): void {
    this.updatePhotoFrameDim();
    if (this.activePhoto) {
      this.animateLightbox();
      this.updateActivePhoto(this.activePhotoId);
    }
  }

  public nextImage(): void {
    if (this.activePhotoId + 1 < this.gridPhotoQL.length) {
      this.navigateToPhoto(this.activePhotoId + 1);
    } else {
      this.navigateToPhoto(0);
    }
  }

  public prevImage(): void {
    if (this.controls) {
      this.controls.stopSlideShow();
    }
    if (this.activePhotoId > 0) {
      this.navigateToPhoto(this.activePhotoId - 1);
    }
  }

  public showLigthbox(photo: MediaDTO): void {
    if (this.controls) {
      this.controls.resetZoom();
    }
    this.status = LightboxStates.Opening;
    const selectedPhoto = this.findPhotoComponent(photo);
    if (selectedPhoto === null) {
      throw new Error('Can\'t find Photo');
    }

    const lightboxDimension = selectedPhoto.getDimension();
    lightboxDimension.top -= PageHelper.ScrollY;
    this.animating = true;
    this.animatePhoto(
      selectedPhoto.getDimension(),
      this.calcLightBoxPhotoDimension(selectedPhoto.gridMedia.media)
    ).onDone((): void => {
      this.animating = false;
      this.status = LightboxStates.Open;
    });
    this.animateLightbox(lightboxDimension, {
      top: 0,
      left: 0,
      width: this.photoFrameDim.width,
      height: this.photoFrameDim.height,
    } as Dimension);

    this.blackCanvasOpacity = 0;
    this.startPhotoDimension = selectedPhoto.getDimension();
    // disable scroll
    this.overlayService.showOverlay();
    this.blackCanvasOpacity = 1.0;
    this.showPhoto(this.gridPhotoQL.toArray().indexOf(selectedPhoto), false);
    this.piTitleService.setMediaTitle(selectedPhoto.gridMedia);
  }

  public hide(): void {
    this.router
      .navigate([], { queryParams: this.queryService.getParams() })
      .then(() => {
        this.piTitleService.setLastNonMedia();
      })
      .catch(console.error);

  }

  animatePhoto(from: Dimension, to: Dimension = from): AnimationPlayer {
    const elem = this.builder
      .build([
        style(DimensionUtils.toString(from)),
        animate('0.2s ease-in-out', style(DimensionUtils.toString(to))),
      ])
      .create(this.mediaElement.elementRef.nativeElement);
    elem.play();

    return elem;
  }

  animateLightbox(
    from: Dimension = {
      top: 0,
      left: 0,
      width: this.photoFrameDim.width,
      height: this.photoFrameDim.height,
    } as Dimension,
    to: Dimension = from
  ): AnimationPlayer {
    const elem = this.builder
      .build([
        style(DimensionUtils.toString(from)),
        animate('0.2s ease-in-out', style(DimensionUtils.toString(to))),
      ])
      .create(this.lightboxElement.nativeElement);
    elem.play();
    return elem;
  }

  public toggleInfoPanel(): void {
    if (this.infoPanelWidth !== this.infoPanelMaxWidth) {
      this.showInfoPanel();
    } else {
      this.hideInfoPanel();
    }
  }

  hideInfoPanel(enableAnimate = true): void {
    this.iPvisibilityTimer = window.setTimeout((): void => {
      this.iPvisibilityTimer = null;
      this.infoPanelVisible = false;
    }, 1000);

    const starPhotoPos = this.calcLightBoxPhotoDimension(
      this.activePhoto.gridMedia.media
    );
    this.infoPanelWidth = 0;
    this.updatePhotoFrameDim();
    const endPhotoPos = this.calcLightBoxPhotoDimension(
      this.activePhoto.gridMedia.media
    );
    if (enableAnimate) {
      this.animatePhoto(starPhotoPos, endPhotoPos);
    }
    if (enableAnimate) {
      this.animateLightbox(
        {
          top: 0,
          left: 0,
          width: Math.max(this.photoFrameDim.width - this.infoPanelMaxWidth, 0),
          height: this.photoFrameDim.height,
        } as Dimension,
        {
          top: 0,
          left: 0,
          width: this.photoFrameDim.width,
          height: this.photoFrameDim.height,
        } as Dimension
      );
    }
  }

  isInfoPanelAnimating(): boolean {
    return this.iPvisibilityTimer != null;
  }

  showInfoPanel(): void {
    this.updateInfoPanelWidth();
    this.infoPanelVisible = true;

    const starPhotoPos = this.calcLightBoxPhotoDimension(
      this.activePhoto.gridMedia.media
    );
    this.infoPanelWidth = this.infoPanelMaxWidth;
    this.updatePhotoFrameDim();
    const endPhotoPos = this.calcLightBoxPhotoDimension(
      this.activePhoto.gridMedia.media
    );
    this.animatePhoto(starPhotoPos, endPhotoPos);
    this.animateLightbox(
      {
        top: 0,
        left: 0,
        width: this.photoFrameDim.width + this.infoPanelMaxWidth,
        height: this.photoFrameDim.height,
      } as Dimension,
      {
        top: 0,
        left: 0,
        width: this.photoFrameDim.width,
        height: this.photoFrameDim.height,
      } as Dimension
    );
    if (this.iPvisibilityTimer != null) {
      clearTimeout(this.iPvisibilityTimer);
    }

    if (this.controls) {
      this.controls.resetZoom();
    }
  }

  public isVisible(): boolean {
    return this.status !== LightboxStates.Closed;
  }

  public isOpen(): boolean {
    return this.status === LightboxStates.Open;
  }

  onVideoSourceError(): void {
    this.videoSourceError = true;
  }

  private updatePhotoFrameDim = (): void => {
    this.photoFrameDim = {
      width: Math.max(
        window.innerWidth - this.infoPanelWidth,
        0
      ),
      height: window.innerHeight,
      aspect: 0
    };
    this.photoFrameDim.aspect =
      Math.round((this.photoFrameDim.width / this.photoFrameDim.height) * 100) /
      100;
  };

  private navigateToPhoto(photoIndex: number): void {
    this.router
      .navigate([], {
        queryParams: this.queryService.getParams(
          {media: this.gridPhotoQL.get(photoIndex).gridMedia.media, playing: this.slideShowRunning}
        ), replaceUrl: true
      })
      .then(() => {
        this.piTitleService.setMediaTitle(this.gridPhotoQL.get(photoIndex).gridMedia);
      })
      .catch(console.error);
  }

  private showPhoto(photoIndex: number, resize = true): void {
    this.activePhoto = null;
    this.changeDetector.detectChanges();
    this.updateActivePhoto(photoIndex, resize);
  }

  private hideLightbox(): void {
    if (this.controls) {
      this.controls.resetZoom();
    }
    this.status = LightboxStates.Closing;
    this.fullScreenService.exitFullScreen();

    if (this.controls) {
      this.controls.stopSlideShow();
    }

    this.animating = true;
    const lightboxDimension = this.activePhoto.getDimension();
    lightboxDimension.top -= PageHelper.ScrollY;
    this.blackCanvasOpacity = 0;

    this.animatePhoto(
      this.calcLightBoxPhotoDimension(this.activePhoto.gridMedia.media),
      this.activePhoto.getDimension()
    );
    this.animateLightbox(
      {
        top: 0,
        left: 0,
        width: this.photoFrameDim.width,
        height: this.photoFrameDim.height,
      } as Dimension,
      lightboxDimension
    ).onDone((): void => {
      this.status = LightboxStates.Closed;
      this.activePhoto = null;
      this.activePhotoId = null;
      this.overlayService.hideOverlay();
    });

    this.hideInfoPanel(false);
  }

  private updateActivePhoto(photoIndex: number, resize = true): void {
    if (photoIndex < 0 || photoIndex >= this.gridPhotoQL.length) {
      throw new Error('Can\'t find the media');
    }
    this.videoSourceError = false;
    this.activePhotoId = photoIndex;
    this.activePhoto = this.gridPhotoQL.get(photoIndex);

    if (resize) {
      this.animatePhoto(
        this.calcLightBoxPhotoDimension(this.activePhoto.gridMedia.media)
      );
    }
    this.navigation.hasPrev = photoIndex > 0;
    this.navigation.hasNext = photoIndex + 1 < this.gridPhotoQL.length;

    const to = this.activePhoto.getDimension();

    // if target image out of screen -> scroll to there
    if (
      PageHelper.ScrollY > to.top ||
      PageHelper.ScrollY + this.photoFrameDim.height < to.top
    ) {
      PageHelper.ScrollY = to.top;
    }
  }

  private findPhotoComponent(media: MediaDTO): GalleryPhotoComponent {
    const galleryPhotoComponents = this.gridPhotoQL.toArray();
    for (const item of galleryPhotoComponents) {
      if (item.gridMedia.media === media) {
        return item;
      }
    }
    return null;
  }

  private calcLightBoxPhotoDimension(photo: MediaDTO): Dimension {
    let width: number;
    let height: number;
    const photoAspect = photo.metadata.size.width / photo.metadata.size.height;
    const windowAspect = this.photoFrameDim.aspect;
    if (photoAspect < windowAspect) {
      width = Math.round(
        photo.metadata.size.width *
        (this.photoFrameDim.height / photo.metadata.size.height)
      );
      height = this.photoFrameDim.height;
    } else {
      width = this.photoFrameDim.width;
      height = Math.round(
        photo.metadata.size.height *
        (this.photoFrameDim.width / photo.metadata.size.width)
      );
    }
    const top = this.photoFrameDim.height / 2 - height / 2;
    const left = this.photoFrameDim.width / 2 - width / 2;

    return { top, left, width, height } as Dimension;
  }

  get NexGridMedia(): GridMedia {
    if (this.activePhotoId + 1 < this.gridPhotoQL?.length) {
      return this.gridPhotoQL.get(this.activePhotoId + 1)?.gridMedia;
    }
    return null;
  }

  togglePlayback(value: boolean): void {
    if (this.slideShowRunning === value) {
      return;
    }
    this.slideShowRunning = value;
    // resets query. This side effect is to assign playback = true to the url
    this.navigateToPhoto(this.activePhotoId);
  }
}

