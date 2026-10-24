import {TextSearch, TextSearchQueryMatchTypes} from '../../../../../../common/entities/SearchQueryDTO';

/**
 * The match type notation of text searches (match type + negate) as shown in the query builder.
 */
export class TextSearchMatchingTypes {
  public static readonly values = ['~', '!~', '=', '!=', 'glob', '!glob'];

  public static get(query: TextSearch): string {
    if (query.matchType === TextSearchQueryMatchTypes.exact_match) {
      if (query.negate) {
        return '!=';
      } else {
        return '=';
      }
    } else if (typeof query.matchType === 'undefined' ||
      query.matchType === TextSearchQueryMatchTypes.like) {
      if (query.negate) {
        return '!~';
      } else {
        return '~';
      }
    } else if (query.matchType === TextSearchQueryMatchTypes.globMatch) {
      if (query.negate) {
        return '!glob';
      } else {
        return 'glob';
      }
    }
  }

  public static set(query: TextSearch, value: string): void {
    query.negate = value.charAt(0) === '!';
    if (value === '!~' || value === '~') {
      query.matchType = TextSearchQueryMatchTypes.like;
    } else if (value === '!=' || value === '=') {
      query.matchType = TextSearchQueryMatchTypes.exact_match;
    } else if (value === '!glob' || value === 'glob') {
      query.matchType = TextSearchQueryMatchTypes.globMatch;
    }
  }

  public static getDescription(type: string, isTextQuery = true): string {
    switch (type) {
      case '=':
        if (isTextQuery) {
          return $localize`Exact match (e.g.: bb matches for \' bb \')`;
        }
        return $localize`Exact match`;
      case '!=':
        return $localize`Exact negative match`;
      // only supported for text queries
      case '~':
        return $localize`Open and start match (e.g.: bb matches for \'abba\' and \' bb \')`;
      case '!~':
        return $localize`Negative open and start  match`;
      case 'glob':
        return $localize`glob match (supports wildcards: * and ?)`;
      case '!glob':
        return $localize`Negative glob match`;
    }
  }
}
