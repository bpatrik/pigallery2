import { Component, ElementRef, OnChanges, inject, input, output, viewChild } from '@angular/core';
import {GridMedia} from '../../grid/GridMedia';
import {MediaDTOUtils} from '../../../../../../common/entities/MediaDTO';
import {DomSanitizer, SafeStyle} from '@angular/platform-browser';
import {SupportedFormats} from '../../../../../../common/SupportedFormats';
import {Config} from '../../../../../../common/config/public/Config';
import {LightboxService} from '../lightbox.service';


@Component({
  selector: 'app-gallery-lightbox-media',
  styleUrl: './media.lightbox.gallery.component.css',
  templateUrl: './media.lightbox.gallery.component.html',
  imports: []
})
export class GalleryLightboxMediaComponent implements OnChanges {
  elementRef = inject(ElementRef);
  lightboxService = inject(LightboxService);
  private sanitizer = inject(DomSanitizer);

  readonly gridMedia = input<GridMedia>(undefined);
  readonly nextGridMedia = input<GridMedia>(undefined);
  readonly loadMedia = input(false); // prevents loading media
  readonly windowAspect = input(1);
  readonly zoom = input(1);
  readonly drag = input({ x: 0, y: 0 });
  readonly videoSourceError = output();

  readonly video = viewChild<ElementRef<HTMLVideoElement>>('video');
  readonly liveVideo = viewChild<ElementRef<HTMLVideoElement>>('liveVideo');
  readonly imageElement = viewChild<ElementRef<HTMLImageElement>>('image');

  prevGirdPhoto: GridMedia = null;

  public imageSize = {width: 'auto', height: '100'};
  // do not skip to the next photo if not both are loaded (or resulted in an error)
  public imageLoadFinished = {
    this: false,
    next: false
  };
  thumbnailSrc: string = null;
  liveVideoSrc: string = null;
  liveVideoPlaying = false;
  liveVideoClickLocked = false;
  private liveVideoTouchActive = false;
  photo = {
    src: null as string,
    isBestFit: null as boolean,
  };
  public transcodeNeedVideos = SupportedFormats.TranscodeNeed.Videos;
  private nextImage = new Image();
  // if media not loaded, show thumbnail
  private mediaLoaded = false;
  private videoProgress = 0;

  get ImageTransform(): SafeStyle {
    return this.sanitizer.bypassSecurityTrustStyle(
      'scale(' +
      this.zoom() +
      ') translate(calc(' +
      -50 / this.zoom() +
      '% + ' +
      this.drag().x / this.zoom() +
      'px), calc(' +
      -50 / this.zoom() +
      '% + ' +
      this.drag().y / this.zoom() +
      'px))'
    );
  }

  public get VideoProgress(): number {
    return this.videoProgress;
  }

  public set VideoProgress(value: number) {
    const video = this.video();
    if (!video && value === null && typeof value === 'undefined') {
      return;
    }
    video.nativeElement.currentTime =
      video.nativeElement.duration * (value / 100);
    if (video.nativeElement.paused) {
      video.nativeElement.play().catch(console.error);
    }
  }

  public get VideoVolume(): number {
    const video = this.video();
    if (!video) {
      return 1;
    }
    return video.nativeElement.volume;
  }

  public set VideoVolume(value: number) {
    const video = this.video();
    if (!video) {
      return;
    }
    video.nativeElement.muted = false;
    video.nativeElement.volume = value;
  }

  public get Muted(): boolean {
    const video = this.video();
    if (!video) {
      return false;
    }
    return video.nativeElement.muted;
  }

  public get Paused(): boolean {
    const video = this.video();
    if (!video) {
      return true;
    }
    return video.nativeElement.paused;
  }

