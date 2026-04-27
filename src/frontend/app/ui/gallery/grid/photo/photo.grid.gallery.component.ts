import {Component, ElementRef, Input, OnDestroy, OnInit, ViewChild,} from '@angular/core';
import {Dimension, IRenderable} from '../../../../model/IRenderable';
import {GridMedia} from '../GridMedia';
import {RouterLink} from '@angular/router';
import {Thumbnail, ThumbnailManagerService,} from '../../thumbnailManager.service';
import {Config} from '../../../../../../common/config/public/Config';
import {PageHelper} from '../../../../model/page.helper';
import {PhotoDTO, PhotoMetadata,} from '../../../../../../common/entities/PhotoDTO';
import {SearchQueryTypes, TextSearch, TextSearchQueryMatchTypes,} from '../../../../../../common/entities/SearchQueryDTO';
import {AuthenticationService} from '../../../../model/network/authentication.service';
import {ExtensionService} from '../../../../model/extension.service';
import {MediaButtonModalService} from './media-button-modal/media-button-modal.service';
import {NgFor, NgIf, NgSwitch, NgSwitchCase} from '@angular/common';
import {GalleryPhotoLoadingComponent} from './loading/loading.photo.grid.gallery.component';
import {NgIconComponent} from '@ng-icons/core';
import {DurationPipe} from '../../../../pipes/DurationPipe';
import {SafeHtmlPipe} from '../../../../pipes/SafeHTMLPipe';
import {IClientMediaButtonConfig} from '../../../../../../common/entities/extension/IClientUIConfig';
import {Utils} from '../../../../../../common/Utils';
import {SearchQueryUtils} from '../../../../../../common/SearchQueryUtils';

export interface IClientMediaButtonConfigWithBaseApiPath extends IClientMediaButtonConfig {
  extensionBasePath: string;
}

@Component({
  selector: 'app-gallery-grid-photo',
  templateUrl: './photo.grid.gallery.component.html',
  styleUrls: ['./photo.grid.gallery.component.css'],
  imports: [
    NgIf,
    GalleryPhotoLoadingComponent,
    NgIconComponent,
    RouterLink,
    NgFor,
    NgSwitch,
    NgSwitchCase,
    DurationPipe,
    SafeHtmlPipe,
  ]
})
export class GalleryPhotoComponent implements IRenderable, OnInit, OnDestroy {
  @Input() gridMedia: GridMedia;
  @ViewChild('img', {static: false}) imageRef: ElementRef;
  @ViewChild('photoContainer', {static: true}) container: ElementRef;
  @ViewChild('hoverVideo', {static: false}) hoverVideoRef: ElementRef<HTMLVideoElement>;

  protected readonly Config = Config;

  thumbnail: Thumbnail;
  keywords: { value: string; type: SearchQueryTypes }[] = null;
  infoBarVisible = false;
  animationTimer: number = null;

  readonly SearchQueryTypes: typeof SearchQueryTypes = SearchQueryTypes;
  searchEnabled = true;

  wasInView: boolean = null;
  loaded = false;
  videoPlaying = false;
  private videoSrcLoaded = false;
  private hoverTimer: number = null;
  private touchHoverTimer: number = null;
  public mediaButtons: IClientMediaButtonConfigWithBaseApiPath[];

  constructor(
    private thumbnailService: ThumbnailManagerService,
    private authService: AuthenticationService,
    private extensionService: ExtensionService,
    private modalService: MediaButtonModalService
  ) {
    this.searchEnabled = this.authService.canSearch();
  }

  get ScrollListener(): boolean {
    return !this.thumbnail.Available && !this.thumbnail.Error;
  }

  get Title(): string {
    if (Config.Gallery.captionFirstNaming === false) {
      return this.gridMedia.media.name;
    }
    if ((this.gridMedia.media as PhotoDTO).metadata.caption) {
      if ((this.gridMedia.media as PhotoDTO).metadata.caption.length > 20) {
        return (
          (this.gridMedia.media as PhotoDTO).metadata.caption.substring(0, 17) +
          '...'
        );
      }
      return (this.gridMedia.media as PhotoDTO).metadata.caption;
    }
    return this.gridMedia.media.name;
  }

