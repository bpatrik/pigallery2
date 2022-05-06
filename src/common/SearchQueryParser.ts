import {
  ANDSearchQuery,
  DistanceSearch,
  FromDateSearch,
  MaxRatingSearch,
  MaxResolutionSearch,
  MinRatingSearch,
  MinResolutionSearch,
  NegatableSearchQuery,
  OrientationSearch,
  ORSearchQuery,
  RangeSearch,
  SearchListQuery,
  SearchQueryDTO,
  SearchQueryTypes,
  SomeOfSearchQuery,
  TextSearch,
  TextSearchQueryMatchTypes,
  TextSearchQueryTypes,
  ToDateSearch,
} from './entities/SearchQueryDTO';
import {Utils} from './Utils';

export interface QueryKeywords {
  portrait: string;
  landscape: string;
  orientation: string;
  kmFrom: string;
  maxResolution: string;
  minResolution: string;
  maxRating: string;
  minRating: string;
  NSomeOf: string;
  someOf: string;
  or: string;
  and: string;
  from: string;
  to: string;
  any_text: string;
  title: string;
  caption: string;
  directory: string;
  file_name: string;
  keyword: string;
  person: string;
  position: string;
}

export const defaultQueryKeywords: QueryKeywords = {
  NSomeOf: 'of',
  and: 'and',
  or: 'or',

  from: 'after',
  to: 'before',
  landscape: 'landscape',
  maxRating: 'max-rating',
  maxResolution: 'max-resolution',
  minRating: 'min-rating',
  minResolution: 'min-resolution',
  orientation: 'orientation',

  any_text: 'any-text',
  keyword: 'keyword',
  title: 'title',
  caption: 'caption',
  directory: 'directory',
  file_name: 'file-name',
  person: 'person',
  portrait: 'portrait',
  position: 'position',
  someOf: 'some-of',
  kmFrom: 'km-from',
};

export class SearchQueryParser {
  constructor(private keywords: QueryKeywords = defaultQueryKeywords) {
  }

  public static stringifyText(
    text: string,
    matchType = TextSearchQueryMatchTypes.like
  ): string {
    if (matchType === TextSearchQueryMatchTypes.exact_match) {
      return '"' + text + '"';
    }
    if (text.indexOf(' ') !== -1) {
      return '(' + text + ')';
    }
    return text;
  }

  public static stringifyDate(time: number): string {
    const date = new Date(time);

    // simplify date with yeah only if its first of jan
    if (date.getMonth() === 0 && date.getDate() === 1) {
      return date.getFullYear().toString();
    }
    return this.stringifyText(date.toISOString().substring(0, 10));
  }

  private static parseDate(text: string): number {
    if (text.charAt(0) === '"' || text.charAt(0) === '(') {
      text = text.substring(1);
    }
    if (
      text.charAt(text.length - 1) === '"' ||
      text.charAt(text.length - 1) === ')'
    ) {
      text = text.substring(0, text.length - 1);
    }
    // it is the year only
    if (text.length === 4) {
      return Date.UTC(parseInt(text, 10), 0, 1, 0, 0, 0, 0);
    }
    let timestamp = null;
    // Parsing ISO string
    try {
      const parts = text.split('-').map((t) => parseInt(t, 10));
      if (parts && parts.length === 2) {
        timestamp = Date.UTC(parts[0], parts[1] - 1, 1, 0, 0, 0, 0); // Note: months are 0-based
      }
      if (parts && parts.length === 3) {
        timestamp = Date.UTC(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0); // Note: months are 0-based
      }
    } catch (e) {
      // ignoring errors
    }
    // If it could not parse as ISO string, try our luck with Date.parse
    // https://stackoverflow.com/questions/2587345/why-does-date-parse-give-incorrect-results
    if (timestamp === null) {
      timestamp = Date.parse(text);
    }
    if (isNaN(timestamp) || timestamp === null) {
      throw new Error('Cannot parse date: ' + text);
    }

    return timestamp;
  }

