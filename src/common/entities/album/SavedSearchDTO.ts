import {AlbumBaseDTO} from './AlbumBaseDTO';
import {CoverPhotoDTO} from '../PhotoDTO';
import {SearchQueryDTO} from '../SearchQueryDTO';

export interface SavedSearchDTO extends AlbumBaseDTO {
  id: number;
  name: string;
  cover?: CoverPhotoDTO;
  count: number;
  locked: boolean;

  searchQuery: SearchQueryDTO;
}