  updateMediaButtons(): void {
    if (!this.extensionService.UIExtensionConfig) {
      return;
    }

    const allButtons: IClientMediaButtonConfigWithBaseApiPath[] = [];
    this.extensionService.UIExtensionConfig.forEach(config => {
      if (config.mediaButtons) {
        const buttons: IClientMediaButtonConfigWithBaseApiPath[] = Utils.clone(config.mediaButtons)
          .map((b: IClientMediaButtonConfigWithBaseApiPath) => {
            b.extensionBasePath = config.extensionBasePath;
            return b;
          });

        allButtons.push(...buttons);
      }
    });

    this.mediaButtons = allButtons.filter(button => {
      if (this.gridMedia.isVideo() && button.skipVideos) {
        return false;
      }
      if (this.gridMedia.isPhoto() && button.skipPhotos) {
        return false;
      }

      // Check metadataFilter
      if (button.metadataFilter && button.metadataFilter.length > 0) {
        return this.matchesMetadataFilter(button.metadataFilter);
      }

      return true;
    });

    // move always visible buttons to the front
    this.mediaButtons = [...this.mediaButtons.filter(b => b.alwaysVisible), ...this.mediaButtons.filter(b => !b.alwaysVisible)];
  }

  matchesMetadataFilter(filters: { field: string, comparator: '>=' | '<=' | '==', value: string | number }[]): boolean {
    const metadata = this.gridMedia.media.metadata;

    // All filters must match (AND logic)
    return filters.every(filter => {
      // Get the value from metadata using the field path (e.g., 'rating' or 'size.width')
      const fieldParts = filter.field.split('.');
      let fieldValue: any = metadata;

      for (const part of fieldParts) {
        if (fieldValue === undefined || fieldValue === null) {
          return false;
        }
        fieldValue = fieldValue[part];
      }

      if (fieldValue === undefined || fieldValue === null) {
        return false;
      }

      // Compare based on comparator
      switch (filter.comparator) {
        case '>=':
          return fieldValue >= filter.value;
        case '<=':
          return fieldValue <= filter.value;
        case '==':
          return fieldValue == filter.value; // Use == for loose equality
        default:
          return false;
      }
    });
  }

  ngOnInit(): void {
    this.thumbnail = this.thumbnailService.getThumbnail(this.gridMedia);
    const metadata = this.gridMedia.media.metadata as PhotoMetadata;
    if (
      (metadata.keywords && metadata.keywords.length > 0) ||
      (metadata.faces && metadata.faces.length > 0)
    ) {
      this.keywords = [];
      if (Config.Faces.enabled) {
        const names: string[] = (metadata.faces || []).map(
          (f): string => f.name
        );
        this.keywords = names
          .filter((name, index): boolean => names.indexOf(name) === index)
          .map((n): { type: SearchQueryTypes; value: string } => ({
            value: n,
            type: SearchQueryTypes.person,
          }));
      }
      this.keywords = this.keywords.concat(
        (metadata.keywords || []).map(
          (k): { type: SearchQueryTypes; value: string } => ({
            value: k,
            type: SearchQueryTypes.keyword,
          })
        )
      );
    }

    this.updateMediaButtons();
  }

  ngOnDestroy(): void {
    this.thumbnail.destroy();

    if (this.animationTimer != null) {
      clearTimeout(this.animationTimer);
    }
    if (this.hoverTimer != null) clearTimeout(this.hoverTimer);
    if (this.touchHoverTimer != null) clearTimeout(this.touchHoverTimer);
    this.stopHoverVideo();
  }

  isInView(): boolean {
    return (
      PageHelper.ScrollY <
      this.container.nativeElement.offsetTop +
      this.container.nativeElement.clientHeight &&
      PageHelper.ScrollY + window.innerHeight >
      this.container.nativeElement.offsetTop
    );
  }

  onScroll(): void {
    if (this.thumbnail.Available === true || this.thumbnail.Error === true) {
      return;
    }
    const isInView = this.isInView();
    if (this.wasInView !== isInView) {
      this.wasInView = isInView;
      this.thumbnail.Visible = isInView;
    }
  }

