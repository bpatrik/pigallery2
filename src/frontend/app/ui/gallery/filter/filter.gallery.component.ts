import {Component, OnDestroy, OnInit} from '@angular/core';
import {RouterLink} from '@angular/router';
import {FilterOption, FilterService, SelectedFilter} from './filter.service';

@Component({
  selector: 'app-gallery-filter',
  styleUrls: ['./filter.gallery.component.css'],
  templateUrl: './filter.gallery.component.html',
  providers: [RouterLink],
})
export class GalleryFilterComponent implements OnInit, OnDestroy {
  public readonly unknownText;
  minDate = 0;
  maxDate = 100;
  NUMBER_MAX_VALUE = Number.MAX_VALUE;
  NUMBER_MIN_VALUE = Number.MIN_VALUE;
  showStatistic = false;

  constructor(public filterService: FilterService) {
    this.unknownText = '<' + $localize`unknown` + '>';
  }

  get MinDatePrc(): number {
    return (
        ((this.ActiveFilters.dateFilter.minFilter -
                this.ActiveFilters.dateFilter.minDate) /
            (this.ActiveFilters.dateFilter.maxDate -
                this.ActiveFilters.dateFilter.minDate)) *
        100
    );
  }

  get MaxDatePrc(): number {
    return (
        ((this.ActiveFilters.dateFilter.maxFilter -
                this.ActiveFilters.dateFilter.minDate) /
            (this.ActiveFilters.dateFilter.maxDate -
                this.ActiveFilters.dateFilter.minDate)) *
        100
    );
  }

  get ActiveFilters(): {
    filtersVisible: boolean;
    areFiltersActive: boolean;
    dateFilter: {
      minDate: number;
      maxDate: number;
      minFilter: number;
      maxFilter: number;
    };
    selectedFilters: SelectedFilter[];
  } {
    return this.filterService.activeFilters.value;
  }


  ngOnDestroy(): void {
    setTimeout(() => this.filterService.setShowingFilters(false));
  }

  ngOnInit(): void {
    this.filterService.setShowingFilters(true);
  }

  isOnlySelected(filter: SelectedFilter, option: FilterOption): boolean {
    for (const o of filter.options) {
      if (o === option) {
        if (o.selected === false) {
          return false;
        }
      } else {
        if (o.selected === true) {
          return false;
        }
      }
    }
    return true;
  }

  toggleSelectOnly(
      filter: SelectedFilter,
      option: FilterOption,
      event: MouseEvent
  ): void {
    if (this.isOnlySelected(filter, option)) {
      filter.options.forEach((o) => (o.selected = true));
    } else {
      filter.options.forEach((o) => (o.selected = o === option));
    }
    event.stopPropagation();
    this.filterService.onFilterChange();
  }

  newMinDate($event: Event): void {
    const diff =
        (this.ActiveFilters.dateFilter.maxDate -
            this.ActiveFilters.dateFilter.minDate) *
        0.01;
    if (
        this.ActiveFilters.dateFilter.minFilter >
        this.ActiveFilters.dateFilter.maxFilter - diff
    ) {
      this.ActiveFilters.dateFilter.minFilter = Math.max(
          this.ActiveFilters.dateFilter.maxFilter - diff,
          this.ActiveFilters.dateFilter.minDate
      );
    }
    this.filterService.onFilterChange();
  }

  newMaxDate($event: Event): void {
    const diff =
        (this.ActiveFilters.dateFilter.maxDate -
            this.ActiveFilters.dateFilter.minDate) *
        0.01;
    if (
        this.ActiveFilters.dateFilter.maxFilter <
        this.ActiveFilters.dateFilter.minFilter + diff
    ) {
      this.ActiveFilters.dateFilter.maxFilter = Math.min(
          this.ActiveFilters.dateFilter.minFilter + diff,
          this.ActiveFilters.dateFilter.maxDate
      );
    }
    this.filterService.onFilterChange();
  }

  reset(): void {
    this.filterService.resetFilters();
  }
}

