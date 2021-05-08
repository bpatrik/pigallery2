import {DirectoryDTO} from './DirectoryDTO';
import {MediaDimension, MediaDTO, MediaMetadata} from './MediaDTO';
import {PositionMetaData, CameraMetadata} from './PhotoDTO';

export interface VideoDTO extends MediaDTO {
  id: number;
  name: string;
  directory: DirectoryDTO;
  metadata: VideoMetadata;
}


export interface VideoMetadata extends MediaMetadata {
  rating?: 0 | 1 | 2 | 3 | 4 | 5;
  caption?: string;
  keywords?: string[];
  cameraData?: CameraMetadata;
  positionData?: PositionMetaData;
  size: MediaDimension;
  creationDate: number;
  bitRate: number;
  duration: number; // in milliseconds
  fileSize: number;
  fps: number;
}
