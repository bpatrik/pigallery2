import { DirectoryPathDTO } from './DirectoryDTO';
import { MediaDimension, MediaDTO, MediaMetadata } from './MediaDTO';

export interface PreviewPhotoDTO extends MediaDTO {
  name: string;
  directory: DirectoryPathDTO;
}

export interface PhotoDTO extends PreviewPhotoDTO, MediaDTO {
  id: number;
  name: string;
  directory: DirectoryPathDTO;
  metadata: PhotoMetadata;
  missingThumbnails?: number;
}

export interface FaceRegionBox {
  width: number;
  height: number;
  left: number;
  top: number;
}

export interface FaceRegion {
  name: string;
  box?: FaceRegionBox; // some faces don t have region ass they are coming from keywords
}

export interface PhotoMetadata extends MediaMetadata {
  rating?: 0 | 1 | 2 | 3 | 4 | 5;
  title?: string;
  caption?: string;
  keywords?: string[];
  cameraData?: CameraMetadata;
  positionData?: PositionMetaData;
  size: MediaDimension;
  creationDate: number;
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
