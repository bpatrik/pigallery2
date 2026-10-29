import {Component, EventEmitter, forwardRef, Input, Output,} from '@angular/core';
import {SearchQueryDTO, SearchQueryTypes, TextSearch,} from '../../../../../../common/entities/SearchQueryDTO';
import { ControlValueAccessor, NG_VALIDATORS, NG_VALUE_ACCESSOR, type ValidationErrors, Validator, FormsModule } from '@angular/forms';
import {SearchQueryParserService} from '../search-query-parser.service';
import {Utils} from '../../../../../../common/Utils';
import {SearchQueryUtils} from '../../../../../../common/SearchQueryUtils';
import { GallerySearchFieldBaseComponent } from '../search-field-base/search-field-base.gallery.component';
import { GallerySearchQueryEntryComponent } from '../query-enrty/query-entry.search.gallery.component';

@Component({
    selector: 'app-gallery-search-query-builder',
    templateUrl: './query-builder.gallery.component.html',
    styleUrl: './query-builder.gallery.component.css',
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

  /**
   * Utils.equalsFilter only checks the keys of its second argument,
   * so a removed property (e.g. a deleted date range end) would go unnoticed.
   */
  private static isSameQuery(a: SearchQueryDTO, b: SearchQueryDTO): boolean {
    const nA = SearchQueryUtils.stripDefault(a);
    const nB = SearchQueryUtils.stripDefault(b);
    return Utils.equalsFilter(nA, nB) && Utils.equalsFilter(nB, nA);
  }

  validateRawSearchText(): void {

    try {
      const newDTO = this.searchQueryParserService.parse(
          this.rawSearchText
      );
      if (GallerySearchQueryBuilderComponent.isSameQuery(this.searchQueryDTO, newDTO)) {
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
      if (GallerySearchQueryBuilderComponent.isSameQuery(this.searchQueryDTO, obj) &&
          GallerySearchQueryBuilderComponent.isSameQuery(this.searchQueryParserService.parse(
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
      if (GallerySearchQueryBuilderComponent.isSameQuery(this.searchQueryParserService.parse(this.rawSearchText), this.searchQueryDTO)) {
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
