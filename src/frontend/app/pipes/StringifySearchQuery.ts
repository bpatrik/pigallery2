import {Pipe, type PipeTransform} from '@angular/core';
import {type SearchQueryDTO} from '../../../common/entities/SearchQueryDTO';
import {SearchQueryParserService} from '../ui/gallery/search/search-query-parser.service';

@Pipe({
    name: 'searchQuery',
    standalone: true
})
export class StringifySearchQuery implements PipeTransform {
  constructor(private searchQueryParserService: SearchQueryParserService) {
  }

  transform(query: SearchQueryDTO): string {
    return this.searchQueryParserService.stringify(query);
  }
}

