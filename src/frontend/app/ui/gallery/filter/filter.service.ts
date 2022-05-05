import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { PhotoDTO } from '../../../../../common/entities/PhotoDTO';
import { DirectoryContent } from '../content.service';
import { map, switchMap } from 'rxjs/operators';

export enum FilterRenderType {
  enum = 1,
  range = 2,
}

export interface Filter {
  name: string;
  mapFn: (m: PhotoDTO) => (string | number)[] | (string | number);
  renderType: FilterRenderType;
  isArrayValue?: boolean;
}

export interface FilterOption {
  name: string;
  count: number;
  selected: boolean;
}

export interface SelectedFilter {
  filter: Filter;
  options: FilterOption[];
}

@Injectable()
export class FilterService {
  public readonly AVAILABLE_FILTERS: Filter[] = [
    {
      name: $localize`Keywords`,
      mapFn: (m: PhotoDTO): string[] => m.metadata.keywords,
      renderType: FilterRenderType.enum,
      isArrayValue: true,
    },
    {
      name: $localize`Faces`,
      mapFn: (m: PhotoDTO): string[] =>
        m.metadata.faces
          ? m.metadata.faces.map((f) => f.name)
          : ['<' + $localize`no face` + '>'],
      renderType: FilterRenderType.enum,
      isArrayValue: true,
    },
    {
      name: $localize`Faces groups`,
      mapFn: (m: PhotoDTO): string =>
        m.metadata.faces
          ?.map((f) => f.name)
          .sort()
          .join(', '),
      renderType: FilterRenderType.enum,
      isArrayValue: false,
    },
    {
      name: $localize`Title`,
      mapFn: (m: PhotoDTO): string => m.metadata.title,
      renderType: FilterRenderType.enum,
    },
    {
      name: $localize`Caption`,
      mapFn: (m: PhotoDTO): string => m.metadata.caption,
      renderType: FilterRenderType.enum,
    },
    {
      name: $localize`Rating`,
      mapFn: (m: PhotoDTO): number => m.metadata.rating,
      renderType: FilterRenderType.enum,
    },
    {
      name: $localize`Camera`,
      mapFn: (m: PhotoDTO): string => m.metadata.cameraData?.model,
      renderType: FilterRenderType.enum,
    },
    {
      name: $localize`Lens`,
      mapFn: (m: PhotoDTO): string => m.metadata.cameraData?.lens,
      renderType: FilterRenderType.enum,
    },
    {
      name: $localize`City`,
      mapFn: (m: PhotoDTO): string => m.metadata.positionData?.city,
      renderType: FilterRenderType.enum,
    },
    {
      name: $localize`State`,
      mapFn: (m: PhotoDTO): string => m.metadata.positionData?.state,
      renderType: FilterRenderType.enum,
    },
    {
      name: $localize`Country`,
      mapFn: (m: PhotoDTO): string => m.metadata.positionData?.country,
      renderType: FilterRenderType.enum,
    },
  ];

  public readonly activeFilters = new BehaviorSubject({
    filtersVisible: false,
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
  });


  public applyFilters(
    directoryContent: Observable<DirectoryContent>
  ): Observable<DirectoryContent> {
    return directoryContent.pipe(
      switchMap((dirContent: DirectoryContent) => {
        return this.activeFilters.pipe(
          map((afilters) => {
            if (!dirContent || !dirContent.media || !afilters.filtersVisible) {
              return dirContent;
            }

            // clone, so the original won't get overwritten
            const c = {
              media: dirContent.media,
              directories: dirContent.directories,
              metaFile: dirContent.metaFile,
            };

            // date filters
            if (c.media.length > 0) {
              afilters.dateFilter.minDate = c.media.reduce(
                (p, curr) => Math.min(p, curr.metadata.creationDate),
                Number.MAX_VALUE - 1
              );
              afilters.dateFilter.maxDate = c.media.reduce(
                (p, curr) => Math.max(p, curr.metadata.creationDate),
                Number.MIN_VALUE + 1
              );
              if (afilters.dateFilter.minFilter === Number.MIN_VALUE) {
                afilters.dateFilter.minFilter = afilters.dateFilter.minDate;
              }
              if (afilters.dateFilter.maxFilter === Number.MAX_VALUE) {
                afilters.dateFilter.maxFilter = afilters.dateFilter.maxDate;
              }

              c.media = c.media.filter(
                (m) =>
                  m.metadata.creationDate >= afilters.dateFilter.minFilter &&
                  m.metadata.creationDate <= afilters.dateFilter.maxFilter
              );
            } else {
              afilters.dateFilter.minDate = Number.MIN_VALUE;
              afilters.dateFilter.maxDate = Number.MAX_VALUE;
              afilters.dateFilter.minFilter = Number.MIN_VALUE;
              afilters.dateFilter.maxFilter = Number.MAX_VALUE;
            }

            // filters
            for (const f of afilters.selectedFilters) {
              // get options
              const valueMap: { [key: string]: any } = {};
              f.options.forEach((o) => {
                valueMap[o.name] = o;
                o.count = 0; // reset count so unknown option can be removed at the end
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
                .sort((a, b) => b.count - a.count);

              // apply filters
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
                    return mapped.indexOf(opt.name) === -1;
                  });
                } else {
                  c.media = c.media.filter(
                    (m) =>
                      (f.filter.mapFn(m as PhotoDTO) as string) !== opt.name
                  );
                }
              });
            }
            return c;
          })
        );
      })
    );
  }

  public onFilterChange(): void {
    this.activeFilters.next(this.activeFilters.value);
  }

  setShowingFilters(value: boolean): void {
    if (this.activeFilters.value.filtersVisible === value) {
      return;
    }
    this.activeFilters.value.filtersVisible = value;
    if (!this.activeFilters.value.filtersVisible) {
      this.activeFilters.value.dateFilter.minFilter = Number.MIN_VALUE;
      this.activeFilters.value.dateFilter.maxFilter = Number.MAX_VALUE;
      this.activeFilters.value.selectedFilters.forEach((f) => (f.options = []));
    }
    this.onFilterChange();
  }
}


