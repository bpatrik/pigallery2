import {computed, inject, Injectable, linkedSignal} from '@angular/core';
import {PhotoDTO} from '../../../../../common/entities/PhotoDTO';
import {ContentLoaderService, DirectoryContent} from '../contentLoader.service';
import {Config} from '../../../../../common/config/public/Config';
import {Utils} from '../../../../../common/Utils';

export enum FilterRenderType {
  enum = 1,
  range = 2,
}

export interface Filter {
  name: string;
  mapFn: (m: PhotoDTO) => (string | number)[] | (string | number) | undefined;
  renderType: FilterRenderType;
  isArrayValue?: boolean;
}

export interface FilterOption {
  name: string | number;
  count: number;
  selected: boolean;
}

export interface SelectedFilter {
  filter: Filter;
  options: FilterOption[];
}

export interface ActiveFilters {
  filtersVisible: boolean;
  areFiltersActive: boolean;
  dateFilter: {
    minDate: number;
    maxDate: number;
    minFilter: number;
    maxFilter: number;
  };
  selectedFilters: SelectedFilter[];
}

export interface FilteredContent {
  content: DirectoryContent | undefined;
  // the active filters with the options and date range of the content
  filters: ActiveFilters;
}

@Injectable({providedIn: 'root'})
export class FilterService {
  private contentLoader = inject(ContentLoaderService);

  public readonly AVAILABLE_FILTERS: Filter[] = [
    {
      name: $localize`Keywords`,
      mapFn: (m: PhotoDTO): string[] | undefined => m.metadata.keywords,
      renderType: FilterRenderType.enum,
      isArrayValue: true,
    },
    {
      name: $localize`Faces`,
      mapFn: (m: PhotoDTO): string[] | undefined =>
        m.metadata.faces
          ? m.metadata.faces.map((f) => f.name)
          : ['<' + $localize`no face` + '>'],
      renderType: FilterRenderType.enum,
      isArrayValue: true,
    },
    {
      name: $localize`Faces groups`,
      mapFn: (m: PhotoDTO): string | undefined =>
        m.metadata.faces
          ?.map((f) => f.name)
          .sort()
          .join(', '),
      renderType: FilterRenderType.enum,
      isArrayValue: false,
    },
    {
      name: $localize`Caption`,
      mapFn: (m: PhotoDTO): string | undefined => m.metadata.caption,
      renderType: FilterRenderType.enum,
    },
    {
      name: $localize`Rating`,
      mapFn: (m: PhotoDTO): number | undefined => m.metadata.rating,
      renderType: FilterRenderType.enum,
    },
    {
      name: $localize`City`,
      mapFn: (m: PhotoDTO): string | undefined => m.metadata.positionData?.city,
      renderType: FilterRenderType.enum,
    },
    {
      name: $localize`State`,
      mapFn: (m: PhotoDTO): string | undefined => m.metadata.positionData?.state,
      renderType: FilterRenderType.enum,
    },
    {
      name: $localize`Country`,
      mapFn: (m: PhotoDTO): string | undefined => m.metadata.positionData?.country,
      renderType: FilterRenderType.enum,
    },
    {
      name: $localize`Camera`,
      mapFn: (m: PhotoDTO): string | undefined => m.metadata.cameraData?.model,
      renderType: FilterRenderType.enum,
    },
    {
      name: $localize`Lens`,
      mapFn: (m: PhotoDTO): string | undefined => m.metadata.cameraData?.lens,
      renderType: FilterRenderType.enum,
    },
    {
      name: $localize`ISO`,
      mapFn: (m: PhotoDTO): number | undefined => m.metadata.cameraData?.ISO,
      renderType: FilterRenderType.enum,
    },
    {
      name: $localize`Aperture`,
      mapFn: (m: PhotoDTO): string | undefined => m.metadata.cameraData?.fStop ? `f/${m.metadata.cameraData?.fStop}` : undefined,
      renderType: FilterRenderType.enum,
    },
    {
      name: $localize`Shutter speed`,
      mapFn: (m: PhotoDTO): string | undefined => {
        const f = m.metadata.cameraData?.exposure;
        if (typeof f === 'undefined') {
          return undefined;
        }
        if (f > 1) {
          return `${f} s`;
        }
        return `1/${Math.round(1 / f)} s`;
      },
      renderType: FilterRenderType.enum,
    },
    {
      name: $localize`Focal length`,
      mapFn: (m: PhotoDTO): string | undefined => m.metadata.cameraData?.focalLength ? `${m.metadata.cameraData?.focalLength} mm` : undefined,
      renderType: FilterRenderType.enum,
    },
  ];