  getPositionSearchQuery(): string {
    return SearchQueryUtils.urlify({
      type: SearchQueryTypes.position,
      matchType: TextSearchQueryMatchTypes.exact_match,
      value: this.getPositionText(),
    } as TextSearch);
  }

  getTextSearchQuery(name: string, type: SearchQueryTypes): string {
    return SearchQueryUtils.urlify({
      type,
      matchType: TextSearchQueryMatchTypes.exact_match,
      value: name,
    } as TextSearch);
  }

  getPositionText(): string {
    if (!this.gridMedia || !this.gridMedia.isPhoto() || !(this.gridMedia.media as PhotoDTO).metadata.positionData) {
      return '';
    }
    return ( //not much space in the gridview, so we only deliver city, or state or country
      (this.gridMedia.media as PhotoDTO).metadata.positionData.city ||
      (this.gridMedia.media as PhotoDTO).metadata.positionData.state ||
      (this.gridMedia.media as PhotoDTO).metadata.positionData.country || ''
    ).trim();
  }

  mouseOver(): void {
    this.infoBarVisible = true;
    if (this.animationTimer != null) {
      clearTimeout(this.animationTimer);
      this.animationTimer = null;
    }
  }

  mouseOut(): void {
    if (this.animationTimer != null) {
      clearTimeout(this.animationTimer);
    }
    this.animationTimer = window.setTimeout((): void => {
      this.animationTimer = null;
      this.infoBarVisible = false;
    }, 500);
  }

  onMediaButtonClick(button: IClientMediaButtonConfigWithBaseApiPath, event: Event): void {
    event.stopPropagation();
    event.preventDefault();

    if(!button.apiPath){
      return; // this is a fake button, nothing to call
    }

    if (button.popup) {
      this.modalService.showModal(button, this.gridMedia);
    } else {
      this.modalService.executeButtonAction(button, this.gridMedia);
    }
  }

  onMouseEnterCard(): void {
    if (!Config.Gallery.playVideoOnHover || !this.gridMedia.isVideo()) return;
    if (this.hoverTimer != null) clearTimeout(this.hoverTimer);
    this.hoverTimer = window.setTimeout(() => {
      this.hoverTimer = null;
      this.startHoverVideo();
    }, 300);
  }

  onMouseLeaveCard(): void {
    if (this.hoverTimer != null) {
      clearTimeout(this.hoverTimer);
      this.hoverTimer = null;
    }
    this.stopHoverVideo();
  }

  onTouchStart(): void {
    if (!Config.Gallery.playVideoOnHover || !this.gridMedia.isVideo()) return;
    if (this.touchHoverTimer != null) clearTimeout(this.touchHoverTimer);
    this.touchHoverTimer = window.setTimeout(() => {
      this.touchHoverTimer = null;
      this.startHoverVideo();
    }, 600);
  }

  onTouchEnd(): void {
    if (this.touchHoverTimer != null) {
      clearTimeout(this.touchHoverTimer);
      this.touchHoverTimer = null;
    }
    this.stopHoverVideo();
  }

  private async startHoverVideo(): Promise<void> {
    const video = this.hoverVideoRef?.nativeElement;
    if (!video) return;
    if (!this.videoSrcLoaded) {
      video.src = this.gridMedia.getBestFitVideoPath();
      this.videoSrcLoaded = true;
    }
    try {
      await video.play();
      if (!video.paused) {
        this.videoPlaying = true;
      }
    } catch {
      // play() aborted (e.g., mouse left before video loaded)
    }
  }

  private stopHoverVideo(): void {
    this.videoPlaying = false;
    const video = this.hoverVideoRef?.nativeElement;
    if (!video) return;
    video.pause();
    video.currentTime = 0;
  }

  public getDimension(): Dimension {
    if (!this.imageRef?.nativeElement?.offsetParent) {
      return {
        top: 0,
        left: 0,
        width: 0,
        height: 0,
      };
    }
    return {
      top: this.imageRef.nativeElement.offsetParent.offsetTop,
      left: this.imageRef.nativeElement.offsetParent.offsetLeft,
      width: this.imageRef.nativeElement.width,
      height: this.imageRef.nativeElement.height,
    };
  }
}
