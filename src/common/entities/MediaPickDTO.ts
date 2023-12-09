import {SearchQueryDTO} from './SearchQueryDTO';
import {SortingMethod} from './SortingMethods';

export interface MediaPickDTO {
  searchQuery: SearchQueryDTO;
  sortBy: SortingMethod[];
  pick: number;
}
