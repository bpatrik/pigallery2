import {Component, EventEmitter, forwardRef, Input, Output} from '@angular/core';
import {
  DatePatternFrequency,
  DatePatternSearch,
  DistanceSearch,
  ListSearchQueryTypes,
  OrientationSearch,
  RangeSearch,
  SearchListQuery,
  SearchQueryDTO,
  SearchQueryTypes,
  SomeOfSearchQuery,
  TextSearch,
  TextSearchQueryMatchTypes,
  TextSearchQueryTypes,
} from '../../../../../../common/entities/SearchQueryDTO';
import {Utils} from '../../../../../../common/Utils';
import {ControlValueAccessor, NG_VALIDATORS, NG_VALUE_ACCESSOR, UntypedFormControl, ValidationErrors, Validator,} from '@angular/forms';

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

  validate(control: UntypedFormControl): ValidationErrors {
    return {required: true};
  }

  get MatchingTypes(): string[] {
    if (this.IsListQuery) {
      return [];
    }
    if (this.IsTextQuery) {
      return ['=~', '=', '!=', '!~'];
    }
    return ['=', '!=']; //normal negatable query
  }

  get SelectedMatchType(): string {
    if (this.AsTextQuery.matchType !== TextSearchQueryMatchTypes.like) {
      if (this.AsTextQuery.negate) {
        return '!=';
      } else {
        return '=';
      }
    } else {
      if (this.AsTextQuery.negate) {
        return '!~';
      } else {
        return '=~';
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
    if (value === '!~' || value === '=~') {
      this.AsTextQuery.matchType = TextSearchQueryMatchTypes.like;
    } else {
      this.AsTextQuery.matchType = TextSearchQueryMatchTypes.exact_match;
    }
  }

  addQuery(): void {
    if (!this.IsListQuery) {
      return;
    }
    this.AsListQuery.list.push({
      type: SearchQueryTypes.any_text,
      text: '',
    } as TextSearch);
  }

  onChangeType(): void {
    if (this.IsListQuery) {
      delete this.AsTextQuery.text;
      this.AsListQuery.list = this.AsListQuery.list || [
        {type: SearchQueryTypes.any_text, text: ''} as TextSearch,
        {type: SearchQueryTypes.any_text, text: ''} as TextSearch,
      ];
    } else {
      delete this.AsListQuery.list;
    }
    if (this.queryEntry.type === SearchQueryTypes.distance) {
      this.AsDistanceQuery.from = {text: ''};
      this.AsDistanceQuery.distance = 1;
    } else {
      delete this.AsDistanceQuery.from;
      delete this.AsDistanceQuery.distance;
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

