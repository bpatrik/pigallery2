import {Component, ElementRef, OnDestroy, Signal, computed, effect, inject, input, signal, untracked, viewChild} from '@angular/core';
import {toSignal} from '@angular/core/rxjs-interop';
import {Dimension, DimensionUtils} from '../../../model/IRenderable';
import {FullScreenService} from '../fullscreen.service';
import {OverlayService} from '../overlay.service';
import {WakeLockService} from '../wakelock.service';
import {GalleryLightboxMediaComponent} from './media/media.lightbox.gallery.component';
import {ActivatedRoute, Params, Router} from '@angular/router';
import {PageHelper} from '../../../model/page.helper';
import {QueryService} from '../../../model/query.service';
import {MediaDTO} from '../../../../../common/entities/MediaDTO';
import {QueryParams} from '../../../../../common/QueryParams';
import {ControlsLightboxComponent} from './controls/controls.lightbox.gallery.component';
import {SupportedFormats} from '../../../../../common/SupportedFormats';
import {GridMedia} from '../grid/GridMedia';
import {PiTitleService} from '../../../model/pi-title.service';
import {NotificationService} from '../../../model/notification.service';

import {NgIconComponent} from '@ng-icons/core';
import {InfoPanelLightboxComponent} from './infopanel/info-panel.lightbox.gallery.component';
import {LightboxService} from './lightbox.service';
import {ReloadAfterUpgradeComponent} from '../../../model/lazy-loading';

export enum LightboxStates {
  Open = 1,
  Opening = 2,
  Closing = 3,
  Closed = 4,
}

export interface LightboxGridTile {
  // the tile's position in the page (not in the viewport)
  rect: Dimension;
  // the grid's GridMedia of the tile: knows which thumbnail the grid loaded
  gridMedia: GridMedia;
}

/**
 * What the lightbox needs from the grid.
 */
export interface LightboxGrid {
  /** All photos of the grid, in grid order (groups, then sorting). Not only the rendered ones. null while the content loads. */
  readonly media: Signal<MediaDTO[] | null>;

  /** Renders up to this photo plus one row, scrolls it into view after render, and returns its tile.
   *  null if the photo isn't in the grid. */
  revealMedia(media: MediaDTO): Promise<LightboxGridTile | null>;
}

@Component({
  selector: 'app-gallery-lightbox',
  host: {
    '(window:resize)': 'onResize()'
  },
  styleUrl: './lightbox.gallery.component.css',
  templateUrl: './lightbox.gallery.component.html',
  imports: [
    GalleryLightboxMediaComponent,
    NgIconComponent,
    ControlsLightboxComponent,
    InfoPanelLightboxComponent,
    ReloadAfterUpgradeComponent
  ]
})
export class GalleryLightboxComponent implements OnDestroy {
  fullScreenService = inject(FullScreenService);
  private overlayService = inject(OverlayService);
  private router = inject(Router);
  private queryService = inject(QueryService);
  private route = inject(ActivatedRoute);
  private piTitleService = inject(PiTitleService);
  private wakeLockService = inject(WakeLockService);
  private lightboxService = inject(LightboxService);
  private notificationService = inject(NotificationService);

  readonly grid = input<LightboxGrid>();
  readonly mediaElement = viewChild.required<GalleryLightboxMediaComponent>('photo');
  readonly lightboxElement = viewChild.required<ElementRef>('lightbox');
  readonly root = viewChild.required<ElementRef>('root');

  readonly status = signal(LightboxStates.Closed);
  readonly isVisible = computed((): boolean => this.status() !== LightboxStates.Closed);
  readonly isOpen = computed((): boolean => this.status() === LightboxStates.Open);
  // the media shown; the grid's GridMedia when its tile was rendered
  readonly activePhoto = signal<GridMedia | null>(null);
  readonly blackCanvasOpacity = signal(0);
  readonly infoPanelVisible = signal(false);
  readonly infoPanelWidth = signal(0);
  readonly animating = signal(false);
  readonly photoFrameDim = signal({width: 1, height: 1, aspect: 1});
  readonly videoSourceError = signal(false);
  readonly zoom = signal(1);
  readonly drag = signal({x: 0, y: 0});
  readonly slideShowRunning = this.lightboxService.playback;
  readonly transcodeNeedVideos = SupportedFormats.TranscodeNeed.Videos;

