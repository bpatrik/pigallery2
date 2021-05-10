import {DirectoryBaseDTO, DirectoryDTO} from './DirectoryDTO';
import {MediaBaseDTO, MediaDimension, MediaDTO, MediaMetadata} from './MediaDTO';

export enum OrientationTypes {
  TOP_LEFT = 1, //this is hte normal
  TOP_RIGHT = 2,
  BOTTOM_RIGHT = 3,
  BOTTOM_LEFT = 4,
  LEFT_TOP = 5,
  RIGHT_TOP = 6,
  RIGHT_BOTTOM = 7,
  LEFT_BOTTOM = 8
}

export type RatingTypes = 0 | 1 | 2 | 3 | 4 | 5;

export interface PreviewPhotoDTO extends MediaBaseDTO {
  name: string;
  directory: DirectoryBaseDTO;
  readyThumbnails: Array<number>;
  readyIcon: boolean;
}

export interface PhotoDTO extends PreviewPhotoDTO, MediaDTO {
  id: number;
  name: string;
  directory: DirectoryDTO;
  metadata: PhotoMetadata;
  readyThumbnails: Array<number>;
  readyIcon: boolean;
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
  rating?: RatingTypes;
  caption?: string;
  keywords?: string[];
  cameraData?: CameraMetadata;
  positionData?: PositionMetaData;
  orientation: OrientationTypes;
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
  latitude?: number;
  longitude?: number;
  altitude?: number;
}


export interface CameraMetadata {
  ISO?: number;
  model?: string;
  make?: string;
  fStop?: number;
  exposure?: number;
  focalLength?: number;
  lens?: string;
}
