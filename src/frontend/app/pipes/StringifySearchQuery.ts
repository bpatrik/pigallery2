import {Pipe, PipeTransform} from '@angular/core';
import {SearchQueryDTO} from '../../../common/entities/SearchQueryDTO';
import {SearchQueryParserService} from '../ui/gallery/search/search-query-parser.service';

@Pipe({
    name: 'searchQuery',
    standalone: true
})
export class StringifySearchQuery implements PipeTransform {
  constructor(private searchQueryParserService: SearchQueryParserService) {
  }

  transform(query: SearchQueryDTO): string {
    if (!query) {
      return '';
    }
    return this.searchQueryParserService.stringify(query);
  }
}