  private readonly queryParams = toSignal(this.route.queryParams, {initialValue: {} as Params});
  // the open photo, from the URL
  private readonly photoId = computed((): string | null => (this.queryParams()[QueryParams.gallery.photo] as string) || null);
  private readonly media = computed((): MediaDTO[] | null => this.grid()?.media() ?? null);
  private readonly indexById = computed((): Map<string, number> =>
    new Map((this.media() ?? []).map((m, i): [string, number] => [this.queryService.getMediaStringId(m), i]))
  );
  readonly activeIndex = computed((): number => {
    const photoId = this.photoId();
    return photoId === null ? -1 : this.indexById().get(photoId) ?? -1;
  });
  readonly hasPrev = computed((): boolean => this.activeIndex() > 0);
  readonly nextMedia = computed((): MediaDTO | null => {
    const media = this.media();
    const index = this.activeIndex();
    if (!media || index === -1) {
      return null;
    }
    if (index + 1 < media.length) {
      return media[index + 1];
    }
    return this.lightboxService.loopSlideshow() ? media[0] : null;
  });
  readonly hasNext = computed((): boolean => !!this.nextMedia());
  readonly navigation = computed(() => ({hasPrev: this.hasPrev(), hasNext: this.hasNext()}));
  // only used to preload the next photo, that is sized to the window: it does not need the grid's tile
  readonly nextGridMedia = computed((): GridMedia | null => {
    const media = this.nextMedia();
    return media ? this.createGridMedia(media) : null;
  });
  readonly videoTranscodingNeeded = computed((): boolean => !!this.activePhoto()?.isVideoTranscodingNeeded());

  private infoPanelMaxWidth = 1000;
  private iPvisibilityTimer: number | null = null;
  // the string id of the photo that is shown or being revealed
  private shownId: string | null = null;
  // the photo that was not found, so its toast shows once
  private goneId: string | null = null;
  // increases with every photo change and close: an outdated async step stops
  private navigationId = 0;
  // increases with every open and close: an outdated animation end is ignored
  private openCloseId = 0;
  private photoPlayer: Animation | null = null;
  private lightboxPlayer: Animation | null = null;

  constructor() {
    this.updatePhotoFrameDim();
    // opens, changes and closes the photo when the URL or the content changes (animations, navigation)
    effect((): void => {
      const id = this.photoId();
      const media = this.media();
      const playback = this.lightboxService.playback();
      untracked((): void => this.sync(id, media, playback));
    });
    // keeps the screen on during the slideshow
    effect((): void => {
      if (this.slideShowRunning()) {
        this.wakeLockService.requestWakeLock().catch(console.error);
      } else {
        this.wakeLockService.releaseWakeLock().catch(console.error);
      }
    });
  }

  public toggleFullscreen(): void {
    if (this.fullScreenService.isFullScreenEnabled()) {
      this.fullScreenService.exitFullScreen();
    } else {
      this.fullScreenService.showFullScreen(this.root().nativeElement);
    }
  }

  ngOnDestroy(): void {
    this.navigationId++;
    this.openCloseId++;
    this.wakeLockService.releaseWakeLock().catch(console.error);
    // Stop running animations, so their finish can't fire later and release a newer lightbox's scroll lock.
    this.photoPlayer?.cancel();
    this.lightboxPlayer?.cancel();
    // Destroyed while open (e.g. browser history jump to another page): release what
    // openLightbox() took, or the next page can no longer be scrolled.
    if (this.status() !== LightboxStates.Closed) {
      this.releasePage();
    }
    if (this.iPvisibilityTimer != null) {
      clearTimeout(this.iPvisibilityTimer);
    }
  }

  onResize(): void {
    this.updatePhotoFrameDim();
    const activePhoto = this.activePhoto();
    if (activePhoto) {
      this.animateLightbox();
      this.animatePhoto(this.calcLightBoxPhotoDimension(activePhoto.media));
    }
  }

  public nextImage(): void {
    const next = this.nextMedia();
    if (next) {
      this.navigateToMedia(next);
    }
  }

  public prevImage(): void {
    if (!this.hasPrev()) {
      return;
    }
    // going back pauses the slideshow; in the same navigation, so the URL keeps both changes
    const media = this.media();
    if (!media) {
      return;
    }
    this.navigateToMedia(media[this.activeIndex() - 1], {[QueryParams.gallery.lightbox.playback]: null});
  }

  public hide(): void {
    this.router
      .navigate([], {queryParams: this.queryService.getParams()})
      .then(() => {
        this.piTitleService.setLastNonMedia();
      })
      .catch(console.error);
  }

  animatePhoto(from: Dimension, to: Dimension = from): Animation {
    this.photoPlayer = GalleryLightboxComponent.animate(this.mediaElement().elementRef.nativeElement, from, to);
    return this.photoPlayer;
  }

  animateLightbox(
    from: Dimension = this.fullFrame(),
    to: Dimension = from
  ): Animation {
    this.lightboxPlayer = GalleryLightboxComponent.animate(this.lightboxElement().nativeElement, from, to);
    return this.lightboxPlayer;
  }

