import {Injectable} from '@angular/core';
import {ShareService} from '../ui/gallery/share.service';
import {MediaDTO} from '../../../common/entities/MediaDTO';
import {QueryParams} from '../../../common/QueryParams';
import {Utils} from '../../../common/Utils';
import {Config} from '../../../common/config/public/Config';
import {ParentDirectoryDTO, SubDirectoryDTO,} from '../../../common/entities/DirectoryDTO';
import {ContentLoaderService} from '../ui/gallery/contentLoader.service';

@Injectable()
export class QueryService {
  constructor(
    private shareService: ShareService,
    private galleryService: ContentLoaderService
  ) {
  }

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

  getParams(lightbox?: { media?: MediaDTO, playing?: boolean }): { [key: string]: string } {
    const query: { [key: string]: string } = {};
    if (lightbox?.media) {
      query[QueryParams.gallery.photo] = this.getMediaStringId(lightbox?.media);
    }
    if (lightbox?.playing) {
      query[QueryParams.gallery.playback] = 'true';
    }
    if (Config.Sharing.enabled === true) {
      if (this.shareService.isSharing()) {
        query[QueryParams.gallery.sharingKey_query] =
          this.shareService.getSharingKey();
      }
    }
    return query;
  }

  getParamsForDirs(directory: ParentDirectoryDTO | SubDirectoryDTO): {
    [key: string]: any;
  } {
    const params: { [key: string]: any } = {};
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
