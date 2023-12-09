import {CoverPhotoDTO} from '../PhotoDTO';

export interface AlbumBaseDTO {
  id: number;
  name: string;
  cover?: CoverPhotoDTO;
  count: number;
  locked: boolean;
}