  public parse(str: string, implicitAND = true): SearchQueryDTO {
    str = str
      .replace(/\s\s+/g, ' ') // remove double spaces
      .replace(/:\s+/g, ':')
      .trim();

    if (str.charAt(0) === '(' && str.charAt(str.length - 1) === ')') {
      str = str.slice(1, str.length - 1);
    }
    const fistSpace = (start = 0) => {
      const bracketIn = [];
      let quotationMark = false;
      for (let i = start; i < str.length; ++i) {
        if (str.charAt(i) === '"') {
          quotationMark = !quotationMark;
          continue;
        }
        if (str.charAt(i) === '(') {
          bracketIn.push(i);
          continue;
        }
        if (str.charAt(i) === ')') {
          bracketIn.pop();
          continue;
        }

        if (
          quotationMark === false &&
          bracketIn.length === 0 &&
          str.charAt(i) === ' '
        ) {
          return i;
        }
      }
      return str.length - 1;
    };

    // tokenize
    const tokenEnd = fistSpace();

    if (tokenEnd !== str.length - 1) {
      if (str.startsWith(' ' + this.keywords.and, tokenEnd)) {
        const rest = this.parse(
          str.slice(tokenEnd + (' ' + this.keywords.and).length),
          implicitAND
        );
        return {
          type: SearchQueryTypes.AND,
          list: [
            this.parse(str.slice(0, tokenEnd), implicitAND), // trim brackets
            ...(rest.type === SearchQueryTypes.AND
              ? (rest as SearchListQuery).list
              : [rest]),
          ],
        } as ANDSearchQuery;
      } else if (str.startsWith(' ' + this.keywords.or, tokenEnd)) {
        const rest = this.parse(
          str.slice(tokenEnd + (' ' + this.keywords.or).length),
          implicitAND
        );
        return {
          type: SearchQueryTypes.OR,
          list: [
            this.parse(str.slice(0, tokenEnd), implicitAND), // trim brackets
            ...(rest.type === SearchQueryTypes.OR
              ? (rest as SearchListQuery).list
              : [rest]),
          ],
        } as ORSearchQuery;
      } else {
        // Relation cannot be detected
        const t =
          implicitAND === true
            ? SearchQueryTypes.AND
            : SearchQueryTypes.UNKNOWN_RELATION;
        const rest = this.parse(str.slice(tokenEnd), implicitAND);
        return {
          type: t,
          list: [
            this.parse(str.slice(0, tokenEnd), implicitAND), // trim brackets
            ...(rest.type === t ? (rest as SearchListQuery).list : [rest]),
          ],
        } as SearchListQuery;
      }
    }
    if (
      str.startsWith(this.keywords.someOf + ':') ||
      new RegExp('^\\d*-' + this.keywords.NSomeOf + ':').test(str)
    ) {
      const prefix = str.startsWith(this.keywords.someOf + ':')
        ? this.keywords.someOf + ':'
        : new RegExp('^\\d*-' + this.keywords.NSomeOf + ':').exec(str)[0];
      let tmpList: SearchQueryDTO | SearchQueryDTO[] = this.parse(str.slice(prefix.length + 1, -1), false); // trim brackets

      const unfoldList = (q: SearchListQuery): SearchQueryDTO[] => {
        if (q.list) {
          if (q.type === SearchQueryTypes.UNKNOWN_RELATION) {
            return q.list.map((e) => unfoldList(e as SearchListQuery)).flat();  // flatten array
          } else {
            q.list.forEach((e) => unfoldList(e as SearchListQuery));
          }
        }
        return [q];
      };
      tmpList = unfoldList(tmpList as SearchListQuery);
      const ret = {
        type: SearchQueryTypes.SOME_OF,
        list: tmpList,
      } as SomeOfSearchQuery;
      if (new RegExp('^\\d*-' + this.keywords.NSomeOf + ':').test(str)) {
        ret.min = parseInt(new RegExp(/^\d*/).exec(str)[0], 10);
      }
      return ret;
    }

    const kwStartsWith = (s: string, kw: string): boolean => {
      return s.startsWith(kw + ':') || s.startsWith(kw + '!:');
    };

    if (kwStartsWith(str, this.keywords.from)) {
      return {
        type: SearchQueryTypes.from_date,
        value: SearchQueryParser.parseDate(str.substring(str.indexOf(':') + 1)),
        ...(str.startsWith(this.keywords.from + '!:') && {negate: true}), // only add if the value is true
      } as FromDateSearch;
    }
    if (kwStartsWith(str, this.keywords.to)) {
      return {
        type: SearchQueryTypes.to_date,
        value: SearchQueryParser.parseDate(str.substring(str.indexOf(':') + 1)),
        ...(str.startsWith(this.keywords.to + '!:') && {negate: true}), // only add if the value is true
      } as ToDateSearch;
    }

    if (kwStartsWith(str, this.keywords.minRating)) {
      return {
        type: SearchQueryTypes.min_rating,
        value: parseInt(str.substring(str.indexOf(':') + 1), 10),
        ...(str.startsWith(this.keywords.minRating + '!:') && {negate: true}), // only add if the value is true
      } as MinRatingSearch;
    }
    if (kwStartsWith(str, this.keywords.maxRating)) {
      return {
        type: SearchQueryTypes.max_rating,
        value: parseInt(str.substring(str.indexOf(':') + 1), 10),
        ...(str.startsWith(this.keywords.maxRating + '!:') && {negate: true}), // only add if the value is true
      } as MaxRatingSearch;
    }
    if (kwStartsWith(str, this.keywords.minResolution)) {
      return {
        type: SearchQueryTypes.min_resolution,
        value: parseInt(str.substring(str.indexOf(':') + 1), 10),
        ...(str.startsWith(this.keywords.minResolution + '!:') && {
          negate: true,
        }), // only add if the value is true
      } as MinResolutionSearch;
    }
    if (kwStartsWith(str, this.keywords.maxResolution)) {
      return {
        type: SearchQueryTypes.max_resolution,
        value: parseInt(str.substring(str.indexOf(':') + 1), 10),
        ...(str.startsWith(this.keywords.maxResolution + '!:') && {
          negate: true,
        }), // only add if the value is true
      } as MaxResolutionSearch;
    }
    if (new RegExp('^\\d*-' + this.keywords.kmFrom + '!?:').test(str)) {
      let from = str.slice(
        new RegExp('^\\d*-' + this.keywords.kmFrom + '!?:').exec(str)[0].length
      );
      if (
        (from.charAt(0) === '(' && from.charAt(from.length - 1) === ')') ||
        (from.charAt(0) === '"' && from.charAt(from.length - 1) === '"')
      ) {
        from = from.slice(1, from.length - 1);
      }
      return {
        type: SearchQueryTypes.distance,
        distance: parseInt(new RegExp(/^\d*/).exec(str)[0], 10),
        from: {text: from},
        ...(new RegExp('^\\d*-' + this.keywords.kmFrom + '!:').test(str) && {
          negate: true,
        }), // only add if the value is true
      } as DistanceSearch;
    }

    if (str.startsWith(this.keywords.orientation + ':')) {
      return {
        type: SearchQueryTypes.orientation,
        landscape:
          str.slice((this.keywords.orientation + ':').length) ===
          this.keywords.landscape,
      } as OrientationSearch;
    }

    // parse text search
    const tmp = TextSearchQueryTypes.map((type) => ({
      key: (this.keywords as any)[SearchQueryTypes[type]] + ':',
      queryTemplate: {type, text: ''} as TextSearch,
    })).concat(
      TextSearchQueryTypes.map((type) => ({
        key: (this.keywords as any)[SearchQueryTypes[type]] + '!:',
        queryTemplate: {type, text: '', negate: true} as TextSearch,
      }))
    );
    for (const typeTmp of tmp) {
      if (str.startsWith(typeTmp.key)) {
        const ret: TextSearch = Utils.clone(typeTmp.queryTemplate);
        // exact match
        if (
          str.charAt(typeTmp.key.length) === '"' &&
          str.charAt(str.length - 1) === '"'
        ) {
          ret.text = str.slice(typeTmp.key.length + 1, str.length - 1);
          ret.matchType = TextSearchQueryMatchTypes.exact_match;
          // like match
        } else if (
          str.charAt(typeTmp.key.length) === '(' &&
          str.charAt(str.length - 1) === ')'
        ) {
          ret.text = str.slice(typeTmp.key.length + 1, str.length - 1);
        } else {
          ret.text = str.slice(typeTmp.key.length);
        }
        return ret;
      }
    }

    return {type: SearchQueryTypes.any_text, text: str} as TextSearch;
  }