  // The filter UI edits this object in place (ngModel) and then calls onFilterChange().
  // New content resets the selected options and the date range.
  public readonly activeFilters = linkedSignal<DirectoryContent | undefined, ActiveFilters>({
    source: this.contentLoader.originalContent,
    computation: (content, previous) => {
      const filters = previous?.value ?? this.getInitialFilters();
      FilterService.resetFilterValues(filters);
      return {...filters};
    }
  });
  public readonly statistic = computed(() => this.getStatistic(this.contentLoader.originalContent()));
  // Filtering also updates the options and the date range of the active filters, so the UI reads them from here.
  public readonly filteredContent = computed((): FilteredContent => {
    const filters = this.activeFilters();
    return {content: this.applyFilters(this.contentLoader.originalContent(), filters), filters};
  });

  private getInitialFilters(): ActiveFilters {
    return {
      filtersVisible: false,
      areFiltersActive: false,
      dateFilter: {
        minDate: 0,
        maxDate: Date.now(),
        minFilter: Number.MIN_VALUE,
        maxFilter: Number.MAX_VALUE,
      },
      selectedFilters: [
        {
          filter: this.AVAILABLE_FILTERS[0],
          options: [],
        },
        {
          filter: this.AVAILABLE_FILTERS[1],
          options: [],
        },
        {
          filter: this.AVAILABLE_FILTERS[7],
          options: [],
        },
        {
          filter: this.AVAILABLE_FILTERS[4],
          options: [],
        },
      ],
    };
  }

  private static resetFilterValues(filters: ActiveFilters): void {
    filters.dateFilter.minFilter = Number.MIN_VALUE;
    filters.dateFilter.maxFilter = Number.MAX_VALUE;
    filters.selectedFilters.forEach((f) => (f.options = []));
  }

