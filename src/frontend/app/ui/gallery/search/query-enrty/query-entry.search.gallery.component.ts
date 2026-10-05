import {Component, EventEmitter, forwardRef, Input, Output} from '@angular/core';
import {
  DatePatternFrequency,
  DatePatternSearch,
  DistanceSearch,
  ListSearchQueryTypes,
  OrientationSearch,
  RangeSearch,
  RangeSearchQueryTypes,
  SearchListQuery,
  SearchQueryDTO,
  SearchQueryTypes,
  SomeOfSearchQuery,
  TextSearch,
  TextSearchQueryMatchTypes,
  TextSearchQueryTypes,
} from '../../../../../../common/entities/SearchQueryDTO';
import {Utils} from '../../../../../../common/Utils';
import {
  ControlValueAccessor,
  FormsModule,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  UntypedFormControl,
  ValidationErrors,
  Validator
} from '@angular/forms';
import { DatePipe, NgClass } from '@angular/common';
import {NgIconComponent} from '@ng-icons/core';
import {StringifySearchType} from '../../../../pipes/StringifySearchType';

@Component({
  selector: 'app-gallery-search-query-entry',
  templateUrl: './query-entry.search.gallery.component.html',
  styleUrls: ['./query-entry.search.gallery.component.css'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => GallerySearchQueryEntryComponent),
      multi: true,
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => GallerySearchQueryEntryComponent),
      multi: true,
    },
  ],
  imports: [
    FormsModule,
    NgClass,
    NgIconComponent,
    DatePipe,
    StringifySearchType
]
})
export class GallerySearchQueryEntryComponent
  implements ControlValueAccessor, Validator {
  public queryEntry: SearchQueryDTO;
  public SearchQueryTypesEnum: { value: string; key: SearchQueryTypes }[];
  public SearchQueryTypes = SearchQueryTypes;
  public DatePatternFrequency = DatePatternFrequency;
  public TextSearchQueryMatchTypes = TextSearchQueryMatchTypes;
  @Output() delete = new EventEmitter<void>();
  @Input() id = 'NA';

  public locationInputText: string = '';

  constructor() {
    this.SearchQueryTypesEnum = Utils.enumToArray(SearchQueryTypes);
    // Range queries need to be added as AND with min and max sub entry
    this.SearchQueryTypesEnum = this.SearchQueryTypesEnum.filter(
      (e): boolean => e.key !== SearchQueryTypes.UNKNOWN_RELATION
    );
  }

  get IsTextQuery(): boolean {
    return (
      this.queryEntry && TextSearchQueryTypes.includes(this.queryEntry.type)
    );
  }

  get IsListQuery(): boolean {
    return (
      this.queryEntry && ListSearchQueryTypes.includes(this.queryEntry.type)
    );
  }

  get IsRangeQuery(): boolean {
    return (
      this.queryEntry && (RangeSearchQueryTypes.includes(this.queryEntry.type))
    );
  }

  get AsListQuery(): SearchListQuery {
    return this.queryEntry as SearchListQuery;
  }

  public get AsRangeQuery(): RangeSearch {
    return this.queryEntry as RangeSearch;
  }

  get AsOrientationQuery(): OrientationSearch {
    return this.queryEntry as OrientationSearch;
  }

  get AsDatePatternQuery(): DatePatternSearch {
    return this.queryEntry as DatePatternSearch;
  }

  get AsDistanceQuery(): DistanceSearch {
    return this.queryEntry as DistanceSearch;
  }

  get AsSomeOfQuery(): SomeOfSearchQuery {
    return this.queryEntry as SomeOfSearchQuery;
  }

  get AsTextQuery(): TextSearch {
    return this.queryEntry as TextSearch;
  }

  get MatchingTypes(): string[] {
    if (this.IsListQuery) {
      return [];
    }
    if (this.IsTextQuery) {
      return ['~', '!~', '=', '!=', 'glob', '!glob'];
    }
    return ['=', '!=']; //normal negatable query
  }

  get SelectedMatchType(): string {
    if (this.AsTextQuery.matchType === TextSearchQueryMatchTypes.exact_match) {
      if (this.AsTextQuery.negate) {
        return '!=';
      } else {
        return '=';
      }
    } else if (typeof this.AsTextQuery.matchType === 'undefined' ||
      this.AsTextQuery.matchType === TextSearchQueryMatchTypes.like) {
      if (this.AsTextQuery.negate) {
        return '!~';
      } else {
        return '~';
      }
    } else if (this.AsTextQuery.matchType === TextSearchQueryMatchTypes.globMatch) {
      if (this.AsTextQuery.negate) {
        return '!glob';
      } else {
        return 'glob';
      }
    }
  }

  set SelectedMatchType(value: string) {
    if (this.IsListQuery) {
      return;
    }
    this.AsTextQuery.negate = value.charAt(0) === '!';
    if (!this.IsTextQuery) {
      return;
    }
    if (value === '!~' || value === '~') {
      this.AsTextQuery.matchType = TextSearchQueryMatchTypes.like;
    } else if (value === '!=' || value === '=') {
      this.AsTextQuery.matchType = TextSearchQueryMatchTypes.exact_match;
    } else if (value === '!glob' || value === 'glob') {
      this.AsTextQuery.matchType = TextSearchQueryMatchTypes.globMatch;
    }
  }

  getMatchingTypesDescription(type: string) {
    switch (type) {
      case '=':
        if (this.IsTextQuery) {
          return $localize`Exact match (e.g.: bb matches for \' bb \')`;
        }
        return $localize`Exact match`;
      case '!=':
        return $localize`Exact negative match`;
      // only supported for text queries
      case '~':
        return $localize`Open and start match (e.g.: bb matches for \'abba\' and \' bb \')`;
      case '!~':
        return $localize`Negative open and start  match`;
      case 'glob':
        return $localize`glob match (supports wildcards: * and ?)`;
      case '!glob':
        return $localize`Negative glob match`;
    }
  }

  validate(control: UntypedFormControl): ValidationErrors {
    return {required: true};
  }

  addQuery(): void {
    if (!this.IsListQuery) {
      return;
    }
    this.AsListQuery.list.push({
      type: SearchQueryTypes.any_text,
      value: '',
    } as TextSearch);
  }

  onChangeType(): void {
    if (this.IsListQuery) {
      delete this.AsTextQuery.value;
      this.AsListQuery.list = this.AsListQuery.list || [
        {type: SearchQueryTypes.any_text, value: ''} as TextSearch,
        {type: SearchQueryTypes.any_text, value: ''} as TextSearch,
      ];
    } else {
      delete this.AsListQuery.list;
    }
    if (this.queryEntry.type === SearchQueryTypes.distance) {
      this.AsDistanceQuery.distance = 1;
      // Initialize location input text
      if (this.AsDistanceQuery.from?.GPSData) {
        this.locationInputText = `${this.AsDistanceQuery.from.GPSData.latitude}, ${this.AsDistanceQuery.from.GPSData.longitude}`;
      } else {
        this.locationInputText = this.AsDistanceQuery.from?.value || '';
      }
    } else {
      delete this.AsDistanceQuery.from;
      delete this.AsDistanceQuery.distance;
    }

    if (this.IsRangeQuery) {
      if (this.AsRangeQuery.min !== undefined) {
        this.AsRangeQuery.min = isNaN(this.AsRangeQuery.min) ? 0 : this.AsRangeQuery.min;
      }
      if (this.AsRangeQuery.max !== undefined) {
        this.AsRangeQuery.max = isNaN(this.AsRangeQuery.max) ? 0 : this.AsRangeQuery.max;
      }

    }

    if (this.queryEntry.type === SearchQueryTypes.orientation) {
      this.AsOrientationQuery.landscape = true;
    } else {
      delete this.AsOrientationQuery.landscape;
    }


    if (this.queryEntry.type === SearchQueryTypes.date_pattern) {
      this.AsDatePatternQuery.daysLength = 0;
      this.AsDatePatternQuery.frequency = DatePatternFrequency.every_year;
    } else {
      delete this.AsDatePatternQuery.daysLength;
      delete this.AsDatePatternQuery.frequency;
      delete this.AsDatePatternQuery.agoNumber;
    }
    this.onChange();
  }

  onLocationInputChange(value: string): void {
    // Check if input matches coordinate pattern (number, number)
    const coordMatch = value.match(/^\s*(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)\s*$/);
    if (coordMatch) {
      // It's coordinates
      const latitude = parseFloat(coordMatch[1]);
      const longitude = parseFloat(coordMatch[2]);

      // Validate coordinate ranges
      if (latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180) {
        this.AsDistanceQuery.from = {
          GPSData: {
            latitude,
            longitude
          }
        };
      } else {
        // Invalid coordinates, treat as text
        this.AsDistanceQuery.from = {value: value};
      }
    } else {
      // It's a location name
      this.AsDistanceQuery.from = {value: value};
    }

    this.locationInputText = value;
    this.onChange();
  }

  deleteItem(): void {
    this.delete.emit();
  }

  itemDeleted(index: number): void {
    this.AsListQuery.list.splice(index, 1);
    this.onChange();
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  public onTouched(): void {
  }

  public writeValue(obj: SearchQueryDTO): void {
    this.queryEntry = obj;

    // Initialize location input text if this is a distance search
    if (obj?.type === SearchQueryTypes.distance) {
      const distanceSearch = obj as DistanceSearch;
      if (distanceSearch.from?.GPSData) {
        this.locationInputText = `${distanceSearch.from.GPSData.latitude}, ${distanceSearch.from.GPSData.longitude}`;
      } else {
        this.locationInputText = distanceSearch.from?.value || '';
      }
    }
  }

  registerOnChange(fn: (_: unknown) => void): void {
    this.propagateChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.propagateTouch = fn;
  }

  public onChange(): void {
    this.propagateChange(this.queryEntry);
  }


  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private propagateChange = (_: unknown): void => {
  };

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private propagateTouch = (_: unknown): void => {
  };
}
