import {Component, ElementRef, EventEmitter, Input, OnChanges, Output, ViewChild,} from '@angular/core';
import {GridMedia} from '../../grid/GridMedia';
import {MediaDTOUtils} from '../../../../../../common/entities/MediaDTO';
import {DomSanitizer, SafeStyle} from '@angular/platform-browser';
import {SupportedFormats} from '../../../../../../common/SupportedFormats';
import {Config} from '../../../../../../common/config/public/Config';
import {LightboxService} from '../lightbox.service';
import {NgIf} from '@angular/common';

@Component({
  selector: 'app-gallery-lightbox-media',
  styleUrls: ['./media.lightbox.gallery.component.css'],
  templateUrl: './media.lightbox.gallery.component.html',
  imports: [NgIf]
})
export class GalleryLightboxMediaComponent implements OnChanges {
  @Input() gridMedia: GridMedia;
  @Input() nextGridMedia: GridMedia;
  @Input() loadMedia = false; // prevents loading media
  @Input() windowAspect = 1;
  @Input() zoom = 1;
  @Input() drag = {x: 0, y: 0};
  @Output() videoSourceError = new EventEmitter();

  @ViewChild('video', {static: false}) video: ElementRef<HTMLVideoElement>;
  @ViewChild('image', {static: false}) imageElement: ElementRef<HTMLImageElement>;

  prevGirdPhoto: GridMedia = null;

  public imageSize = {width: 'auto', height: '100'};
  // do not skip to the next photo if not both are loaded (or resulted in an error)
  public imageLoadFinished = {
    this: false,
    next: false
  };
  thumbnailSrc: string = null;
  photo = {
    src: null as string,
    isBestFit: null as boolean,
  };
  public transcodeNeedVideos = SupportedFormats.TranscodeNeed.Videos;
  private nextImage = new Image();
  // if media not loaded, show thumbnail
  private mediaLoaded = false;
  private videoProgress = 0;

  constructor(public elementRef: ElementRef,
              public lightboxService: LightboxService,
              private sanitizer: DomSanitizer) {
  }

  get ImageTransform(): SafeStyle {
    return this.sanitizer.bypassSecurityTrustStyle(
      'scale(' +
      this.zoom +
      ') translate(calc(' +
      -50 / this.zoom +
      '% + ' +
      this.drag.x / this.zoom +
      'px), calc(' +
      -50 / this.zoom +
      '% + ' +
      this.drag.y / this.zoom +
      'px))'
    );
  }

  public get VideoProgress(): number {
    return this.videoProgress;
  }

  public set VideoProgress(value: number) {
    if (!this.video && value === null && typeof value === 'undefined') {
      return;
    }
    this.video.nativeElement.currentTime =
      this.video.nativeElement.duration * (value / 100);
    if (this.video.nativeElement.paused) {
      this.video.nativeElement.play().catch(console.error);
    }
  }

  public get VideoVolume(): number {
    if (!this.video) {
      return 1;
    }
    return this.video.nativeElement.volume;
  }

  public set VideoVolume(value: number) {
    if (!this.video) {
      return;
    }
    this.video.nativeElement.muted = false;
    this.video.nativeElement.volume = value;
  }

  public get Muted(): boolean {
    if (!this.video) {
      return false;
    }
    return this.video.nativeElement.muted;
  }

  public get Paused(): boolean {
    if (!this.video) {
      return true;
    }
    return this.video.nativeElement.paused;
  }

  private get ThumbnailUrl(): string {
    if (this.gridMedia.isThumbnailAvailable() === true) {
      return this.gridMedia.getThumbnailPath();
    }

    if (this.gridMedia.isReplacementThumbnailAvailable() === true) {
      return this.gridMedia.getReplacementThumbnailPath();
    }
    return null;
  }

  public isRenderedMediaLoaded(): boolean {
    if (!this.gridMedia) {
      return false;
    }
    if (this.gridMedia.isVideo()) {
      return !!this.video && this.video.nativeElement.readyState >= 3; // HAVE_FUTURE_DATA
    }
    if (this.gridMedia.isPhoto()) {
      return this.imageLoadFinished.this || (this.imageElement && this.imageElement.nativeElement.complete);
    }
    return false;
  }