  // The animation keeps its end state (fill: forwards). The browser drops it once a newer animation covers the same properties.
  private static animate(element: HTMLElement, from: Dimension, to: Dimension): Animation {
    return element.animate(
      [DimensionUtils.toString(from), DimensionUtils.toString(to)],
      {duration: 200, easing: 'ease-in-out', fill: 'forwards'}
    );
  }

  public toggleInfoPanel(): void {
    if (this.infoPanelWidth() !== this.infoPanelMaxWidth) {
      this.showInfoPanel();
    } else {
      this.hideInfoPanel();
    }
  }

  hideInfoPanel(enableAnimate = true): void {
    this.iPvisibilityTimer = window.setTimeout((): void => {
      this.iPvisibilityTimer = null;
      this.infoPanelVisible.set(false);
    }, 1000);

    const media = this.activePhoto()?.media;
    const starPhotoPos = media ? this.calcLightBoxPhotoDimension(media) : null;
    this.infoPanelWidth.set(0);
    this.updatePhotoFrameDim();
    if (!enableAnimate || !media || !starPhotoPos) {
      return;
    }
    this.animatePhoto(starPhotoPos, this.calcLightBoxPhotoDimension(media));
    const frame = this.photoFrameDim();
    this.animateLightbox(
      {
        top: 0,
        left: 0,
        width: Math.max(frame.width - this.infoPanelMaxWidth, 0),
        height: frame.height,
      } as Dimension,
      this.fullFrame()
    );
  }

  showInfoPanel(): void {
    this.updateInfoPanelWidth();
    this.infoPanelVisible.set(true);

    const media = this.activePhoto()?.media;
    if (!media) {
      return;
    }
    const starPhotoPos = this.calcLightBoxPhotoDimension(media);
    this.infoPanelWidth.set(this.infoPanelMaxWidth);
    this.updatePhotoFrameDim();
    this.animatePhoto(starPhotoPos, this.calcLightBoxPhotoDimension(media));
    const frame = this.photoFrameDim();
    this.animateLightbox(
      {
        top: 0,
        left: 0,
        width: frame.width + this.infoPanelMaxWidth,
        height: frame.height,
      } as Dimension,
      this.fullFrame()
    );
    if (this.iPvisibilityTimer != null) {
      clearTimeout(this.iPvisibilityTimer);
    }
    this.resetZoom();
  }

  onVideoSourceError(): void {
    this.videoSourceError.set(true);
  }

  /**
   * Brings the lightbox to the state the URL (photo, playback) and the grid's content ask for.
   */
  private sync(id: string | null, media: MediaDTO[] | null, playback: boolean): void {
    if (!id) {
      this.goneId = null;
      // a slideshow URL without a photo (e.g. the photo frame) starts at the first one
      if (playback && media && media.length > 0) {
        this.navigateToMedia(media[0]);
        return;
      }
      if (this.shownId !== null) {
        this.hideLightbox();
      }
      return;
    }
    if (media === null) {
      return; // the content is loading
    }
    if (media.length === 0) {
      this.hide(); // nothing to show
      return;
    }
    const index = this.indexById().get(id);
    if (index === undefined) {
      // deleted or a stale link: show the first one. The slideshow (photo frame) keeps playing.
      if (this.goneId !== id) {
        this.goneId = id;
        this.notificationService.info($localize`The photo is not available anymore. Showing the first one.`);
      }
      this.navigateToMedia(media[0]);
      return;
    }
    if (id !== this.shownId) {
      this.showMedia(media[index]).catch(console.error);
    }
  }

  /**
   * Opens the lightbox with this media (zooms in from its tile), or changes the shown one.
   */
  private async showMedia(media: MediaDTO): Promise<void> {
    const navigationId = ++this.navigationId;
    this.shownId = this.queryService.getMediaStringId(media);
    this.resetZoom();
    const tile = await this.grid()?.revealMedia(media);
    if (navigationId !== this.navigationId) {
      return;
    }
    const gridMedia = tile?.gridMedia ?? this.createGridMedia(media);
    const status = this.status();
    if (status === LightboxStates.Closed || status === LightboxStates.Closing) {
      this.openLightbox(gridMedia, tile?.rect ?? this.centerRect());
    } else {
      this.setActivePhoto(gridMedia);
      this.animatePhoto(this.calcLightBoxPhotoDimension(media));
    }
    this.piTitleService.setMediaTitle(gridMedia);
  }

