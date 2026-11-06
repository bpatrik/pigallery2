import { Component, ElementRef, OnDestroy, OnInit, computed, inject, viewChild, input, signal } from '@angular/core';
import {type Dimension, IRenderable} from '../../../../model/IRenderable';
import {GridMedia} from '../GridMedia';
import {RouterLink} from '@angular/router';
import {Thumbnail, ThumbnailManagerService,} from '../../thumbnailManager.service';
import {Config} from '../../../../../../common/config/public/Config';
import {PageHelper} from '../../../../model/page.helper';
import {PhotoDTO, PhotoMetadata,} from '../../../../../../common/entities/PhotoDTO';
import {SearchQueryTypes} from '../../../../../../common/entities/SearchQueryDTO';
import {AuthenticationService} from '../../../../model/network/authentication.service';
import {ExtensionService} from '../../../../model/extension.service';
import {MediaButtonModalService} from './media-button-modal/media-button-modal.service';

import {GalleryPhotoLoadingComponent} from './loading/loading.photo.grid.gallery.component';
import {NgIconComponent} from '@ng-icons/core';
import {DurationPipe} from '../../../../pipes/DurationPipe';
import {SafeHtmlPipe} from '../../../../pipes/SafeHTMLPipe';
import type {IClientMediaButtonConfig, IMetadataFilter} from '../../../../../../common/entities/extension/IClientUIConfig';
import {Utils} from '../../../../../../common/Utils';
import {SearchQueryUtils} from '../../../../../../common/SearchQueryUtils';

export interface IClientMediaButtonConfigWithBaseApiPath extends IClientMediaButtonConfig {
  extensionBasePath: string;
}

@Component({
  selector: 'app-gallery-grid-photo',
  templateUrl: './photo.grid.gallery.component.html',
  styleUrl: './photo.grid.gallery.component.css',
  imports: [
    GalleryPhotoLoadingComponent,
    NgIconComponent,
    RouterLink,
    DurationPipe,
    SafeHtmlPipe
]
})
export class GalleryPhotoComponent implements IRenderable, OnInit, OnDestroy {
  private thumbnailService = inject(ThumbnailManagerService);
  private authService = inject(AuthenticationService);
  private extensionService = inject(ExtensionService);
  private modalService = inject(MediaButtonModalService);
  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly gridMedia = input.required<GridMedia>();
  readonly imageRef = viewChild<ElementRef>('img');
  readonly container = viewChild.required<ElementRef>('photoContainer');

  thumbnail: Thumbnail;
  readonly infoBarVisible = signal(false);
  animationTimer: number | null = null;

  readonly SearchQueryTypes: typeof SearchQueryTypes = SearchQueryTypes;
  searchEnabled = true;

  wasInView: boolean | null = null;
  loaded = false;
  public mediaButtons: IClientMediaButtonConfigWithBaseApiPath[];

  readonly isVideo = computed((): boolean => this.gridMedia().isVideo());
  readonly isLivePhoto = computed((): boolean => this.gridMedia().isLivePhoto());
  readonly hasPositionData = computed((): boolean => this.gridMedia().hasPositionData());

  readonly title = computed((): string => {
    if (Config.Gallery.captionFirstNaming === false) {
      return this.gridMedia().media.name;
    }
    const caption = (this.gridMedia().media as PhotoDTO).metadata.caption;
    if (caption) {
      if (caption.length > 20) {
        return (
          caption.substring(0, 17) +
          '...'
        );
      }
      return caption;
    }
    return this.gridMedia().media.name;
  });

  // the faces and keywords of the media with their search links, null if it has none
  readonly keywords = computed((): { value: string; type: SearchQueryTypes; link: string }[] | null => {
    const metadata = this.gridMedia().media.metadata as PhotoMetadata;
    if (
      !(metadata.keywords && metadata.keywords.length > 0) &&
      !(metadata.faces && metadata.faces.length > 0)
    ) {
      return null;
    }
    let keywords: { value: string; type: SearchQueryTypes }[] = [];
    if (Config.Faces.enabled) {
      const names: string[] = (metadata.faces || []).map(
        (f): string => f.name
      );
      keywords = names
        .filter((name, index): boolean => names.indexOf(name) === index)
        .map((n): { type: SearchQueryTypes; value: string } => ({
          value: n,
          type: SearchQueryTypes.person,
        }));
    }
    return keywords.concat(
      (metadata.keywords || []).map(
        (k): { type: SearchQueryTypes; value: string } => ({
          value: k,
          type: SearchQueryTypes.keyword,
        })
      )
    ).map(k => ({...k, link: SearchQueryUtils.urlifyExactMatch(k.type, k.value)}));
  });

