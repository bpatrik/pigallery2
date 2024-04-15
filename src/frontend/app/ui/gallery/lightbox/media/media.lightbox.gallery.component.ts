import {Component, ElementRef, EventEmitter, Input, OnChanges, Output, ViewChild,} from '@angular/core';
import {GridMedia} from '../../grid/GridMedia';
import {MediaDTOUtils} from '../../../../../../common/entities/MediaDTO';
import {DomSanitizer, SafeStyle} from '@angular/platform-browser';
import {SupportedFormats} from '../../../../../../common/SupportedFormats';
import {Config} from '../../../../../../common/config/public/Config';
import {LightboxService} from '../lightbox.service';

@Component({
  selector: 'app-gallery-lightbox-media',
  styleUrls: ['./media.lightbox.gallery.component.css'],
  templateUrl: './media.lightbox.gallery.component.html',
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

  prevGirdPhoto: GridMedia = null;

  public imageSize = {width: 'auto', height: '100'};
  private nextImage = new Image();
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

  private loadPhoto(): void {
    if (!this.gridMedia || !this.loadMedia || !this.gridMedia.isPhoto()) {
      return;
    }

    if (
      this.zoom === 1 ||
      Config.Gallery.Lightbox.loadFullImageOnZoom === false
    ) {
      if (this.photo.src == null) {
        this.photo.src = this.gridMedia.getBestSizedMediaPath(window.innerWidth, window.innerHeight);
        this.photo.isBestFit = true;
      }
      // on zoom load high res photo
    } else if (this.photo.isBestFit === true || this.photo.src == null) {
      this.photo.src = this.gridMedia.getOriginalMediaPath();
      this.photo.isBestFit = false;
    }
  }

  public onVideoProgress(): void {
    this.videoProgress =
      (100 / this.video.nativeElement.duration) *
      this.video.nativeElement.currentTime;
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