  public stringify(query: SearchQueryDTO): string {
    const ret = this.stringifyOnEntry(query);
    if (ret.charAt(0) === '(' && ret.charAt(ret.length - 1) === ')') {
      return ret.slice(1, ret.length - 1);
    }
    return ret;
  }

  private stringifyOnEntry(query: SearchQueryDTO): string {
    if (!query || !query.type) {
      return '';
    }
    const colon = (query as NegatableSearchQuery).negate === true ? '!:' : ':';
    switch (query.type) {
      case SearchQueryTypes.AND:
        return (
          '(' +
          (query as SearchListQuery).list
            .map((q) => this.stringifyOnEntry(q))
            .join(' ' + this.keywords.and + ' ') +
          ')'
        );

      case SearchQueryTypes.OR:
        return (
          '(' +
          (query as SearchListQuery).list
            .map((q) => this.stringifyOnEntry(q))
            .join(' ' + this.keywords.or + ' ') +
          ')'
        );

      case SearchQueryTypes.SOME_OF:
        if ((query as SomeOfSearchQuery).min) {
          return (
            (query as SomeOfSearchQuery).min +
            '-' +
            this.keywords.NSomeOf +
            ':(' +
            (query as SearchListQuery).list
              .map((q) => this.stringifyOnEntry(q))
              .join(' ') +
            ')'
          );
        }
        return (
          this.keywords.someOf +
          ':(' +
          (query as SearchListQuery).list
            .map((q) => this.stringifyOnEntry(q))
            .join(' ') +
          ')'
        );

      case SearchQueryTypes.orientation:
        return (
          this.keywords.orientation +
          ':' +
          ((query as OrientationSearch).landscape
            ? this.keywords.landscape
            : this.keywords.portrait)
        );

      case SearchQueryTypes.from_date:
        if (!(query as FromDateSearch).value) {
          return '';
        }
        return (
          this.keywords.from +
          colon +
          SearchQueryParser.stringifyDate((query as FromDateSearch).value)
        );
      case SearchQueryTypes.to_date:
        if (!(query as ToDateSearch).value) {
          return '';
        }
        return (
          this.keywords.to +
          colon +
          SearchQueryParser.stringifyDate((query as ToDateSearch).value)
        );
      case SearchQueryTypes.min_rating:
        return (
          this.keywords.minRating +
          colon +
          (isNaN((query as RangeSearch).value)
            ? ''
            : (query as RangeSearch).value)
        );
      case SearchQueryTypes.max_rating:
        return (
          this.keywords.maxRating +
          colon +
          (isNaN((query as RangeSearch).value)
            ? ''
            : (query as RangeSearch).value)
        );
      case SearchQueryTypes.min_resolution:
        return (
          this.keywords.minResolution +
          colon +
          (isNaN((query as RangeSearch).value)
            ? ''
            : (query as RangeSearch).value)
        );
      case SearchQueryTypes.max_resolution:
        return (
          this.keywords.maxResolution +
          colon +
          (isNaN((query as RangeSearch).value)
            ? ''
            : (query as RangeSearch).value)
        );
      case SearchQueryTypes.distance:
        if ((query as DistanceSearch).from.text.indexOf(' ') !== -1) {
          return (
            (query as DistanceSearch).distance +
            '-' +
            this.keywords.kmFrom +
            colon +
            '(' +
            (query as DistanceSearch).from.text +
            ')'
          );
        }
        return (
          (query as DistanceSearch).distance +
          '-' +
          this.keywords.kmFrom +
          colon +
          (query as DistanceSearch).from.text
        );

      case SearchQueryTypes.any_text:
        if (!(query as TextSearch).negate) {
          return SearchQueryParser.stringifyText(
            (query as TextSearch).text,
            (query as TextSearch).matchType
          );
        } else {
          return (
            (this.keywords as any)[SearchQueryTypes[query.type]] +
            colon +
            SearchQueryParser.stringifyText(
              (query as TextSearch).text,
              (query as TextSearch).matchType
            )
          );
        }

      case SearchQueryTypes.person:
      case SearchQueryTypes.position:
      case SearchQueryTypes.keyword:
      case SearchQueryTypes.title:
      case SearchQueryTypes.caption:
      case SearchQueryTypes.file_name:
      case SearchQueryTypes.directory:
        if (!(query as TextSearch).text) {
          return '';
        }
        return (
          (this.keywords as any)[SearchQueryTypes[query.type]] +
          colon +
          SearchQueryParser.stringifyText(
            (query as TextSearch).text,
            (query as TextSearch).matchType
          )
        );

      default:
        throw new Error('Unknown type: ' + query.type);
    }
  }
}
