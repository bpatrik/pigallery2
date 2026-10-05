import {ChangeDetectorRef, Component, ElementRef, HostListener, type OnDestroy, type OnInit, QueryList, ViewChild, ChangeDetectionStrategy} from '@angular/core';
import {GalleryPhotoComponent} from '../grid/photo/photo.grid.gallery.component';
import {type Dimension, DimensionUtils} from '../../../model/IRenderable';
import {FullScreenService} from '../fullscreen.service';
import {OverlayService} from '../overlay.service';
import {WakeLockService} from '../wakelock.service';
import {animate, AnimationBuilder, type AnimationPlayer, style,} from '@angular/animations';
import {GalleryLightboxMediaComponent} from './media/media.lightbox.gallery.component';
import {Subscription} from 'rxjs';
import {ActivatedRoute, type Params, Router} from '@angular/router';
import {PageHelper} from '../../../model/page.helper';
import {QueryService} from '../../../model/query.service';
import {type MediaDTO} from '../../../../../common/entities/MediaDTO';
import {QueryParams} from '../../../../../common/QueryParams';
import {type PhotoDTO} from '../../../../../common/entities/PhotoDTO';
import {ControlsLightboxComponent} from './controls/controls.lightbox.gallery.component';
import {SupportedFormats} from '../../../../../common/SupportedFormats';
import {GridMedia} from '../grid/GridMedia';
import {PiTitleService} from '../../../model/pi-title.service';

import {NgIconComponent} from '@ng-icons/core';
import {InfoPanelLightboxComponent} from './infopanel/info-panel.lightbox.gallery.component';
import {LightboxService} from './lightbox.service';
import {GridLightboxSource, type LightboxItem, type LightboxSource} from './LightboxSource';

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
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [
    GalleryLightboxMediaComponent,
    NgIconComponent,
    ControlsLightboxComponent,
    InfoPanelLightboxComponent
]
})
export class GalleryLightboxComponent implements OnDestroy, OnInit {
  private static readonly MAX_EMPTY_PAGES = 50;
  // bumped on close, source change and destroy so pending page loads stop advancing
  private navigationToken = 0;
  @ViewChild('photo', {static: true})
  mediaElement: GalleryLightboxMediaComponent;
  @ViewChild('controls', {static: false}) controls: ControlsLightboxComponent;
  @ViewChild('lightbox', {static: false}) lightboxElement: ElementRef;
  @ViewChild('root', {static: false}) root: ElementRef;

  public navigation = {hasPrev: true, hasNext: true};
  public blackCanvasOpacity = 0;
  public activePhoto: LightboxItem;
  public status: LightboxStates = LightboxStates.Closed;
  public infoPanelVisible = false;
  public infoPanelWidth = 0;
  public animating = false;
  public photoFrameDim = {width: 1, height: 1, aspect: 1};
  public videoSourceError = false;
  public transcodeNeedVideos = SupportedFormats.TranscodeNeed.Videos;
  slideShowRunning: boolean;
  private infoPanelMaxWidth = 400;
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
  private source: LightboxSource;
  private subscription: {
    photosChange: Subscription;
    route: Subscription;
  } = {
    photosChange: null,
    route: null,
  };

  constructor(
    public fullScreenService: FullScreenService,
    private changeDetector: ChangeDetectorRef,
    private overlayService: OverlayService,
    private builder: AnimationBuilder,
    private router: Router,
    private queryService: QueryService,
    private route: ActivatedRoute,
    private piTitleService: PiTitleService,
    private wakeLockService: WakeLockService,
    private lightboxService: LightboxService,
  ) {
  }

  get Title(): string {
    if (!this.activePhoto) {
      return null;
    }
    return (this.activePhoto.gridMedia.media as PhotoDTO).metadata.caption;
  }

  get NexGridMedia(): GridMedia {
    if (!this.source?.length) {
      return null;
    }
    if (this.activePhotoId + 1 < this.source.length) {
      return this.source.get(this.activePhotoId + 1);
    }
    if (this.source.hasMore()) {
      return null;
    }
    if (this.lightboxService.loopSlideshow) {
      return this.source.get(0);
    }

    return null;
  }

  get LoadState(): string {
    return this.source?.loadState ?? 'idle';
  }

  get IsAtLoadedEnd(): boolean {
    return !!this.source && this.activePhotoId === this.source.length - 1 && this.source.hasMore();
  }

  public toggleFullscreen(): void {
    if (this.fullScreenService.isFullScreenEnabled()) {
      this.fullScreenService.exitFullScreen();
    } else {
      this.fullScreenService.showFullScreen(this.root.nativeElement);
    }
  }

