import {Injectable} from '@angular/core';
import {Observable, shareReplay} from 'rxjs';
import {GallerySortingService, GroupedDirectoryContent} from './navigator/sorting.service';
import {FilterService} from './filter/filter.service';
import {ContentLoaderService} from './contentLoader.service';

@Injectable()
export class ContentService {
  public sortedFilteredContent: Observable<GroupedDirectoryContent>;

  constructor(
      private contentLoaderService: ContentLoaderService,
      private sortingService: GallerySortingService,
      private filterService: FilterService
  ) {
    this.sortedFilteredContent = this.sortingService
        .applySorting(
            this.filterService.applyFilters(this.contentLoaderService.originalContent)
        ).pipe(shareReplay(1));

  }

}
