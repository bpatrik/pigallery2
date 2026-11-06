import { Component, forwardRef, TemplateRef, inject, input, output, signal } from '@angular/core';
import {Router} from '@angular/router';
import {AutoCompleteService} from '../autocomplete.service';
import {SearchQueryDTO} from '../../../../../../common/entities/SearchQueryDTO';
import {ControlValueAccessor, FormsModule, NG_VALIDATORS, NG_VALUE_ACCESSOR, type ValidationErrors, Validator} from '@angular/forms';
import {SearchQueryParserService} from '../search-query-parser.service';
import {BsModalRef, BsModalService,} from 'ngx-bootstrap/modal';
import {Utils} from '../../../../../../common/Utils';
import {GallerySearchFieldBaseComponent} from '../search-field-base/search-field-base.gallery.component';
import {NgIconComponent} from '@ng-icons/core';
import {GallerySearchQueryBuilderComponent} from '../query-builder/query-bulder.gallery.component';

@Component({
  selector: 'app-gallery-search-field',
  templateUrl: './search-field.gallery.component.html',
  styleUrl: './search-field.gallery.component.css',
  providers: [
    AutoCompleteService,
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => GallerySearchFieldComponent),
      multi: true,
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => GallerySearchFieldComponent),
      multi: true,
    },
  ],
  imports: [
    GallerySearchFieldBaseComponent,
    FormsModule,
    NgIconComponent,
    GallerySearchQueryBuilderComponent,
  ]
})
export class GallerySearchFieldComponent
  implements ControlValueAccessor, Validator {
  private autoCompleteService = inject(AutoCompleteService);
  private searchQueryParserService = inject(SearchQueryParserService);
  private modalService = inject(BsModalService);
  router = inject(Router);

  readonly searchSubmit = output<void>();
  readonly placeholder = input<string>();
  public readonly rawSearchText = signal('');
  public readonly searchQueryDTO = signal<SearchQueryDTO | undefined>(undefined);
  private searchModalRef: BsModalRef | null;

  public async openSearchModal(template: TemplateRef<unknown>): Promise<void> {
    this.searchModalRef = this.modalService.show(template, {
      class: 'modal-lg',
    });
    document.body.style.paddingRight = '0px';
  }

  public hideSearchModal(): void {
    this.searchModalRef?.hide();
    this.searchModalRef = null;
  }

  public onTouched(): void {
    //ignoring
  }

  public writeValue(obj: SearchQueryDTO): void {
    try {
      if (Utils.equalsFilter(this.searchQueryDTO(), obj) &&
        Utils.equalsFilter(this.searchQueryParserService.parse(
          this.rawSearchText()
        ), obj)) {
        return;
      }
    } catch {
      // if cant parse they are not the same
    }
    this.searchQueryDTO.set(obj);
    this.rawSearchText.set(this.searchQueryParserService.stringify(
      this.searchQueryDTO()
    ));
  }

  registerOnChange(fn: (_: unknown) => void): void {
    this.propagateChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.propagateTouch = fn;
  }

  public onChange(): void {
    this.propagateChange(this.searchQueryDTO());
  }

  // the field has no constraints, so it is always valid
  validate(): ValidationErrors | null {
    return null;
  }

  onQueryChange(): void {
    try {
      if (Utils.equalsFilter(this.searchQueryParserService.parse(this.rawSearchText()), this.searchQueryDTO())) {
        this.onChange();
        return;
      }
    } catch {
      // if cant parse they are not the same
    }
    this.rawSearchText.set(this.searchQueryParserService.stringify(
      this.searchQueryDTO()
    ));

    this.onChange();
  }

  validateRawSearchText(): void {
    try {
      this.searchQueryDTO.set(this.searchQueryParserService.parse(
        this.rawSearchText()
      ));
      this.onChange();
    } catch (e) {
      console.error(e);
    }
  }

  private propagateChange = (_: SearchQueryDTO | undefined): void => {
    //ignoring
  };

  private propagateTouch = (): void => {
    //ignoring
  };
}

