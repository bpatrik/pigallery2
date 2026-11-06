import {Component, ElementRef, computed, inject, input, linkedSignal, output, viewChild} from '@angular/core';
import {GridMedia} from '../../grid/GridMedia';
import {MediaDTOUtils} from '../../../../../../common/entities/MediaDTO';
import {DomSanitizer, SafeStyle} from '@angular/platform-browser';
import {Config} from '../../../../../../common/config/public/Config';
import {LightboxService} from '../lightbox.service';


@Component({
  selector: 'app-gallery-lightbox-media',
  styleUrl: './media.lightbox.gallery.component.css',
  templateUrl: './media.lightbox.gallery.component.html',
  imports: []
})
export class GalleryLightboxMediaComponent {
  elementRef = inject(ElementRef);
  lightboxService = inject(LightboxService);
  private sanitizer = inject(DomSanitizer);

  readonly gridMedia = input<GridMedia | null>(null);
  readonly nextGridMedia = input<GridMedia | null>(null);
  readonly loadMedia = input(false); // prevents loading media
  readonly windowAspect = input(1);
  readonly zoom = input(1);
  readonly drag = input({x: 0, y: 0});
  readonly videoSourceError = output();

  readonly video = viewChild<ElementRef<HTMLVideoElement>>('video');
  readonly liveVideo = viewChild<ElementRef<HTMLVideoElement>>('liveVideo');
  readonly imageElement = viewChild<ElementRef<HTMLImageElement>>('image');

  // identifies the media; the state below starts over and the elements are re-created when it changes
  private readonly mediaKey = computed((): string | null => this.gridMedia()?.getRelativePath() ?? null);
  // One item while there is a media. The template tracks it by its key, so the elements of the previous media are
  // removed before the new media is shown: the old photo never shows in the place of the new one.
  readonly mediaItems = computed((): { key: string }[] => {
    const key = this.mediaKey();
    return key !== null ? [{key}] : [];
  });
  readonly isPhoto = computed((): boolean => !!this.gridMedia()?.isPhoto());
  readonly isVideo = computed((): boolean => !!this.gridMedia()?.isVideo());
  readonly isLivePhoto = computed((): boolean => !!this.gridMedia()?.isLivePhoto());
  readonly bestFitVideoPath = computed((): string | null => {
    const gridMedia = this.gridMedia();
    return gridMedia?.isVideo() ? gridMedia.getBestFitVideoPath() : null;
  });
  readonly liveVideoSrc = computed((): string | null => {
    const gridMedia = this.gridMedia();
    return gridMedia?.isLivePhoto() ? gridMedia.getLiveVideoPath() : null;
  });
  // the thumbnail the grid loaded, shown until the photo loads
  readonly thumbnailSrc = computed((): string | null => {
    const gridMedia = this.gridMedia();
    if (!gridMedia) {
      return null;
    }
    if (gridMedia.isThumbnailAvailable() === true) {
      return gridMedia.getThumbnailPath();
    }
    if (gridMedia.isReplacementThumbnailAvailable() === true) {
      return gridMedia.getReplacementThumbnailPath();
    }
    return null;
  });
  readonly imageSize = computed((): { width: string | null, height: string | null } => {
    const gridMedia = this.gridMedia();
    if (gridMedia && MediaDTOUtils.calcAspectRatio(gridMedia.media) < this.windowAspect()) {
      return {width: null, height: '100'};
    }
    return {width: '100', height: null};
  });
  readonly imageTransform = computed((): SafeStyle => {
    const zoom = this.zoom();
    const drag = this.drag();
    return this.sanitizer.bypassSecurityTrustStyle(
      'scale(' + zoom + ') translate(calc(' + -50 / zoom + '% + ' + drag.x / zoom + 'px), calc(' +
      -50 / zoom + '% + ' + drag.y / zoom + 'px))'
    );
  });