  ngOnInit(): void {
    this.infoPanelMaxWidth = 1000;
    this.updatePhotoFrameDim();
    this.subscription.route = this.route.queryParams.subscribe(
      (params: Params) => {
        const validPhoto = params[QueryParams.gallery.photo] &&
          params[QueryParams.gallery.photo] !== '';

        if (params[QueryParams.gallery.lightbox.playback]) {
          this.runSlideShow();
        } else {
          this.stopSlideShow();
        }

        this.delayedMediaShow = null;
        if (validPhoto) {
          this.delayedMediaShow = params[QueryParams.gallery.photo];
          // photos are not yet available to show
          if (!this.source) {
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

  ngOnDestroy(): void {
    this.navigationToken++;
    this.stopSlideShow();
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

  setGridPhotoQL(value: QueryList<GalleryPhotoComponent>): void {
    this.setSource(new GridLightboxSource(value, this.queryService));
  }

  setSource(source: LightboxSource): void {
    this.navigationToken++;
    if (this.subscription.photosChange != null) {
      this.subscription.photosChange.unsubscribe();
    }
    this.source = source;
    this.subscription.photosChange = this.source.changes.subscribe(
      (): void => {
        if (this.activePhoto) {
          const id = this.source.getMediaId(this.activePhoto.gridMedia.media);
          const index = this.source.indexOfId(id);
          // make sure that currently shown media has uses the right index.
          if (index !== -1) {
            this.activePhotoId = index;
            this.updateActivePhoto(this.activePhotoId);
            // if the photo is not available anymore, navigate to the first one.
          } else if (this.source.length > 0) {
            if (this.status === LightboxStates.Open) {
              this.navigateToPhoto(0);
            }
          }
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

  @HostListener('window:resize')
  onResize(): void {
    this.updatePhotoFrameDim();
    if (this.activePhoto) {
      this.animateLightbox();
      this.updateActivePhoto(this.activePhotoId);
    }
  }

  public nextImage(): void {
    if (this.activePhotoId + 1 < this.source.length) {
      this.navigateToPhoto(this.activePhotoId + 1);
    } else if (this.source.hasMore()) {
      // errors need an explicit retry, so the slideshow timer does not hammer the server
      if (this.source.loadState !== 'error') {
        this.loadMoreAndAdvance();
      }
    } else if (this.lightboxService.loopSlideshow) {
      this.navigateToPhoto(0);
    }
  }

  public retryLoad(): void {
    this.loadMoreAndAdvance();
  }

  public prevImage(): void {
    this.stopSlideShow();
    if (this.activePhotoId > 0) {
      this.navigateToPhoto(this.activePhotoId - 1);
    }
  }

  public showLightbox(index: number): void {
    if (this.controls) {
      this.controls.resetZoom();
    }
    this.status = LightboxStates.Opening;
    const gridMedia = this.source.get(index);

    const lightboxDimension = this.getGridDimension(index);
    lightboxDimension.top -= PageHelper.ScrollY;
    this.animating = true;
    this.animatePhoto(
      this.getGridDimension(index),
      this.calcLightBoxPhotoDimension(gridMedia.media)
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
    this.startPhotoDimension = this.getGridDimension(index);
    // disable scroll
    this.overlayService.showOverlay('lightbox');
    this.blackCanvasOpacity = 1.0;
    this.showPhoto(index, false);
    this.piTitleService.setMediaTitle(gridMedia);
  }

  public hide(): void {
    this.router
      .navigate([], {queryParams: this.source ? this.source.queryParams() : this.queryService.getParams()})
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

  private onNavigateTo(photoStringId: string): void {
    if (
      this.activePhoto &&
      this.source.getMediaId(this.activePhoto.gridMedia.media) ===
      photoStringId
    ) {
      return;
    }

    if (this.controls) {
      this.controls.resetZoom();
    }
    const index = this.source.indexOfId(photoStringId);
    if (index === -1) {
      this.delayedMediaShow = photoStringId;
      return;
    }
    if (this.status === LightboxStates.Closed) {
      this.showLightbox(index);
    } else {
      this.showPhoto(index);
    }
    this.delayedMediaShow = null;
  }

  private updateInfoPanelWidth() {
    this.infoPanelMaxWidth = Math.min(400, Math.ceil(window.innerWidth + 1));
    if ((window.innerWidth - this.infoPanelMaxWidth) < this.infoPanelMaxWidth * 0.3) {
      this.infoPanelMaxWidth = Math.ceil(window.innerWidth + 1);
    }
  }

  private runSlideShow() {
    if (!this.activePhoto && this.source?.length > 0) {
      this.navigateToPhoto(0);
    }
    this.slideShowRunning = true;
    this.controls?.runSlideShow();
    // Request wake lock to prevent screen dimming during slideshow
    this.wakeLockService.requestWakeLock().catch(console.error);
  }

  private stopSlideShow() {
    this.slideShowRunning = false;
    this.controls?.stopSlideShow();
    // Release wake lock when slideshow stops
    this.wakeLockService.releaseWakeLock().catch(console.error);
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
    const gridMedia = this.source.get(photoIndex);
    this.router
      .navigate([], {
        queryParams: this.source.queryParams(gridMedia.media),
        queryParamsHandling: 'merge', // keep existing params
        replaceUrl: true,
      })
      .then(() => {
        this.piTitleService.setMediaTitle(gridMedia);
      })
      .catch((err) => {
        console.error(`Can't navigate to photo ${photoIndex}`, err);
      });
  }

  private loadMoreAndAdvance(): void {
    if (!this.activePhoto) {
      return;
    }
    const source = this.source;
    const token = this.navigationToken;
    const fromId = source.getMediaId(this.activePhoto.gridMedia.media);
    // the user may close or move on while a page loads; only advance from the same open item
    const isSameView = (): boolean =>
      this.navigationToken === token &&
      this.source === source &&
      this.status === LightboxStates.Open &&
      !!this.activePhoto &&
      source.getMediaId(this.activePhoto.gridMedia.media) === fromId;

    // pages can add nothing (companion videos, duplicates); keep loading until something new appears
    const step = (attempt: number): Promise<void> => {
      if (!isSameView()) {
        return Promise.resolve();
      }
      return source.loadMore().then((): Promise<void> => {
        if (!isSameView()) {
          return;
        }
        const next = source.indexOfId(fromId) + 1;
        if (next > 0 && next < source.length) {
          this.navigateToPhoto(next);
          return;
        }
        if (source.hasMore() && source.loadState !== 'error' && attempt < GalleryLightboxComponent.MAX_EMPTY_PAGES) {
          return step(attempt + 1);
        }
        this.navigation.hasNext = !!this.NexGridMedia || source.hasMore();
      });
    };
    step(1).catch(console.error);
  }

  private getGridDimension(index: number): Dimension {
    return this.source.animationTarget(index) ?? {
      top: PageHelper.ScrollY + this.photoFrameDim.height / 2,
      left: this.photoFrameDim.width / 2,
      width: 0,
      height: 0,
    } as Dimension;
  }

  private showPhoto(photoIndex: number, resize = true): void {
    this.activePhoto = null;
    this.changeDetector.detectChanges();
    this.updateActivePhoto(photoIndex, resize);
  }

  private hideLightbox(): void {
    this.navigationToken++;
    if (this.controls) {
      this.controls.resetZoom();
    }
    this.status = LightboxStates.Closing;
    this.fullScreenService.exitFullScreen();

    this.stopSlideShow();

    this.animating = true;
    const lightboxDimension = this.getGridDimension(this.activePhotoId);
    lightboxDimension.top -= PageHelper.ScrollY;
    this.blackCanvasOpacity = 0;

    this.animatePhoto(
      this.calcLightBoxPhotoDimension(this.activePhoto.gridMedia.media),
      this.getGridDimension(this.activePhotoId)
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
      this.overlayService.hideOverlay('lightbox');
    });

    this.hideInfoPanel(false);
  }

  private updateActivePhoto(photoIndex: number, resize = true): void {
    if (photoIndex < 0 || photoIndex >= this.source.length) {
      throw new Error('Can\'t find the media');
    }
    this.videoSourceError = false;
    this.activePhotoId = photoIndex;
    const gridMedia = this.source.get(photoIndex);
    if (this.activePhoto?.gridMedia !== gridMedia) {
      this.activePhoto = {gridMedia};
    }

    if (resize) {
      this.animatePhoto(
        this.calcLightBoxPhotoDimension(this.activePhoto.gridMedia.media)
      );
    }
    this.navigation.hasPrev = photoIndex > 0;
    this.navigation.hasNext = !!this.NexGridMedia || this.source.hasMore();

    const to = this.source.animationTarget(photoIndex);
    if (!to) {
      return;
    }

    // if target image out of screen -> scroll to there
    if (
      PageHelper.ScrollY > to.top ||
      PageHelper.ScrollY + this.photoFrameDim.height < to.top
    ) {
      PageHelper.ScrollY = to.top;
    }
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

    return {top, left, width, height} as Dimension;
  }
}