  readonly positionText = computed((): string => {
    const gridMedia = this.gridMedia();
    const positionData = (gridMedia?.media as PhotoDTO | undefined)?.metadata.positionData;
    if (!gridMedia || !gridMedia.isPhoto() || !positionData) {
      return '';
    }
    return ( //not much space in the gridview, so we only deliver city, or state or country
      positionData.city ||
      positionData.state ||
      positionData.country || ''
    ).trim();
  });

  readonly positionLink = computed((): string => SearchQueryUtils.urlifyExactMatch(SearchQueryTypes.position, this.positionText()));

  constructor() {
    this.searchEnabled = this.authService.canSearch();
  }

  get ScrollListener(): boolean {
    return !this.thumbnail.Available && !this.thumbnail.Error;
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
      const gridMedia = this.gridMedia();
      if (gridMedia.isVideo() && button.skipVideos) {
        return false;
      }
      if (gridMedia.isPhoto() && button.skipPhotos) {
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

  matchesMetadataFilter(filters: IMetadataFilter[]): boolean {
    const metadata = this.gridMedia().media.metadata;

    // All filters must match (AND logic)
    return filters.every(filter => {
      // Get the value from metadata using the field path (e.g., 'rating' or 'size.width')
      const fieldParts = filter.field.split('.');
      let fieldValue: unknown = metadata;

      for (const part of fieldParts) {
        if (fieldValue === undefined || fieldValue === null) {
          break;
        }
        fieldValue = (fieldValue as Record<string, unknown>)[part];
      }

      if (fieldValue === undefined || fieldValue === null) {
        // A missing field (e.g. a photo without keywords) does not contain anything
        return filter.comparator === '!contains';
      }

      // Compare based on comparator
      switch (filter.comparator) {
        case '>=':
          return fieldValue >= filter.value;
        case '<=':
          return fieldValue <= filter.value;
        case '==':
          return fieldValue == filter.value; // Use == for loose equality
        case 'contains':
          return GalleryPhotoComponent.contains(fieldValue, filter.value);
        case '!contains':
          return !GalleryPhotoComponent.contains(fieldValue, filter.value);
        default:
          return false;
      }
    });
  }

  /**
   * Arrays (e.g. keywords): exact item match. Strings (e.g. caption): substring match.
   */
  private static contains(fieldValue: unknown, value: string | number): boolean {
    if (Array.isArray(fieldValue)) {
      return fieldValue.some(item => item == value); // Use == for loose equality
    }
    if (typeof fieldValue === 'string') {
      return fieldValue.includes(String(value));
    }
    return false;
  }

  ngOnInit(): void {
    this.thumbnail = this.thumbnailService.getThumbnail(this.gridMedia());
    this.updateMediaButtons();
  }

  ngOnDestroy(): void {
    this.thumbnail.destroy();

    if (this.animationTimer != null) {
      clearTimeout(this.animationTimer);
    }
  }

  isInView(): boolean {
    return (
      PageHelper.ScrollY <
      this.container().nativeElement.offsetTop +
      this.container().nativeElement.clientHeight &&
      PageHelper.ScrollY + window.innerHeight >
      this.container().nativeElement.offsetTop
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

  mouseOver(): void {
    this.infoBarVisible.set(true);
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
      this.infoBarVisible.set(false);
    }, 500);
  }

  onMediaButtonClick(button: IClientMediaButtonConfigWithBaseApiPath, event: Event): void {
    event.stopPropagation();
    event.preventDefault();

    if(!button.apiPath){
      return; // this is a fake button, nothing to call
    }

    if (button.popup) {
      this.modalService.showModal(button, this.gridMedia());
    } else {
      this.modalService.executeButtonAction(button, this.gridMedia());
    }
  }

  // the position of the tile in the page; also while its thumbnail is loading (no <img> yet)
  public getDimension(): Dimension {
    const host = this.elementRef.nativeElement;
    if (!host.offsetParent) {
      return {
        top: 0,
        left: 0,
        width: 0,
        height: 0,
      };
    }
    const image = this.imageRef()?.nativeElement as HTMLImageElement;
    return {
      top: host.offsetTop,
      left: host.offsetLeft,
      width: image ? image.width : this.gridMedia().renderWidth,
      height: image ? image.height : this.gridMedia().renderHeight,
    };
  }
}
