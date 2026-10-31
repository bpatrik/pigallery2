import {SupportedFormats} from './SupportedFormats';

export class UploadUtils {

  public static getExtension(filename: string): string {
    const dot = filename.lastIndexOf('.');
    return dot === -1 ? '' : filename.substring(dot + 1).toLowerCase();
  }

  public static isUploadableExtension(ext: string, blockedExtensions: string[]): boolean {
    ext = ext.toLowerCase();
    if (blockedExtensions.some(b => b.toLowerCase() === ext)) {
      return false;
    }
    return SupportedFormats.Photos.includes(ext) ||
      SupportedFormats.Videos.includes(ext) ||
      SupportedFormats.MetaFiles.includes(ext);
  }
}
