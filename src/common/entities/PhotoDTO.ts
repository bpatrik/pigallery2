import {DirectoryPathDTO} from './DirectoryDTO';
import {MediaDimension, MediaDTO, MediaMetadata} from './MediaDTO';

export interface CoverPhotoDTO extends MediaDTO {
  name: string;
  directory: DirectoryPathDTO;
}

export interface PhotoDTO extends CoverPhotoDTO, MediaDTO {
  id: number;
  name: string;
  directory: DirectoryPathDTO;
  metadata: PhotoMetadata;
  missingThumbnails?: number;
}

export interface FaceRegionBox {
  width: number; // in pixels
  height: number; // in pixels
  left: number; // in pixels
  top: number; // in pixels
}

export interface FaceRegion {
  name: string;
  box?: FaceRegionBox; // some faces don t have region ass they are coming from keywords
}

export interface PhotoMetadata extends MediaMetadata {
  title?: string;
  caption?: string;
  cameraData?: CameraMetadata;
  positionData?: PositionMetaData;
  size: MediaDimension;
  creationDate: number;
  creationDateOffset?: string;
  fileSize: number;
  faces?: FaceRegion[];
}

export interface PositionMetaData {
  GPSData?: GPSMetadata;
  country?: string;
  state?: string;
  city?: string;
}

export interface GPSMetadata {
  latitude?: number; // float with precision: 6
  longitude?: number; // float with precision: 6
}

export interface CameraMetadata {
  ISO?: number;
  model?: string;
  make?: string;
  fStop?: number; // float with precision: 2
  exposure?: number; // float with precision: 4
  focalLength?: number;
  lens?: string;
}
