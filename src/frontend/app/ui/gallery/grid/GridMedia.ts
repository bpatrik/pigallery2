import {Media} from '../Media';
import {MediaDTO, MediaDTOUtils,} from '../../../../../common/entities/MediaDTO';
import {PhotoDTO} from '../../../../../common/entities/PhotoDTO';
import {VideoDTO} from '../../../../../common/entities/VideoDTO';

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

  public isVideoTranscodingNeeded(): boolean {
    return MediaDTOUtils.isVideoTranscodingNeeded(this.media);
  }
}