  private openLightbox(gridMedia: GridMedia, rect: Dimension): void {
    const openCloseId = ++this.openCloseId;
    this.status.set(LightboxStates.Opening);
    this.animating.set(true);
    this.animatePhoto(rect, this.calcLightBoxPhotoDimension(gridMedia.media))
      .addEventListener('finish', (): void => {
        if (openCloseId !== this.openCloseId) {
          return;
        }
        this.animating.set(false);
        this.status.set(LightboxStates.Open);
      });
    this.animateLightbox({...rect, top: rect.top - PageHelper.ScrollY}, this.fullFrame());

    // disable scroll
    this.overlayService.showOverlay('lightbox');
    this.blackCanvasOpacity.set(1.0);
    this.setActivePhoto(gridMedia);
  }

  /**
   * Scrolls the page to the photo, then shrinks the lightbox into its tile.
   */
  private async hideLightbox(): Promise<void> {
    const navigationId = ++this.navigationId;
    this.shownId = null;
    if (this.status() === LightboxStates.Closed) {
      return; // closed before it opened: the pending open is cancelled
    }
    const openCloseId = ++this.openCloseId;
    this.resetZoom();
    this.status.set(LightboxStates.Closing);
    this.fullScreenService.exitFullScreen();
    this.animating.set(true);
    this.blackCanvasOpacity.set(0);

    const activePhoto = this.activePhoto();
    const tile = activePhoto ? await this.grid()?.revealMedia(activePhoto.media) : null;
    if (navigationId !== this.navigationId) {
      return; // opened again meanwhile
    }
    const rect = tile?.rect ?? this.centerRect();
    if (activePhoto) {
      this.animatePhoto(this.calcLightBoxPhotoDimension(activePhoto.media), rect);
    }
    this.animateLightbox(
      this.fullFrame(),
      {...rect, top: rect.top - PageHelper.ScrollY}
    ).addEventListener('finish', (): void => {
      if (openCloseId !== this.openCloseId) {
        return;
      }
      this.status.set(LightboxStates.Closed);
      this.activePhoto.set(null);
      this.releasePage();
    });

    this.hideInfoPanel(false);
  }

  /**
   * Releases what openLightbox() took: full screen and the page scroll lock.
   */
  private releasePage(): void {
    this.fullScreenService.exitFullScreen();
    this.overlayService.hideOverlay('lightbox');
  }

  private setActivePhoto(gridMedia: GridMedia): void {
    this.videoSourceError.set(false);
    this.activePhoto.set(gridMedia);
  }

  private resetZoom(): void {
    this.zoom.set(1);
    this.drag.set({x: 0, y: 0});
  }

  private navigateToMedia(media: MediaDTO, extraParams: Params = {}): void {
    this.router
      .navigate([], {
        queryParams: {...this.queryService.getParams({media}), ...extraParams},
        queryParamsHandling: 'merge', // keep existing params
        replaceUrl: true,
      })
      .catch((err) => {
        console.error(`Can't navigate to photo ${media.name}`, err);
      });
  }

  // for a media whose tile is not rendered: sized to the lightbox frame
  private createGridMedia(media: MediaDTO): GridMedia {
    const frame = this.photoFrameDim();
    return new GridMedia(media, frame.width, frame.height, 0);
  }

  private fullFrame(): Dimension {
    const frame = this.photoFrameDim();
    return {top: 0, left: 0, width: frame.width, height: frame.height} as Dimension;
  }

  // the middle of the screen, in page coordinates: where the lightbox zooms without a tile
  private centerRect(): Dimension {
    return {top: PageHelper.ScrollY + window.innerHeight / 2, left: window.innerWidth / 2, width: 0, height: 0} as Dimension;
  }

  private updateInfoPanelWidth(): void {
    this.infoPanelMaxWidth = Math.min(400, Math.ceil(window.innerWidth + 1));
    if ((window.innerWidth - this.infoPanelMaxWidth) < this.infoPanelMaxWidth * 0.3) {
      this.infoPanelMaxWidth = Math.ceil(window.innerWidth + 1);
    }
  }

  private updatePhotoFrameDim(): void {
    const width = Math.max(window.innerWidth - this.infoPanelWidth(), 0);
    const height = window.innerHeight;
    this.photoFrameDim.set({
      width,
      height,
      aspect: Math.round((width / height) * 100) / 100
    });
  }

  private calcLightBoxPhotoDimension(photo: MediaDTO): Dimension {
    let width: number;
    let height: number;
    const frame = this.photoFrameDim();
    const photoAspect = photo.metadata.size.width / photo.metadata.size.height;
    const windowAspect = frame.aspect;
    if (photoAspect < windowAspect) {
      width = Math.round(
        photo.metadata.size.width *
        (frame.height / photo.metadata.size.height)
      );
      height = frame.height;
    } else {
      width = frame.width;
      height = Math.round(
        photo.metadata.size.height *
        (frame.width / photo.metadata.size.width)
      );
    }
    const top = frame.height / 2 - height / 2;
    const left = frame.width / 2 - width / 2;

    return {top, left, width, height} as Dimension;
  }
}
