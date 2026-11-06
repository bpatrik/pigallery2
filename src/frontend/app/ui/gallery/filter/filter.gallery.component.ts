import { Component, OnDestroy, OnInit, computed, inject } from '@angular/core';
import {ActiveFilters, FilterOption, FilterService, SelectedFilter} from './filter.service';
import { DatePipe } from '@angular/common';
import { PopoverDirective } from 'ngx-bootstrap/popover';
import { NgIconComponent } from '@ng-icons/core';
import { FormsModule } from '@angular/forms';

@Component({
    selector: 'app-gallery-filter',
    styleUrl: './filter.gallery.component.css',
    templateUrl: './filter.gallery.component.html',
    imports: [
    PopoverDirective,
    NgIconComponent,
    FormsModule,
    DatePipe
]
})
export class GalleryFilterComponent implements OnInit, OnDestroy {
  filterService = inject(FilterService);

  public readonly unknownText;
  minDate = 0;
  maxDate = 100;
  NUMBER_MAX_VALUE = Number.MAX_VALUE;
  NUMBER_MIN_VALUE = Number.MIN_VALUE;
  showStatistic = false;
  // [filter index][option index]: if the option is the only selected one of its filter.
  // The options are edited in place, but every edit calls onFilterChange(), that updates filteredContent.
  public readonly onlySelected = computed((): boolean[][] =>
    this.filterService.filteredContent().filters.selectedFilters
      .map((filter): boolean[] => filter.options.map((option): boolean => this.isOnlySelected(filter, option))));

  constructor() {
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

  get ActiveFilters(): ActiveFilters {
    return this.filterService.filteredContent().filters;
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

  toggleOption(option: FilterOption): void {
    option.selected = !option.selected;
    this.filterService.onFilterChange();
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

  newMinDate(): void {
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

  newMaxDate(): void {
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

