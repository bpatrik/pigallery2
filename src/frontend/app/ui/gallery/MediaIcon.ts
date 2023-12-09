import {Utils} from '../../../../common/Utils';
import {Config} from '../../../../common/config/public/Config';
import {MediaDTO} from '../../../../common/entities/MediaDTO';

export class MediaIcon {
  protected static readonly ThumbnailMap =
      Config.Media.Thumbnail.generateThumbnailMap();

  protected replacementSizeCache: number | boolean = false;

  constructor(public media: MediaDTO) {
  }

  getExtension(): string {
    return this.media.name.substr(this.media.name.lastIndexOf('.') + 1);
  }

  iconLoaded(): void {
    this.media.missingThumbnails -=
        MediaIcon.ThumbnailMap[Config.Media.Thumbnail.iconSize];
  }

  isIconAvailable(): boolean {
    // eslint-disable-next-line no-bitwise
    return (
        (this.media.missingThumbnails &
            MediaIcon.ThumbnailMap[Config.Media.Thumbnail.iconSize]) ===
        0
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

  getMediaPath(): string {
    return Utils.concatUrls(
        Config.Server.urlBase,
        Config.Server.apiPath,
        '/gallery/content/',
        this.getRelativePath()
    );
  }

  getBestFitMediaPath(): string {
    return Utils.concatUrls(this.getMediaPath(), '/bestFit');
  }

  equals(other: MediaDTO | MediaIcon): boolean {
    // is gridphoto
    if (other instanceof MediaIcon) {
      return (
          this.media.directory.path === other.media.directory.path &&
          this.media.directory.name === other.media.directory.name &&
          this.media.name === other.media.name
      );
    }

    // is media
    if (other.directory) {
      return (
          this.media.directory.path === other.directory.path &&
          this.media.directory.name === other.directory.name &&
          this.media.name === other.name
      );
    }

    return false;
  }
}
