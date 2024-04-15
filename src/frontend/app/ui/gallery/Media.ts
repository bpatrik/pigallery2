import {Utils} from '../../../../common/Utils';
import {MediaIcon} from './MediaIcon';
import {Config} from '../../../../common/config/public/Config';
import {MediaDTO, MediaDTOUtils} from '../../../../common/entities/MediaDTO';

export class Media extends MediaIcon {

  constructor(
      media: MediaDTO,
      public renderWidth: number,
      public renderHeight: number
  ) {
    super(media);
  }

  thumbnailLoaded(): void {
    if (!this.isThumbnailAvailable()) {
      this.media.missingThumbnails = this.media.missingThumbnails || 0;
      this.media.missingThumbnails -=
          MediaIcon.ThumbnailMap[this.getThumbnailSize()];
      if (this.media.missingThumbnails < 0) {
        throw new Error('missingThumbnails got below 0');
      }
    }
  }

  getThumbnailSize(): number {
    return this.getMediaSize(this.renderWidth,this.renderHeight);
  }

  getReplacementThumbnailSize(): number {
    if (this.replacementSizeCache === false) {
      this.replacementSizeCache = null;

      const size = this.getThumbnailSize();
      if (this.media.missingThumbnails) {
        for (const thSize of Config.Media.Photo.thumbnailSizes) {
          // eslint-disable-next-line no-bitwise
          if (
              (this.media.missingThumbnails & MediaIcon.ThumbnailMap[thSize]) ===
              0 &&
              thSize < size
          ) {
            this.replacementSizeCache = thSize;
            break;
          }
        }
      }
    }
    return this.replacementSizeCache as number;
  }

  isReplacementThumbnailAvailable(): boolean {
    return this.getReplacementThumbnailSize() !== null;
  }

  isThumbnailAvailable(): boolean {
    // eslint-disable-next-line no-bitwise
    return (
        (this.media.missingThumbnails &
            MediaIcon.ThumbnailMap[this.getThumbnailSize()]) ===
        0
    );
  }

  getReplacementThumbnailPath(): string {
    const size = this.getReplacementThumbnailSize();
    return Utils.concatUrls(
        Config.Server.urlBase,
        Config.Server.apiPath,
        '/gallery/content/',
        this.getRelativePath(),
        size.toString()
    );
  }

  hasPositionData(): boolean {
    return MediaDTOUtils.hasPositionData(this.media);
  }

  getThumbnailPath(): string {
    return this.getBestSizedMediaPath(this.renderWidth,this.renderHeight);
  }
}
