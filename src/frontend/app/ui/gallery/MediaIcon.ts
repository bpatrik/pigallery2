import {Utils} from '../../../../common/Utils';
import {Config} from '../../../../common/config/public/Config';
import {MediaDTO} from '../../../../common/entities/MediaDTO';
import {ContentWrapperUtils} from '../../../../common/entities/ContentWrapper';

export class MediaIcon {
  protected static readonly ThumbnailMap =
    Config.Media.Photo.generateThumbnailMap();
  static readonly sortedThumbnailSizes =
    Config.Media.Photo.thumbnailSizes.sort((a, b): number => a - b);


  protected replacementSizeCache: number | boolean = false;

  constructor(public media: MediaDTO) {
  }

  getExtension(): string {
    return this.media.name.substr(this.media.name.lastIndexOf('.') + 1);
  }

  iconLoaded(): void {
    this.media.missingThumbnails -=
      MediaIcon.ThumbnailMap[Config.Media.Photo.iconSize];
  }

  isIconAvailable(): boolean {
    // eslint-disable-next-line no-bitwise
    return (
      (this.media.missingThumbnails &
        MediaIcon.ThumbnailMap[Config.Media.Photo.iconSize]) ===
      0
    );
  }


  isPhotoAvailable(renderWidth: number, renderHeight: number): boolean {
    const size = this.getMediaSize(renderWidth, renderHeight);
    // eslint-disable-next-line no-bitwise
    return (
      (this.media.missingThumbnails &
        MediaIcon.ThumbnailMap[size]) === 0
    );
  }

  getReadableRelativePath(): string {
    return Utils.concatUrls(
      this.media.directory.path,
      this.media.directory.name,
      this.media.name
    );
  }

  getRelativePath(): string {
    return (
      encodeURI(
        this.getReadableRelativePath()
      )
        // do not escape all urls with encodeURIComponent because that make the URL ugly and not needed
        // do not escape before concatUrls as that would make prevent optimizations
        // .replace(new RegExp('%', 'g'), '%25') // order important
        .replace(new RegExp('#', 'g'), '%23')
        .replace(new RegExp('\\$', 'g'), '%24')
        .replace(new RegExp('\\?', 'g'), '%3F')
    );
  }

  getIconPath(): string {
    return Utils.concatUrls(
      Config.Server.urlBase,
      Config.Server.apiPath,
      '/gallery/content/',
      this.getRelativePath(),
      'icon'
    );
  }

  getOriginalMediaPath(): string {
    return Utils.concatUrls(
      Config.Server.urlBase,
      Config.Server.apiPath,
      '/gallery/content/',
      this.getRelativePath()
    );
  }

  getMediaSize(renderWidth: number, renderHeight: number): number {
    const longerEdge = Math.max(renderWidth, renderHeight);
    return Utils.findClosestinSorted(longerEdge, MediaIcon.sortedThumbnailSizes);
  }

  /**
   * @param renderWidth bonding box width
   * @param renderHeight bounding box height
   */
  getBestSizedMediaPath(renderWidth: number, renderHeight: number): string {
    const size = this.getMediaSize(renderWidth, renderHeight);
    return Utils.concatUrls(
      Config.Server.urlBase,
      Config.Server.apiPath,
      '/gallery/content/',
      this.getRelativePath(),
      size.toString()
    );
  }

  /**
   * Uses the converted video if the original is not available
   */
  getBestFitVideoPath(): string {
    return Utils.concatUrls(this.getOriginalMediaPath(), '/bestFit');
  }

  getHLSPlaylistPath(): string {
    return Utils.concatUrls(
      Config.Server.urlBase,
      Config.Server.apiPath,
      '/gallery/hls/',
      this.getRelativePath(),
      'playlist.m3u8'
    );
  }

  equals(other: MediaDTO | MediaIcon): boolean {
    // is gridphoto
    if (other instanceof MediaIcon) {
      return ContentWrapperUtils.equalsMedia(this.media, other.media);
    }

    // is media
    if (other.directory) {
      return ContentWrapperUtils.equalsMedia(this.media, other);
    }

    return false;
  }
}