  private get ThumbnailUrl(): string {
    const gridMedia = this.gridMedia();
    if (gridMedia.isThumbnailAvailable() === true) {
      return gridMedia.getThumbnailPath();
    }

    if (gridMedia.isReplacementThumbnailAvailable() === true) {
      return gridMedia.getReplacementThumbnailPath();
    }
    return null;
  }

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
      return this.imageLoadFinished.this || (imageElement && imageElement.nativeElement.complete);
    }
    return false;
  }

  public isNextMediaLoaded(): boolean {
    const nextGridMedia = this.nextGridMedia();
    if (!nextGridMedia || !nextGridMedia.isPhoto()) {
      return true;
    }
    return this.imageLoadFinished.next || this.nextImage.complete;
  }

  // Side effect: resets and starts loading the image or video of the new media.
  ngOnChanges(): void {
    // media changed
    const gridMedia = this.gridMedia();
    if (this.prevGirdPhoto !== gridMedia) {
      this.prevGirdPhoto = gridMedia;
      this.thumbnailSrc = null;
      this.liveVideoSrc = null;
      this.liveVideoClickLocked = false;
      this.photo.src = null;
      this.nextImage.src = '';
      this.nextImage.onload = null;
      this.nextImage.onerror = null;
      this.mediaLoaded = false;
      this.imageLoadFinished = {
        this: false,
        next: false
      };
    }
    this.setImageSize();
    if (
      this.thumbnailSrc == null &&
      gridMedia &&
      this.ThumbnailUrl !== null
    ) {
      this.thumbnailSrc = this.ThumbnailUrl;
    }

    if (
      this.liveVideoSrc == null &&
      gridMedia &&
      gridMedia.isLivePhoto()
    ) {
      this.liveVideoSrc = gridMedia.getLiveVideoPath();
    }

    this.loadPhoto();
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

  public startLiveVideo(): void {
    const liveVideo = this.liveVideo();
    if (!liveVideo || this.liveVideoClickLocked) {
      return;
    }
    this.liveVideoPlaying = true;
    liveVideo.nativeElement.currentTime = 0;
    liveVideo.nativeElement.play().catch(console.error);
  }

  public startLiveVideoTouch(): void {
    this.liveVideoTouchActive = true;
    this.startLiveVideo();
  }

  public stopLiveVideo(): void {
    const liveVideo = this.liveVideo();
    if (!liveVideo || this.liveVideoClickLocked) {
      return;
    }
    this.liveVideoPlaying = false;
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
    if (this.liveVideoClickLocked) {
      this.liveVideoClickLocked = false;
      this.liveVideoPlaying = false;
      liveVideo.nativeElement.pause();
    } else {
      this.liveVideoClickLocked = true;
      this.liveVideoPlaying = true;
      liveVideo.nativeElement.currentTime = 0;
      liveVideo.nativeElement.play().catch(console.error);
    }
  }

  onImageError(): void {
    // TODO:handle error
    this.imageLoadFinished.this = true;
    console.error(
      'Error: cannot load media for lightbox url: ' +
      this.gridMedia().getBestSizedMediaPath(window.innerWidth, window.innerHeight)
    );
    this.loadNextPhoto();
  }

  onImageLoad(): void {
    this.imageLoadFinished.this = true;
    this.mediaLoaded = true;
    this.loadNextPhoto();
  }

  public showThumbnail(): boolean {
    const gridMedia = this.gridMedia();
    return (
      gridMedia &&
      !this.mediaLoaded &&
      this.thumbnailSrc !== null &&
      (gridMedia.isThumbnailAvailable() ||
        gridMedia.isReplacementThumbnailAvailable())
    );
  }

  onSourceError(): void {
    this.mediaLoaded = false;
    this.videoSourceError.emit();
  }

  public onVideoProgress(): void {
    this.videoProgress =
      (100 / this.video().nativeElement.duration) *
      this.video().nativeElement.currentTime;
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
      this.imageLoadFinished.next = true;
      return;
    }
    this.nextImage.src = nextGridMedia.getBestSizedMediaPath(window.innerWidth, window.innerHeight);

    this.nextImage.onload = () => this.imageLoadFinished.next = true;
    this.nextImage.onerror = () => {
      console.error('Cant preload:' + this.nextImage.src);
      this.imageLoadFinished.next = true;
    };

    if (this.nextImage.complete) {
      this.imageLoadFinished.next = true;
    }
  }

  /**
   * Checks if the available preview size is adequate for lightbox display.
   * Returns false if the preview would be significantly smaller than the lightbox area.
   */
  private isPreviewAdequateForLightbox(): boolean {
    if (!Config.Gallery.Lightbox.loadFullImageIfPreviewTooSmall) {
      return true;
    }

    const selectedSize = this.gridMedia().getMediaSize(window.innerWidth, window.innerHeight);
    const minDisplaySize = Math.min(window.innerWidth, window.innerHeight);

    // If the selected preview size is less than 50% of the minimum display dimension,
    // consider it inadequate for lightbox display (e.g., 240px on a 1080p screen)
    return selectedSize >= minDisplaySize * 0.5;
  }

  private loadPhoto(): void {
    const gridMedia = this.gridMedia();
    if (!gridMedia || !this.loadMedia() || !gridMedia.isPhoto()) {
      return;
    }

    if (
      this.zoom() === 1 ||
      Config.Gallery.Lightbox.loadFullImageOnZoom === false
    ) {
      if (this.photo.src == null) {
        // Check if the preview size is adequate for lightbox display
        // If not, load the original instead of a tiny preview
        if (this.isPreviewAdequateForLightbox()) {
          this.photo.src = gridMedia.getBestSizedMediaPath(window.innerWidth, window.innerHeight);
          this.photo.isBestFit = true;
        } else {
          this.photo.src = gridMedia.getOriginalMediaPath();
          this.photo.isBestFit = false;
        }
      }
      // on zoom load high res photo
    } else if (this.photo.isBestFit === true || this.photo.src == null) {
      this.photo.src = gridMedia.getOriginalMediaPath();
      this.photo.isBestFit = false;
    }
  }

  private setImageSize(): void {
    const gridMedia = this.gridMedia();
    if (!gridMedia) {
      return;
    }

    const photoAspect = MediaDTOUtils.calcAspectRatio(gridMedia.media);

    if (photoAspect < this.windowAspect()) {
      this.imageSize.height = '100';
      this.imageSize.width = null;
    } else {
      this.imageSize.height = null;
      this.imageSize.width = '100';
    }
  }
}

