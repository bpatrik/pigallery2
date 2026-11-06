import { Component, ElementRef, forwardRef, inject, input, output, viewChild, signal, computed } from '@angular/core';
import {Router} from '@angular/router';
import {AutoCompleteResult, AutoCompleteService, RenderableAutoCompleteItem,} from '../autocomplete.service';
import {MetadataSearchQueryTypes, SearchQueryTypes,} from '../../../../../../common/entities/SearchQueryDTO';
import {Config} from '../../../../../../common/config/public/Config';
import {ControlValueAccessor, FormsModule, NG_VALIDATORS, NG_VALUE_ACCESSOR, type ValidationErrors, Validator} from '@angular/forms';
import {AutoCompleteRenderItem} from '../AutoCompleteRenderItem';

import {NgIconComponent} from '@ng-icons/core';

// the navbar and the search modal can show a search field at the same time
let nextAutoCompleteListId = 0;

@Component({
  selector: 'app-gallery-search-field-base',
  templateUrl: './search-field-base.gallery.component.html',
  styleUrl: './search-field-base.gallery.component.css',
  providers: [
    AutoCompleteService,
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => GallerySearchFieldBaseComponent),
      multi: true,
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => GallerySearchFieldBaseComponent),
      multi: true,
    },
  ],
  imports: [
    FormsModule,
    NgIconComponent
]
})
export class GallerySearchFieldBaseComponent
  implements ControlValueAccessor, Validator {
  private autoCompleteService = inject(AutoCompleteService);
  router = inject(Router);

  readonly placeholder = input<string | undefined>($localize `Search`);
  readonly searchSubmit = output<void>();

  readonly searchField = viewChild.required<ElementRef>('SearchField');
  readonly searchHintField = viewChild.required<ElementRef>('SearchHintField');

  readonly autoCompleteRenders = signal<AutoCompleteRenderItem[]>([]);
  public readonly rawSearchText = signal('');
  readonly mouseOverAutoComplete = signal(false);
  readonly SearchQueryTypes: typeof SearchQueryTypes;
  public readonly MetadataSearchQueryTypes: {
    value: string;
    key: SearchQueryTypes;
  }[];
  public readonly highlightedAutoCompleteItem = signal(-1);
  readonly autoCompleteListId = 'autocomplete-list-' + nextAutoCompleteListId++;
  readonly inFocus = signal(false);
  private cache = {
    lastAutocomplete: '',
    lastInstantSearch: '',
  };
  private readonly autoCompleteItems = signal<RenderableAutoCompleteItem[]>([]);
  // only the latest autocomplete request may show its server results
  private autoCompleteRequest = 0;

  constructor() {
    this.SearchQueryTypes = SearchQueryTypes;
    this.MetadataSearchQueryTypes = MetadataSearchQueryTypes.map(
      (v): { value: string; key: SearchQueryTypes } => ({
        key: v,
        value: SearchQueryTypes[v],
      })
    );
  }

  readonly SearchHint = computed((): string => {
    const rawSearchText = this.rawSearchText();
    const autoCompleteItems = this.autoCompleteItems();
    if (!rawSearchText) {
      return '';
    }
    if (
      !this.inFocus() ||
      !autoCompleteItems ||
      autoCompleteItems.length === 0
    ) {
      return rawSearchText;
    }
    const itemIndex =
      this.highlightedAutoCompleteItem() < 0
        ? 0
        : this.highlightedAutoCompleteItem();
    const searchText = this.getAutocompleteToken();
    if (searchText.current === '') {
      return (
        rawSearchText + autoCompleteItems[itemIndex].queryHint
      );
    }
    if (
      autoCompleteItems[0].queryHint.startsWith(searchText.current)
    ) {
      return (
        rawSearchText +
        autoCompleteItems[itemIndex].queryHint.substr(
          searchText.current.length
        )
      );
    }
    return rawSearchText;
  });

  getAutocompleteToken(): { current: string; prev: string } {
    if (this.rawSearchText().trim().length === 0) {
      return {current: '', prev: ''};
    }
    const tokens = this.rawSearchText().split(' ');
    return {
      current: tokens[tokens.length - 1],
      prev: tokens.length > 2 ? tokens[tokens.length - 2] : '',
    };
  }

  onSearchChange(): void {
    const searchText = this.getAutocompleteToken();
    if (
      Config.Search.AutoComplete.enabled &&
      this.cache.lastAutocomplete !== searchText.current
    ) {
      this.cache.lastAutocomplete = searchText.current;
      this.autocomplete(searchText).catch(console.error);
    }
  }

  public setMouseOverAutoComplete(value: boolean): void {
    this.mouseOverAutoComplete.set(value);
  }

  onFocus(): void {
    this.inFocus.set(true);
  }

  public onFocusLost(): void {
    this.inFocus.set(false);
    if (this.mouseOverAutoComplete() === false) {
      this.autoCompleteRenders.set([]);
    }
  }

  applyHint($event: Event): void {
    if (($event.target as HTMLInputElement).selectionStart !== this.rawSearchText().length) {
      return;
    }
    // if no item selected, apply hint
    if (this.highlightedAutoCompleteItem() < 0) {
      this.rawSearchText.set(this.SearchHint());
      this.onChange();
      return;
    }

    // force apply selected autocomplete item
    this.applyAutoComplete(
      this.autoCompleteRenders()[this.highlightedAutoCompleteItem()]
    );
  }

  applyAutoComplete(item: AutoCompleteRenderItem): void {
    const token = this.getAutocompleteToken();
    this.rawSearchText.set(
      this.rawSearchText().substr(
        0,
        this.rawSearchText().length - token.current.length
      ) + item.queryHint);
    this.onChange();
    this.emptyAutoComplete();
  }

  searchAutoComplete(item: AutoCompleteRenderItem): void {
    this.applyAutoComplete(item);

    if (!item.notSearchable) {
      this.searchSubmit.emit();
    }
  }

  setMouseOverAutoCompleteItem(i: number): void {
    this.highlightedAutoCompleteItem.set(i);
  }

  selectAutocompleteUp(): void {
    if (this.highlightedAutoCompleteItem() > 0) {
      this.highlightedAutoCompleteItem.update((i) => i - 1);
    }
  }

  selectAutocompleteDown(): void {
    if (
      this.highlightedAutoCompleteItem() < this.autoCompleteItems().length - 1
    ) {
      this.highlightedAutoCompleteItem.update((i) => i + 1);
    }
  }

  OnEnter(): boolean {
    // no autocomplete shown, just search whatever is there.
    if (
      this.autoCompleteRenders().length === 0 ||
      this.highlightedAutoCompleteItem() === -1
    ) {
      this.searchSubmit.emit();
      return false;
    }
    // search selected autocomplete
    this.searchAutoComplete(
      this.autoCompleteRenders()[this.highlightedAutoCompleteItem()]
    );
    return false;
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  public onTouched(): void {
  }

  public writeValue(obj: string): void {
    this.rawSearchText.set(obj);
  }

  registerOnChange(fn: (_: unknown) => void): void {
    this.propagateChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.propagateTouch = fn;
  }

  public onChange(): void {
    this.propagateChange(this.rawSearchText());
  }

  // the field has no constraints, so it is always valid
  validate(): ValidationErrors | null {
    return null;
  }

  Scrolled(): void {
    this.searchHintField().nativeElement.scrollLeft =
      this.searchField().nativeElement.scrollLeft;
  }

  private emptyAutoComplete(): void {
    this.mouseOverAutoComplete.set(false);
    this.highlightedAutoCompleteItem.set(-1);
    this.autoCompleteRenders.set([]);
  }

  private async autocomplete(searchText: {
    current: string;
    prev: string;
  }): Promise<void> {
    if (!Config.Search.AutoComplete.enabled) {
      return;
    }

    if (this.rawSearchText().trim().length > 0) {
      // are we searching for anything?
      // a new request drops the server results of the previous one
      const request = ++this.autoCompleteRequest;
      let result: AutoCompleteResult;
      try {
        result = this.autoCompleteService.autoComplete(searchText);
        this.autoCompleteItems.set(result.items);
        this.showSuggestions(result.items, searchText.current);
      } catch (error) {
        console.error(error);
        return;
      }
      if (!result.more) {
        return;
      }
      const items = await result.more;
      if (request !== this.autoCompleteRequest) {
        return;
      }
      this.autoCompleteItems.set(items);
      this.showSuggestions(items, searchText.current);
    } else {
      this.emptyAutoComplete();
    }
  }

  private showSuggestions(
    suggestions: RenderableAutoCompleteItem[],
    searchText: string
  ): void {
    this.emptyAutoComplete();
    this.autoCompleteRenders.set(suggestions.map((item: RenderableAutoCompleteItem): AutoCompleteRenderItem =>
      new AutoCompleteRenderItem(
        item.value,
        this.autoCompleteService.getPrefixLessSearchText(searchText),
        item.type,
        item.queryHint,
        item.notSearchable
      )
    ));
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private propagateChange = (_: string): void => {
  };

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private propagateTouch = (_: never): void => {
  };

}

