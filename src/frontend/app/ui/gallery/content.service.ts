import { Injectable, computed, inject } from '@angular/core';
import {GallerySortingService, GroupedDirectoryContent} from './navigator/sorting.service';
import {FilterService} from './filter/filter.service';

@Injectable({providedIn: 'root'})
export class ContentService {
  private sortingService = inject(GallerySortingService);
  private filterService = inject(FilterService);

  public readonly sortedFilteredContent = computed((): GroupedDirectoryContent | null =>
    this.sortingService.applySorting(
      this.filterService.filteredContent().content,
      this.sortingService.sorting(),
      this.sortingService.grouping()
    )
  );

}
