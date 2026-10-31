import { Pipe, PipeTransform, inject } from '@angular/core';
import {SearchQueryDTO} from '../../../common/entities/SearchQueryDTO';
import {SearchQueryParserService} from '../ui/gallery/search/search-query-parser.service';

@Pipe({
    name: 'searchQuery'
})
export class StringifySearchQuery implements PipeTransform {
  private searchQueryParserService = inject(SearchQueryParserService);


  transform(query: SearchQueryDTO): string {
    if (!query) {
      return '';
    }
    return this.searchQueryParserService.stringify(query);
  }
}

