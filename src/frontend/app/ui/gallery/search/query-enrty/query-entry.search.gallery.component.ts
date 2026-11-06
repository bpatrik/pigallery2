import {Component, forwardRef, input, output, signal} from '@angular/core';
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
  type ValidationErrors,
  Validator
} from '@angular/forms';
import { DatePipe } from '@angular/common';
import {NgIconComponent} from '@ng-icons/core';
import {StringifySearchType} from '../../../../pipes/StringifySearchType';
import {TextSearchMatchingTypes} from './TextSearchMatchingTypes';

@Component({
  selector: 'app-gallery-search-query-entry',
  templateUrl: './query-entry.search.gallery.component.html',
  styleUrl: './query-entry.search.gallery.component.css',
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
    NgIconComponent,
    DatePipe,
    StringifySearchType
]
})
export class GallerySearchQueryEntryComponent
  implements ControlValueAccessor, Validator {
  public readonly queryEntry = signal<SearchQueryDTO | undefined>(undefined);
  public SearchQueryTypesEnum: { value: string; key: SearchQueryTypes }[];
  public SearchQueryTypes = SearchQueryTypes;
  public DatePatternFrequency = DatePatternFrequency;
  public TextSearchQueryMatchTypes = TextSearchQueryMatchTypes;
  readonly delete = output<void>();
  readonly id = input('NA');

  public readonly locationInputText = signal<string>('');

  constructor() {
    this.SearchQueryTypesEnum = Utils.enumToArray(SearchQueryTypes);
    // Range queries need to be added as AND with min and max sub entry
    this.SearchQueryTypesEnum = this.SearchQueryTypesEnum.filter(
      (e): boolean => e.key !== SearchQueryTypes.UNKNOWN_RELATION
    );
  }

  get IsTextQuery(): boolean {
    const entry = this.queryEntry();
    return !!entry && TextSearchQueryTypes.includes(entry.type);
  }

  get IsListQuery(): boolean {
    const entry = this.queryEntry();
    return !!entry && ListSearchQueryTypes.includes(entry.type);
  }

  get IsRangeQuery(): boolean {
    const entry = this.queryEntry();
    return !!entry && RangeSearchQueryTypes.includes(entry.type);
  }

  get AsListQuery(): SearchListQuery {
    return this.queryEntry() as SearchListQuery;
  }

  public get AsRangeQuery(): RangeSearch {
    return this.queryEntry() as RangeSearch;
  }

  get AsOrientationQuery(): OrientationSearch {
    return this.queryEntry() as OrientationSearch;
  }

  get AsDatePatternQuery(): DatePatternSearch {
    return this.queryEntry() as DatePatternSearch;
  }

  get AsDistanceQuery(): DistanceSearch {
    return this.queryEntry() as DistanceSearch;
  }

  get AsSomeOfQuery(): SomeOfSearchQuery {
    return this.queryEntry() as SomeOfSearchQuery;
  }

  get AsTextQuery(): TextSearch {
    return this.queryEntry() as TextSearch;
  }

  // the matching types with their descriptions (shown as the option's tooltip)
  private readonly textMatchingTypes = TextSearchMatchingTypes.values
    .map(value => ({value, description: TextSearchMatchingTypes.getDescription(value, true)}));
  private readonly negatableMatchingTypes = ['=', '!='] //normal negatable query
    .map(value => ({value, description: TextSearchMatchingTypes.getDescription(value, false)}));

  get MatchingTypes(): { value: string; description: string | undefined }[] {
    if (this.IsListQuery) {
      return [];
    }
    if (this.IsTextQuery) {
      return this.textMatchingTypes;
    }
    return this.negatableMatchingTypes;
  }

  get SelectedMatchType(): string | undefined {
    return TextSearchMatchingTypes.get(this.AsTextQuery);
  }

  set SelectedMatchType(value: string) {
    if (this.IsListQuery) {
      return;
    }
    if (!this.IsTextQuery) {
      this.AsTextQuery.negate = value.charAt(0) === '!';
      return;
    }
    TextSearchMatchingTypes.set(this.AsTextQuery, value);
  }

  // the field has no constraints, so it is always valid
  validate(): ValidationErrors | null {
    return null;
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
    const entry = this.queryEntry();
    if (!entry) {
      return;
    }
    // a new type keeps only the fields of that type
    const deleteField = (key: string): void => {
      delete (entry as unknown as Record<string, unknown>)[key];
    };
    if (this.IsListQuery) {
      deleteField('value');
      this.AsListQuery.list = this.AsListQuery.list || [
        {type: SearchQueryTypes.any_text, value: ''} as TextSearch,
        {type: SearchQueryTypes.any_text, value: ''} as TextSearch,
      ];
    } else {
      deleteField('list');
    }
    if (!this.IsTextQuery) {
      deleteField('value');
    }
    if (entry.type === SearchQueryTypes.distance) {
      this.AsDistanceQuery.distance = 1;
      // Initialize location input text
      if (this.AsDistanceQuery.from?.GPSData) {
        this.locationInputText.set(`${this.AsDistanceQuery.from.GPSData.latitude}, ${this.AsDistanceQuery.from.GPSData.longitude}`);
      } else {
        this.locationInputText.set(this.AsDistanceQuery.from?.value || '');
      }
    } else {
      deleteField('from');
      deleteField('distance');
    }

    if (this.IsRangeQuery) {
      if (this.AsRangeQuery.min !== undefined) {
        this.AsRangeQuery.min = isNaN(this.AsRangeQuery.min) ? 0 : this.AsRangeQuery.min;
      }
      if (this.AsRangeQuery.max !== undefined) {
        this.AsRangeQuery.max = isNaN(this.AsRangeQuery.max) ? 0 : this.AsRangeQuery.max;
      }

    }

    if (entry.type === SearchQueryTypes.orientation) {
      this.AsOrientationQuery.landscape = true;
    } else {
      deleteField('landscape');
    }


    if (entry.type === SearchQueryTypes.date_pattern) {
      this.AsDatePatternQuery.daysLength = 0;
      this.AsDatePatternQuery.frequency = DatePatternFrequency.every_year;
    } else {
      deleteField('daysLength');
      deleteField('frequency');
      deleteField('agoNumber');
    }
    this.onChange();
  }

  /**
   * Date inputs emit 'yyyy-MM-dd' strings, but RangeSearch expects UTC timestamps
   */
  onDateChange(field: 'min' | 'max', value: string): void {
    const parts = (value || '').split('-').map((t) => parseInt(t, 10));
    if (parts.length === 3 && parts.every((p) => !isNaN(p))) {
      this.AsRangeQuery[field] = Date.UTC(parts[0], parts[1] - 1, parts[2]);
    } else {
      delete this.AsRangeQuery[field];
    }
    // keep the range valid: moving one end past the other drags the other end along
    const q = this.AsRangeQuery;
    if (q.min !== undefined && q.max !== undefined && q.min > q.max) {
      if (field === 'min') {
        q.max = q.min;
      } else {
        q.min = q.max;
      }
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

    this.locationInputText.set(value);
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
    this.queryEntry.set(obj);

    // Initialize location input text if this is a distance search
    if (obj?.type === SearchQueryTypes.distance) {
      const distanceSearch = obj as DistanceSearch;
      if (distanceSearch.from?.GPSData) {
        this.locationInputText.set(`${distanceSearch.from.GPSData.latitude}, ${distanceSearch.from.GPSData.longitude}`);
      } else {
        this.locationInputText.set(distanceSearch.from?.value || '');
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
    this.propagateChange(this.queryEntry());
  }


  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private propagateChange = (_: unknown): void => {
  };

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private propagateTouch = (_: unknown): void => {
  };
}
