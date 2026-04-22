import {Media} from '../Media';
import {MediaDTO, MediaDTOUtils,} from '../../../../../common/entities/MediaDTO';
import {PhotoDTO} from '../../../../../common/entities/PhotoDTO';
import {VideoDTO} from '../../../../../common/entities/VideoDTO';
import {Utils} from '../../../../../common/Utils';
import {Config} from '../../../../../common/config/public/Config';

export class GridMedia extends Media {
  constructor(
      media: MediaDTO,
      renderWidth: number,
      renderHeight: number,
      public rowId: number
  ) {
    super(media, renderWidth, renderHeight);
  }

  get Video(): VideoDTO {
    return this.media as VideoDTO;
  }

  get Photo(): PhotoDTO {
    return this.media as PhotoDTO;
  }

  isPhoto(): boolean {
    return MediaDTOUtils.isPhoto(this.media);
  }

  isVideo(): boolean {
    return MediaDTOUtils.isVideo(this.media);
  }

  isLivePhoto(): boolean {
    return !!this.media.liveVideoPath;
  }

  getLiveVideoPath(): string {
    if (!this.media.liveVideoPath) {
      return null;
    }
    const encodedPath = encodeURI(this.media.liveVideoPath)
      .replace(new RegExp('#', 'g'), '%23')
      .replace(new RegExp('\\$', 'g'), '%24')
      .replace(new RegExp('\\?', 'g'), '%3F');
    return Utils.concatUrls(
      Config.Server.urlBase,
      Config.Server.apiPath,
      '/gallery/content/',
      encodedPath,
      '/bestFit'
    );
  }

  public isVideoTranscodingNeeded(): boolean {
    return MediaDTOUtils.isVideoTranscodingNeeded(this.media);
  }
}
