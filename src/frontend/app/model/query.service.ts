import {Injectable, computed, inject} from '@angular/core';
import {Location} from '@angular/common';
import {ShareService} from '../ui/gallery/share.service';
import {MediaDTO} from '../../../common/entities/MediaDTO';
import {QueryParams} from '../../../common/QueryParams';
import {Utils} from '../../../common/Utils';
import {Config} from '../../../common/config/public/Config';
import {ParentDirectoryDTO, SubDirectoryDTO,} from '../../../common/entities/DirectoryDTO';
import {ContentLoaderService} from '../ui/gallery/contentLoader.service';

/**
 * The history state of a media opened in the lightbox (see QueryService.getLightboxLink()).
 */
export interface LightboxHistoryState {
  lightboxClosesWithBack?: boolean;
  lightboxRevealsInGrid?: boolean;
}

@Injectable({providedIn: 'root'})
export class QueryService {
  private shareService = inject(ShareService);
  private galleryService = inject(ContentLoaderService);
  private location = inject(Location);

  getMediaStringId(media: MediaDTO): string {
    if (this.galleryService.isSearchResult()) {
      return Utils.concatUrls(
        media.directory.path,
        media.directory.name,
        media.name
      );
    } else {
      return media.name;
    }
  }

  // the query params of a gallery link (keeps the sharing key)
  public readonly params = computed((): Record<string, string> => this.getParams());

  getParams(lightbox?: { media?: MediaDTO,map?:boolean}): Record<string, string> {
    const query: Record<string, string> = {};
    if (lightbox?.media) {
      query[QueryParams.gallery.photo] = this.getMediaStringId(lightbox?.media);
    }
    if (lightbox?.map && !lightbox?.media) {
      query[QueryParams.gallery.map.show] = 'true';
    }
    if (Config.Sharing.enabled === true) {
      const sharingKey = this.shareService.getSharingKey();
      if (this.shareService.isSharing() && sharingKey) {
        query[QueryParams.gallery.sharingKey_query] = sharingKey;
      }
    }
    return query;
  }

  /**
   * The link that opens the lightbox on a media from the page it is opened on (the grid, the map).
   * Its history state marks that page as the history entry before the media, so closing the lightbox
   * goes back to it instead of adding the page again, which back would leave behind (#470).
   * @param revealInGrid the lightbox zooms in from the tile of the media and back into it, scrolling the grid there;
   * false when the grid is not the page under it (the map), so the page does not scroll behind it.
   */
  getLightboxLink(media: MediaDTO, revealInGrid = true): { queryParams: Record<string, string>, state: LightboxHistoryState } {
    return {queryParams: this.getParams({media}), state: {lightboxClosesWithBack: true, lightboxRevealsInGrid: revealInGrid}};
  }

  /**
   * The shown media was opened with getLightboxLink(): closing the lightbox goes back.
   */
  lightboxClosesWithBack(): boolean {
    return !!(this.location.getState() as LightboxHistoryState | null)?.lightboxClosesWithBack;
  }

  /**
   * The lightbox zooms in from the tile of the shown media (see getLightboxLink()); also for a media opened from a link.
   */
  lightboxRevealsInGrid(): boolean {
    return (this.location.getState() as LightboxHistoryState | null)?.lightboxRevealsInGrid !== false;
  }

  /**
   * The history state for a navigation that replaces the URL of the shown media: keeps the state of getLightboxLink().
   */
  keepLightboxState(): LightboxHistoryState {
    return {lightboxClosesWithBack: this.lightboxClosesWithBack(), lightboxRevealsInGrid: this.lightboxRevealsInGrid()};
  }

  getParamsForDirs(directory: ParentDirectoryDTO | SubDirectoryDTO): Record<string, unknown> {
    const params: Record<string, unknown> = {};
    if (Config.Sharing.enabled === true) {
      if (this.shareService.isSharing()) {
        params[QueryParams.gallery.sharingKey_query] =
          this.shareService.getSharingKey();
      }
    }
    if (
      directory &&
      directory.lastModified &&
      directory.lastScanned &&
      !directory.isPartial
    ) {
      params[QueryParams.gallery.knownLastModified] = directory.lastModified;
      params[QueryParams.gallery.knownLastScanned] = directory.lastScanned;
    }

    return params;
  }
}