  private readonly mediaLoaded = linkedSignal({source: this.mediaKey, computation: (): boolean => false});
  private readonly renderedMediaLoaded = linkedSignal({source: this.mediaKey, computation: (): boolean => false});
  readonly liveVideoPlaying = linkedSignal({source: this.mediaKey, computation: (): boolean => false});
  private readonly liveVideoClickLocked = linkedSignal({source: this.mediaKey, computation: (): boolean => false});
  readonly paused = linkedSignal({source: this.mediaKey, computation: (): boolean => true});
  readonly muted = linkedSignal({source: this.mediaKey, computation: (): boolean => false});
  readonly videoVolume = linkedSignal({source: this.mediaKey, computation: (): number => 1});
  readonly videoProgress = linkedSignal({source: this.mediaKey, computation: (): number => 0});
  // the photo url: the best fitting preview once loading is allowed, the original on zoom
  private readonly photo = linkedSignal<{ key: string | null, gridMedia: GridMedia | null, load: boolean, zoomed: boolean }, { src: string | null, isBestFit: boolean | null }>({
    source: () => ({key: this.mediaKey(), gridMedia: this.gridMedia(), load: this.loadMedia(), zoomed: this.zoom() !== 1}),
    computation: (source, previous) => {
      const prev = previous?.source.key === source.key ? previous.value : {src: null, isBestFit: null};
      const gridMedia = source.gridMedia;
      if (!gridMedia || !source.load || !gridMedia.isPhoto()) {
        return prev;
      }
      if (!source.zoomed || Config.Gallery.Lightbox.loadFullImageOnZoom === false) {
        if (prev.src !== null) {
          return prev;
        }
        // Check if the preview size is adequate for lightbox display
        // If not, load the original instead of a tiny preview
        if (this.isPreviewAdequateForLightbox(gridMedia)) {
          return {src: gridMedia.getBestSizedMediaPath(window.innerWidth, window.innerHeight), isBestFit: true};
        }
        return {src: gridMedia.getOriginalMediaPath(), isBestFit: false};
      }
      // on zoom load high res photo
      if (prev.isBestFit === true || prev.src === null) {
        return {src: gridMedia.getOriginalMediaPath(), isBestFit: false};
      }
      return prev;
    }
  });
  readonly photoSrc = computed((): string | null => this.photo().src);
  readonly showThumbnail = computed((): boolean => !!this.gridMedia() && !this.mediaLoaded() && this.thumbnailSrc() !== null);

  private liveVideoTouchActive = false;
  // the next media whose preload started and finished; the slideshow waits for it
  private preloadingNext: GridMedia | null = null;
  private preloadedNext: GridMedia | null = null;

  public isRenderedMediaLoaded(): boolean {
    const gridMedia = this.gridMedia();
    if (!gridMedia) {
      return false;
    }
    if (gridMedia.isVideo()) {
      const video = this.video();
      return !!video && video.nativeElement.readyState >= 3; // HAVE_FUTURE_DATA
    }
    if (gridMedia.isPhoto()) {
      const imageElement = this.imageElement();
      return this.renderedMediaLoaded() || (!!imageElement && imageElement.nativeElement.complete);
    }
    return false;
  }

  public isNextMediaLoaded(): boolean {
    const nextGridMedia = this.nextGridMedia();
    if (!nextGridMedia || !nextGridMedia.isPhoto()) {
      return true;
    }
    // the next media changed after the current one loaded (e.g. loop switched on at the last photo)
    if (this.preloadingNext !== nextGridMedia) {
      this.loadNextPhoto();
    }
    return this.preloadedNext === nextGridMedia;
  }

  public setVideoProgress(value: number): void {
    const video = this.video();
    if (!video || value === null || typeof value === 'undefined') {
      return;
    }
    video.nativeElement.currentTime = video.nativeElement.duration * (value / 100);
    if (video.nativeElement.paused) {
      video.nativeElement.play().catch(console.error);
    }
  }

  public setVideoVolume(value: number): void {
    const video = this.video();
    if (!video) {
      return;
    }
    video.nativeElement.muted = false;
    video.nativeElement.volume = value;
  }

  public mute(): void {
    const video = this.video();
    if (!video) {
      return;
    }

    video.nativeElement.muted = !video.nativeElement.muted;
  }

  public playPause(): void {
    const video = this.video();
    if (!video) {
      return;
    }
    if (video.nativeElement.paused) {
      video.nativeElement.play().catch(console.error);
    } else {
      video.nativeElement.pause();
    }
  }

