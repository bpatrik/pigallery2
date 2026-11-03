import {Pipe, PipeTransform} from '@angular/core';
import {SearchQueryTypes, TextSearch, TextSearchQueryMatchTypes} from '../../../common/entities/SearchQueryDTO';
import {SearchQueryUtils} from '../../../common/SearchQueryUtils';

/**
 * The /search route parameter of an exact match text search (e.g. a keyword, a person or a place).
 */
@Pipe({
  name: 'textSearchLink'
})
export class TextSearchLinkPipe implements PipeTransform {
  transform(value: string, type: SearchQueryTypes): string {
    return SearchQueryUtils.urlify({
      type,
      matchType: TextSearchQueryMatchTypes.exact_match,
      value,
    } as TextSearch);
  }
}
