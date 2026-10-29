import { Injectable, inject } from '@angular/core';
import {Observable, shareReplay} from 'rxjs';
import {GallerySortingService, GroupedDirectoryContent} from './navigator/sorting.service';
import {FilterService} from './filter/filter.service';
import {ContentLoaderService} from './contentLoader.service';

@Injectable({providedIn: 'root'})
export class ContentService {
  private contentLoaderService = inject(ContentLoaderService);
  private sortingService = inject(GallerySortingService);
  private filterService = inject(FilterService);

  public sortedFilteredContent: Observable<GroupedDirectoryContent>;

  constructor() {
    this.sortedFilteredContent = this.sortingService
        .applySorting(
            this.filterService.applyFilters(this.contentLoaderService.originalContent)
        ).pipe(shareReplay(1));

  }

}
