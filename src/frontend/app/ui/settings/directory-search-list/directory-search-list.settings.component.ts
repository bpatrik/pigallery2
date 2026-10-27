import {Component, EventEmitter, Input, Output} from '@angular/core';

import {FormsModule} from '@angular/forms';
import {NgIconComponent} from '@ng-icons/core';
import {DirectorySearch, SearchQueryTypes, TextSearchQueryMatchTypes} from '../../../../../common/entities/SearchQueryDTO';
import {StringifySearchType} from '../../../pipes/StringifySearchType';
import {TextSearchMatchingTypes} from '../../gallery/search/query-enrty/TextSearchMatchingTypes';

/**
 * Editor for a list of directory searches (directory allow/block lists).
 * It looks like the query builder's text search entry.
 */
@Component({
  selector: 'app-settings-directory-search-list',
  templateUrl: './directory-search-list.settings.component.html',
  imports: [FormsModule, NgIconComponent, StringifySearchType]
})
export class DirectorySearchListSettingsComponent {
  @Input() list: DirectorySearch[] = [];
  @Input() idName = '';
  @Input() disabled = false;
  @Input() newItem: () => DirectorySearch = () => ({
    type: SearchQueryTypes.directory,
    value: '',
    matchType: TextSearchQueryMatchTypes.exact_match,
    negate: false
  });
  @Output() changed = new EventEmitter<void>();

  readonly SearchQueryTypes = SearchQueryTypes;
  readonly MatchingTypes = TextSearchMatchingTypes.values;

  getMatchingType(d: DirectorySearch): string {
    return TextSearchMatchingTypes.get(d);
  }

  setMatchingType(d: DirectorySearch, value: string): void {
    TextSearchMatchingTypes.set(d, value);
    this.changed.emit();
  }

  getMatchingTypesDescription(type: string): string {
    return TextSearchMatchingTypes.getDescription(type);
  }

  add(): void {
    this.list.push(this.newItem());
    this.changed.emit();
  }

  remove(i: number): void {
    this.list.splice(i, 1);
    this.changed.emit();
  }
}
