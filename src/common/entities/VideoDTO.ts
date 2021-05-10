import {DirectoryDTO} from './DirectoryDTO';
import {MediaDimension, MediaDTO, MediaMetadata} from './MediaDTO';
import {PositionMetaData, CameraMetadata, RatingTypes} from './PhotoDTO';

export interface VideoDTO extends MediaDTO {
  id: number;
  name: string;
  directory: DirectoryDTO;
  metadata: VideoMetadata;
}


export interface VideoMetadata extends MediaMetadata {
  rating?: RatingTypes;
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
