import {DirectoryPathDTO} from './DirectoryDTO';
import {PhotoDTO} from './PhotoDTO';
import {FileDTO} from './FileDTO';
import {SupportedFormats} from '../SupportedFormats';

export interface MediaDTO extends FileDTO {
  id: number;
  name: string;
  directory: DirectoryPathDTO;
  metadata: MediaMetadata;
  missingThumbnails?: number;
}

export type RatingTypes = 0 | 1 | 2 | 3 | 4 | 5;

export interface MediaMetadata {
  size: MediaDimension;
  creationDate: number;
  fileSize: number;
  creationDateOffset?: string;
  keywords?: string[];
  rating?: RatingTypes;
  title?: string;
  caption?: string;
}

export interface MediaDimension {
  width: number;
  height: number;
}

export const MediaDTOUtils = {
  hasPositionData: (media: MediaDTO): boolean => {
    return (
        !!(media as PhotoDTO).metadata.positionData &&
        !!(
            (media as PhotoDTO).metadata.positionData.city ||
            (media as PhotoDTO).metadata.positionData.state ||
            (media as PhotoDTO).metadata.positionData.country ||
            ((media as PhotoDTO).metadata.positionData.GPSData &&
                (media as PhotoDTO).metadata.positionData.GPSData.latitude &&
                (media as PhotoDTO).metadata.positionData.GPSData.longitude)
        )
    );
  },
  isPhoto: (media: FileDTO): boolean => {
    return !MediaDTOUtils.isVideo(media);
  },

  isVideo: (media: FileDTO): boolean => {
    const lower = media.name.toLowerCase();
    for (const ext of SupportedFormats.WithDots.Videos) {
      if (lower.endsWith(ext)) {
        return true;
      }
    }
    return false;
  },

  isVideoPath: (path: string): boolean => {
    const lower = path.toLowerCase();
    for (const ext of SupportedFormats.WithDots.Videos) {
      if (lower.endsWith(ext)) {
        return true;
      }
    }
    return false;
  },

  isVideoTranscodingNeeded: (media: FileDTO): boolean => {
    const lower = media.name.toLowerCase();
    for (const ext of SupportedFormats.WithDots.TranscodeNeed.Videos) {
      if (lower.endsWith(ext)) {
        return true;
      }
    }
    return false;
  },

  calcAspectRatio: (photo: MediaDTO): number => {
    return (photo.metadata.size.width / photo.metadata.size.height) || 1; // NaN should be treated as square photo
  },

  equals: (a: MediaDTO, b: MediaDTO): boolean => {
    return a.directory.path === b.directory.path &&
        a.directory.name === b.directory.name &&
        a.name === b.name;
  }
};
