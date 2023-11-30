import {Component, OnDestroy, OnInit} from '@angular/core';
import {RouterLink} from '@angular/router';
import { Filter, FilterService, FilterState, FilterType, SelectedFilter} from './filter.service';

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
        ((this.FilterState.dateFilter.minFilter -
                this.FilterState.dateFilter.minDate) /
            (this.FilterState.dateFilter.maxDate -
                this.FilterState.dateFilter.minDate)) *
        100
    );
  }

  get MaxDatePrc(): number {
    return (
        ((this.FilterState.dateFilter.maxFilter -
                this.FilterState.dateFilter.minDate) /
            (this.FilterState.dateFilter.maxDate -
                this.FilterState.dateFilter.minDate)) *
        100
    );
  }

  get FilterState(): FilterState {
    return this.filterService.filterState.value;
  }

  filterChangedType(index: number, type: FilterType) {
    this.filterService.filterState.value.selectedFilters[index] = {
      type,
      options: []
    }
    this.filterService.onFilterChange();
  }

  toggleFilterValue(option: {selected: boolean}) {
    option.selected = !option.selected
    this.filterService.onFilterChange();
  }

  ngOnDestroy(): void {
    setTimeout(() => this.filterService.setShowingFilters(false));
  }

  ngOnInit(): void {
    this.filterService.setShowingFilters(true);
  }

  isOnlySelected(filter: SelectedFilter, option: string): boolean {
    const selectedEntries = filter.options.filter(({selected}) => selected);
    return selectedEntries.length === 1 && selectedEntries[0].name === option;
  }

  toggleSelectOnly(
      filter: SelectedFilter,
      option: string,
      event: MouseEvent
  ): void {
    if (this.isOnlySelected(filter, option)) {
      filter.options.forEach((o) => o.selected = true);
    } else {
      filter.options.forEach((o) => o.selected = o.name === option);
    }
    event.stopPropagation();
    this.filterService.onFilterChange();
  }

  newMinDate($event: Event): void {
    const diff =
        (this.FilterState.dateFilter.maxDate -
            this.FilterState.dateFilter.minDate) *
        0.01;
    if (
        this.FilterState.dateFilter.minFilter >
        this.FilterState.dateFilter.maxFilter - diff
    ) {
      this.FilterState.dateFilter.minFilter = Math.max(
          this.FilterState.dateFilter.maxFilter - diff,
          this.FilterState.dateFilter.minDate
      );
    }
    this.filterService.onFilterChange();
  }

  newMaxDate($event: Event): void {
    const diff =
        (this.FilterState.dateFilter.maxDate -
            this.FilterState.dateFilter.minDate) *
        0.01;
    if (
        this.FilterState.dateFilter.maxFilter <
        this.FilterState.dateFilter.minFilter + diff
    ) {
      this.FilterState.dateFilter.maxFilter = Math.min(
          this.FilterState.dateFilter.minFilter + diff,
          this.FilterState.dateFilter.maxDate
      );
    }
    this.filterService.onFilterChange();
  }

  reset(): void {
    this.filterService.resetFilters();
  }
}