  public isNextMediaLoaded(): boolean {
    if (!this.nextGridMedia || !this.nextGridMedia.isPhoto()) {
      return true;
    }
    return this.imageLoadFinished.next || this.nextImage.complete;
  }

  ngOnChanges(): void {
    // media changed
    if (this.prevGirdPhoto !== this.gridMedia) {
      this.prevGirdPhoto = this.gridMedia;
      this.thumbnailSrc = null;
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
      this.gridMedia &&
      this.ThumbnailUrl !== null
    ) {
      this.thumbnailSrc = this.ThumbnailUrl;
    }

    this.loadPhoto();
  }

  public mute(): void {
    if (!this.video) {
      return;
    }

    this.video.nativeElement.muted = !this.video.nativeElement.muted;
  }

  public playPause(): void {
    if (!this.video) {
      return;
    }
    if (this.video.nativeElement.paused) {
      this.video.nativeElement.play().catch(console.error);
    } else {
      this.video.nativeElement.pause();
    }
  }

  onImageError(): void {
    // TODO:handle error
    this.imageLoadFinished.this = true;
    console.error(
      'Error: cannot load media for lightbox url: ' +
      this.gridMedia.getBestSizedMediaPath(window.innerWidth, window.innerHeight)
    );
    this.loadNextPhoto();
  }

  onImageLoad(): void {
    this.imageLoadFinished.this = true;
    this.mediaLoaded = true;
    this.loadNextPhoto();
  }

  public showThumbnail(): boolean {
    return (
      this.gridMedia &&
      !this.mediaLoaded &&
      this.thumbnailSrc !== null &&
      (this.gridMedia.isThumbnailAvailable() ||
        this.gridMedia.isReplacementThumbnailAvailable())
    );
  }

  onSourceError(): void {
    this.mediaLoaded = false;
    this.videoSourceError.emit();
  }

  public onVideoProgress(): void {
    this.videoProgress =
      (100 / this.video.nativeElement.duration) *
      this.video.nativeElement.currentTime;
  }

  /**
   * Loads next photo to faster show it on navigation.
   * Called after the current photo is loaded
   * @private
   */
  private loadNextPhoto(): void {
    if (!this.nextGridMedia || !this.loadMedia) {
      return;
    }
    // Videos do not support preloading
    if (!this.nextGridMedia.isPhoto()) {
      this.imageLoadFinished.next = true;
      return;
    }
    this.nextImage.src = this.nextGridMedia.getBestSizedMediaPath(window.innerWidth, window.innerHeight);

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

    const selectedSize = this.gridMedia.getMediaSize(window.innerWidth, window.innerHeight);
    const minDisplaySize = Math.min(window.innerWidth, window.innerHeight);

    // If the selected preview size is less than 50% of the minimum display dimension,
    // consider it inadequate for lightbox display (e.g., 240px on a 1080p screen)
    return selectedSize >= minDisplaySize * 0.5;
  }

  private loadPhoto(): void {
    if (!this.gridMedia || !this.loadMedia || !this.gridMedia.isPhoto()) {
      return;
    }

    if (
      this.zoom === 1 ||
      Config.Gallery.Lightbox.loadFullImageOnZoom === false
    ) {
      if (this.photo.src == null) {
        // Check if the preview size is adequate for lightbox display
        // If not, load the original instead of a tiny preview
        if (this.isPreviewAdequateForLightbox()) {
          this.photo.src = this.gridMedia.getBestSizedMediaPath(window.innerWidth, window.innerHeight);
          this.photo.isBestFit = true;
        } else {
          this.photo.src = this.gridMedia.getOriginalMediaPath();
          this.photo.isBestFit = false;
        }
      }
      // on zoom load high res photo
    } else if (this.photo.isBestFit === true || this.photo.src == null) {
      this.photo.src = this.gridMedia.getOriginalMediaPath();
      this.photo.isBestFit = false;
    }
  }

  private setImageSize(): void {
    if (!this.gridMedia) {
      return;
    }

    const photoAspect = MediaDTOUtils.calcAspectRatio(this.gridMedia.media);

    if (photoAspect < this.windowAspect) {
      this.imageSize.height = '100';
      this.imageSize.width = null;
    } else {
      this.imageSize.height = null;
      this.imageSize.width = '100';
    }
  }
}