  private getStatistic(prefiltered: DirectoryContent | undefined): { date: Date, time: number, endTime: number, dateStr: string, count: number, max: number }[] {
    if (!prefiltered ||
      !prefiltered.media ||
      prefiltered.media.length === 0) {
      return [];
    }
    const ret: { date: Date, time: number, endTime: number, dateStr: string, count: number, max: number }[] = [];
    const minDate = prefiltered.media.reduce(
      (p, curr) => Math.min(p, Utils.getTimeMS(curr.metadata.creationDate, curr.metadata.creationDateOffset, Config.Gallery.ignoreTimestampOffset)),
      Number.MAX_VALUE - 1
    );
    const maxDate = prefiltered.media.reduce(
      (p, curr) => Math.max(p, Utils.getTimeMS(curr.metadata.creationDate, curr.metadata.creationDateOffset, Config.Gallery.ignoreTimestampOffset)),
      Number.MIN_VALUE + 1
    );
    const diff = (maxDate - minDate) / 1000;
    const H = 60 * 60;
    const D = H * 24;
    const M = D * 30;
    const Y = D * 365;
    const Y2 = Y * 2;
    const Y5 = Y * 5;
    const Dec = Y * 10;
    const Dec2 = Y * 20;
    const Dec5 = Y * 50;
    const Sen = Y * 100;
    const divs = [H, D, M, Y, Y2, Y5, Dec, Dec2, Dec5, Sen];

    // finding the resolution
    let usedDiv = H;
    for (const div of divs) {
      if (diff / div < 26) {
        usedDiv = div;
        break;
      }
    }

    // getting the first date (truncated to the resolution)
    const floorDate = (ts: number): number => {
      let d = new Date(ts);
      if (usedDiv >= Y) {
        const fy = (d.getFullYear());
        d = new Date(fy - fy % (usedDiv / Y), 0, 1);
      } else if (usedDiv === M) {
        d = new Date(d.getFullYear(), d.getMonth(), 1);
      } else {
        d = new Date(ts - ts % usedDiv);
      }
      return d.getTime();
    };

    const startMediaDate = new Date(floorDate(minDate));

    prefiltered.media.forEach(m => {
      const key = Math.floor((floorDate(Utils.getTimeMS(m.metadata.creationDate, m.metadata.creationDateOffset, Config.Gallery.ignoreTimestampOffset)) - startMediaDate.getTime()) / 1000 / usedDiv);

      const getDate = (index: number) => {
        let d: Date;
        if (usedDiv >= Y) {
          d = new Date(startMediaDate.getFullYear() + (index * (usedDiv / Y)), 0, 1);
        } else if (usedDiv === M) {
          d = new Date(startMediaDate.getFullYear(), startMediaDate.getMonth() + index, 1);
        } else if (usedDiv === D) {
          d = new Date(startMediaDate.getFullYear(), startMediaDate.getMonth(), startMediaDate.getDate() + index, 1);
        } else {
          d = (new Date(startMediaDate.getTime() + (index * usedDiv * 1000)));
        }
        return d;
      };
      // extending the array
      while (ret.length <= key) {
        let dStr: string;
        // getting date range start for entry and also UI date pattern
        if (usedDiv >= Y) {
          dStr = 'y';
        } else if (usedDiv === M) {
          dStr = 'y MMM';
        } else if (usedDiv === D) {
          dStr = 'EEE';
        } else {
          dStr = 'HH';
        }
        const date = getDate(ret.length);
        ret.push({date, time: date.getTime(), endTime: getDate(ret.length + 1).getTime(), dateStr: dStr, count: 0, max: 0});
      }

      ret[key].count++;
    });

    // don't show if there is only one column
    if (ret.length <= 1) {
      return [];
    }

    const max = ret.reduce((p, c) => Math.max(p, c.count), 0);
    ret.forEach(v => v.max = max);
    return ret;
  }

