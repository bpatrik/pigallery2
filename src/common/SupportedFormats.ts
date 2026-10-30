import type {ClientConfig} from './config/public/ClientConfig';

/**
 * The part of the config the formats are read from.
 * Both the public (frontend) and the private (backend) config have it.
 */
export type SupportedFormatsConfig = Pick<ClientConfig, 'Media' | 'MetaFile'>;

/**
 * Lists the supported file formats.
 * Empty until init() is called: the public config calls it in the frontend, the private config in the backend.
 */
export class SupportedFormats {
  static Photos: string[] = [];
  // Browser-supported video formats
  // Read more: https://www.w3schools.com/html/html5_video.asp
  static Videos: string[] = [];
  static MetaFiles: string[] = [];
  // These formats need to be transcoded (with the built-in ffmpeg support)
  static TranscodeNeed = {
    // based on libvips, all supported formats for sharp: https://github.com/libvips/libvips
    Photos: [] as string[],
    Videos: [] as string[],
  };
  static WithDots = {
    Photos: [] as string[],
    Videos: [] as string[],
    MetaFiles: [] as string[],
    TranscodeNeed: {
      Photos: [] as string[],
      Videos: [] as string[],
    }
  };

  static init(config: SupportedFormatsConfig): void {
    SupportedFormats.TranscodeNeed.Videos = config.Media.Video.supportedFormatsWithTranscoding;
    SupportedFormats.Photos = config.Media.Photo.supportedFormats.concat(
      SupportedFormats.TranscodeNeed.Photos
    );
    SupportedFormats.Videos = config.Media.Video.supportedFormats.concat(
      SupportedFormats.TranscodeNeed.Videos
    );
    SupportedFormats.MetaFiles = config.MetaFile.supportedFormats;
    SupportedFormats.WithDots.Photos = SupportedFormats.Photos.map((f) => '.' + f);
    SupportedFormats.WithDots.Videos = SupportedFormats.Videos.map((f) => '.' + f);
    SupportedFormats.WithDots.MetaFiles = SupportedFormats.MetaFiles.map(
      (f) => '.' + f
    );
    SupportedFormats.WithDots.TranscodeNeed.Photos =
      SupportedFormats.TranscodeNeed.Photos.map((f) => '.' + f);
    SupportedFormats.WithDots.TranscodeNeed.Videos =
      SupportedFormats.TranscodeNeed.Videos.map((f) => '.' + f);
  }
}
