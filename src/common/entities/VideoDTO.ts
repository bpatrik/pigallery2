import {DirectoryPathDTO} from './DirectoryDTO';
import {MediaDimension, MediaDTO, MediaMetadata, VideoProperties} from './MediaDTO';

export interface VideoDTO extends MediaDTO {
  id: number;
  name: string;
  directory: DirectoryPathDTO;
  metadata: VideoMetadata;
}

export interface VideoMetadata extends MediaMetadata, VideoProperties {
  size: MediaDimension;
  creationDate: number;
  creationDateOffset?: string;
  fileSize: number;
}
