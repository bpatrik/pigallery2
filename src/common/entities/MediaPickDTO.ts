import {SearchQueryDTO} from './SearchQueryDTO';
import {SortingMethod} from './SortingMethods';

export interface MediaPickDTO {
  creatorId?: number;
  searchQuery: SearchQueryDTO;
  sortBy: SortingMethod[];
  pick: number;
}
