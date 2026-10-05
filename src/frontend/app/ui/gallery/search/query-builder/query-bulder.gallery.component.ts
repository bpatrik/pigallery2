import {Component, EventEmitter, forwardRef, Input, Output, ChangeDetectionStrategy} from '@angular/core';
import {type SearchQueryDTO, SearchQueryTypes, type TextSearch,} from '../../../../../../common/entities/SearchQueryDTO';
import { type ControlValueAccessor, NG_VALIDATORS, NG_VALUE_ACCESSOR, type ValidationErrors, type Validator, FormsModule } from '@angular/forms';
import {SearchQueryParserService} from '../search-query-parser.service';
import {Utils} from '../../../../../../common/Utils';
import { GallerySearchFieldBaseComponent } from '../search-field-base/search-field-base.gallery.component';
import { GallerySearchQueryEntryComponent } from '../query-enrty/query-entry.search.gallery.component';

@Component({
    selector: 'app-gallery-search-query-builder',
    templateUrl: './query-builder.gallery.component.html',
    styleUrls: ['./query-builder.gallery.component.css'],
    providers: [
        {
            provide: NG_VALUE_ACCESSOR,
            useExisting: forwardRef(() => GallerySearchQueryBuilderComponent),
            multi: true,
        },
        {
            provide: NG_VALIDATORS,
            useExisting: forwardRef(() => GallerySearchQueryBuilderComponent),
            multi: true,
        },
    ],
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [
        GallerySearchFieldBaseComponent,
        FormsModule,
        GallerySearchQueryEntryComponent,
    ]
})
export class GallerySearchQueryBuilderComponent
    implements ControlValueAccessor, Validator {
  public searchQueryDTO: SearchQueryDTO = {
    type: SearchQueryTypes.any_text,
    value: '',
  } as TextSearch;
  @Output() search = new EventEmitter<void>();
  @Input() placeholder = $localize`Search`;
  public rawSearchText = '';

  constructor(private searchQueryParserService: SearchQueryParserService) {
  }

  validateRawSearchText(): void {

    try {
      const newDTO = this.searchQueryParserService.parse(
          this.rawSearchText
      );
      if (Utils.equalsFilter(this.searchQueryDTO, newDTO)) {
        return;
      }
      this.searchQueryDTO = newDTO;
      this.onChange();
    } catch (e) {
      console.error(e);
    }
  }

  resetQuery(): void {
    this.searchQueryDTO = {
      value: '',
      type: SearchQueryTypes.any_text,
    } as TextSearch;
    this.onChange();
  }

  validate(): ValidationErrors {
    return {required: true};
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  public onTouched(): void {
  }

  public writeValue(obj: SearchQueryDTO): void {
    try {
      // do not trigger change if nothing changed
      if (Utils.equalsFilter(this.searchQueryDTO, obj) &&
          Utils.equalsFilter(this.searchQueryParserService.parse(
              this.rawSearchText
          ), obj)) {
        return;
      }
    } catch (e) {
      // if cant parse they are not the same
    }
    this.searchQueryDTO = obj;
    this.rawSearchText = this.searchQueryParserService.stringify(
        this.searchQueryDTO
    );
  }

  registerOnChange(fn: (_: SearchQueryDTO) => void): void {
    this.propagateChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.propagateTouch = fn;
  }

  public onChange(): void {
    try {
      if (Utils.equalsFilter(this.searchQueryParserService.parse(this.rawSearchText), this.searchQueryDTO)) {
        this.propagateChange(this.searchQueryDTO);
        return;
      }
    } catch (e) {
      // if cant parse they are not the same
    }
    this.rawSearchText = this.searchQueryParserService.stringify(
        this.searchQueryDTO
    );
    this.propagateChange(this.searchQueryDTO);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private propagateChange = (_: SearchQueryDTO): void => {
    // ignoring
  };

  private propagateTouch = (): void => {
    // ignoring
  };
}