  // play, pause, volumechange
  public onVideoStateChange(): void {
    const video = this.video()?.nativeElement;
    if (!video) {
      return;
    }
    this.paused.set(video.paused);
    this.muted.set(video.muted);
    this.videoVolume.set(video.volume);
  }

  public onVideoProgress(): void {
    const video = this.video()?.nativeElement;
    if (!video) {
      return;
    }
    this.videoProgress.set((100 / video.duration) * video.currentTime);
  }

  public startLiveVideo(): void {
    const liveVideo = this.liveVideo();
    if (!liveVideo || this.liveVideoClickLocked()) {
      return;
    }
    this.liveVideoPlaying.set(true);
    liveVideo.nativeElement.currentTime = 0;
    liveVideo.nativeElement.play().catch(console.error);
  }

  public startLiveVideoTouch(): void {
    this.liveVideoTouchActive = true;
    this.startLiveVideo();
  }

  public stopLiveVideo(): void {
    const liveVideo = this.liveVideo();
    if (!liveVideo || this.liveVideoClickLocked()) {
      return;
    }
    this.liveVideoPlaying.set(false);
    liveVideo.nativeElement.pause();
  }

  public toggleLiveVideo(): void {
    // Suppress the synthetic click fired after a touch sequence
    if (this.liveVideoTouchActive) {
      this.liveVideoTouchActive = false;
      return;
    }
    const liveVideo = this.liveVideo();
    if (!liveVideo) {
      return;
    }
    if (this.liveVideoClickLocked()) {
      this.liveVideoClickLocked.set(false);
      this.liveVideoPlaying.set(false);
      liveVideo.nativeElement.pause();
    } else {
      this.liveVideoClickLocked.set(true);
      this.liveVideoPlaying.set(true);
      liveVideo.nativeElement.currentTime = 0;
      liveVideo.nativeElement.play().catch(console.error);
    }
  }

  onImageError(): void {
    // TODO:handle error
    this.renderedMediaLoaded.set(true);
    console.error(
      'Error: cannot load media for lightbox url: ' +
      this.gridMedia()?.getBestSizedMediaPath(window.innerWidth, window.innerHeight)
    );
    this.loadNextPhoto();
  }

  onImageLoad(): void {
    this.renderedMediaLoaded.set(true);
    this.mediaLoaded.set(true);
    this.loadNextPhoto();
  }

  onSourceError(): void {
    this.mediaLoaded.set(false);
    this.videoSourceError.emit();
  }

  /**
   * Loads next photo to faster show it on navigation.
   * Called after the current photo is loaded
   * @private
   */
  private loadNextPhoto(): void {
    const nextGridMedia = this.nextGridMedia();
    if (!nextGridMedia || !this.loadMedia()) {
      return;
    }
    // Videos do not support preloading
    if (!nextGridMedia.isPhoto()) {
      return;
    }
    this.preloadingNext = nextGridMedia;
    // a new image for each preload, so an older one can't mark this one loaded
    const image = new Image();
    const done = (): void => {
      if (this.preloadingNext === nextGridMedia) {
        this.preloadedNext = nextGridMedia;
      }
    };
    image.onload = done;
    image.onerror = (): void => {
      console.error('Cant preload:' + image.src);
      done();
    };
    image.src = nextGridMedia.getBestSizedMediaPath(window.innerWidth, window.innerHeight);
    if (image.complete) {
      done();
    }
  }

  /**
   * Checks if the available preview size is adequate for lightbox display.
   * Returns false if the preview would be significantly smaller than the lightbox area.
   */
  private isPreviewAdequateForLightbox(gridMedia: GridMedia): boolean {
    if (!Config.Gallery.Lightbox.loadFullImageIfPreviewTooSmall) {
      return true;
    }

    const selectedSize = gridMedia.getMediaSize(window.innerWidth, window.innerHeight);
    const minDisplaySize = Math.min(window.innerWidth, window.innerHeight);

    // If the selected preview size is less than 50% of the minimum display dimension,
    // consider it inadequate for lightbox display (e.g., 240px on a 1080p screen)
    return selectedSize >= minDisplaySize * 0.5;
  }
}