  private applyFilters(dirContent: DirectoryContent | undefined, afilters: ActiveFilters): DirectoryContent | undefined {
    if (!dirContent || !dirContent.media || (!afilters.filtersVisible && !afilters.areFiltersActive)) {
      return dirContent;
    }

    // clone, so the original won't get overwritten
    const c = {
      media: dirContent.media,
      directories: dirContent.directories,
      metaFile: dirContent.metaFile,
    };

    /* Date Selector */
    if (c.media.length > 0) {
      // Update date filter range
      afilters.dateFilter.minDate = c.media.reduce(
        (p, curr) => Math.min(p, Utils.getTimeMS(curr.metadata.creationDate, curr.metadata.creationDateOffset, Config.Gallery.ignoreTimestampOffset)),
        Number.MAX_VALUE - 1
      );
      afilters.dateFilter.maxDate = c.media.reduce(
        (p, curr) => Math.max(p, Utils.getTimeMS(curr.metadata.creationDate, curr.metadata.creationDateOffset, Config.Gallery.ignoreTimestampOffset)),
        Number.MIN_VALUE + 1
      );
      // Add a few sec padding
      afilters.dateFilter.minDate -= ((afilters.dateFilter.minDate % 1000) + 1000);
      afilters.dateFilter.maxDate += ((1000 - (afilters.dateFilter.maxDate % 1000)) + 1000);

      if (afilters.dateFilter.minFilter === Number.MIN_VALUE) {
        afilters.dateFilter.minFilter = afilters.dateFilter.minDate;
      }
      if (afilters.dateFilter.maxFilter === Number.MAX_VALUE) {
        afilters.dateFilter.maxFilter = afilters.dateFilter.maxDate;
      }

      // Apply Date filter
      c.media = c.media.filter(
        (m) =>
          Utils.getTimeMS(m.metadata.creationDate, m.metadata.creationDateOffset, Config.Gallery.ignoreTimestampOffset) >= afilters.dateFilter.minFilter &&
          Utils.getTimeMS(m.metadata.creationDate, m.metadata.creationDateOffset, Config.Gallery.ignoreTimestampOffset) <= afilters.dateFilter.maxFilter
      );
    } else {
      afilters.dateFilter.minDate = Number.MIN_VALUE;
      afilters.dateFilter.maxDate = Number.MAX_VALUE;
      afilters.dateFilter.minFilter = Number.MIN_VALUE;
      afilters.dateFilter.maxFilter = Number.MAX_VALUE;
    }

    // filters
    for (const f of afilters.selectedFilters) {

      /* Update filter options */
      const valueMap: Record<string, { name: string | number, count: number, selected: boolean }> = {};
      f.options.forEach((o) => {
        valueMap[o.name] = o;
        o.count = 0; // reset count so unknown options can be removed at the end
      });
      if (f.filter.isArrayValue) {
        c.media.forEach((m) => {
          (f.filter.mapFn(m as PhotoDTO) as string[])?.forEach((v) => {
            valueMap[v] = valueMap[v] || {
              name: v,
              count: 0,
              selected: true,
            };
            valueMap[v].count++;
          });
        });
      } else {
        c.media.forEach((m) => {
          const key = f.filter.mapFn(m as PhotoDTO) as string;
          valueMap[key] = valueMap[key] || {
            name: key,
            count: 0,
            selected: true,
          };
          valueMap[key].count++;
        });
      }
      f.options = Object.values(valueMap)
        .filter((o) => o.count > 0)
        // sort by count and alpha. if counts are the same
        .sort((a, b) =>
          a.count == b.count && (a.name !== undefined && b.name !== undefined) ?
            Number.isFinite(a.name) && Number.isFinite(b.name) ? (a.name as number) - (b.name as number) : a.name.toString().localeCompare(b.name.toString()) :
            b.count - a.count);

      /* Apply filters */
      f.options.forEach((opt) => {
        if (opt.selected) {
          return;
        }
        if (f.filter.isArrayValue) {
          c.media = c.media.filter((m) => {
            const mapped = f.filter.mapFn(m as PhotoDTO) as string[];
            if (!mapped) {
              return true;
            }
            // Keep photos that have at least one of the selected values
            return mapped.some(value =>
              f.options.find(opt => opt.name === value && opt.selected)
            );
          });
        } else {
          c.media = c.media.filter(
            (m) =>
              (f.filter.mapFn(m as PhotoDTO) as string) !== opt.name
          );
        }
      });
    }
    // If the number of photos did not change, the filters are not active
    afilters.areFiltersActive = c.media.length !== dirContent.media.length;
    return c;
  }

  public onFilterChange(): void {
    // a new object, so the filters are applied again
    this.activeFilters.update((f) => ({...f}));
  }

  setShowingFilters(value: boolean): void {
    const filters = this.activeFilters();
    if (filters.filtersVisible === value) {
      return;
    }
    filters.filtersVisible = value;
    if ((!filters.filtersVisible && !filters.areFiltersActive)) {
      this.resetFilters(false);
    }
    this.onFilterChange();
  }

  resetFilters(triggerChangeDetection = true): void {
    FilterService.resetFilterValues(this.activeFilters());
    if (triggerChangeDetection) {
      this.onFilterChange();
    }
  }
}
