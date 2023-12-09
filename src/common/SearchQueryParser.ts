import {
  ANDSearchQuery,
  DatePatternFrequency,
  DatePatternSearch,
  DistanceSearch,
  FromDateSearch,
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
  days_ago: string;
  years_ago: string;
  months_ago: string;
  weeks_ago: string;
  every_year: string;
  every_month: string;
  every_week: string;
  lastNDays: string;
  sameDay: string;
  portrait: string;
  landscape: string;
  orientation: string;
  kmFrom: string;
  maxResolution: string;
  minResolution: string;
  maxRating: string;
  minRating: string;
  maxPersonCount: string;
  minPersonCount: string;
  NSomeOf: string;
  someOf: string;
  or: string;
  and: string;
  from: string;
  to: string;
  any_text: string;
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

  maxRating: 'max-rating',
  minRating: 'min-rating',
  maxPersonCount: 'max-persons',
  minPersonCount: 'min-persons',
  maxResolution: 'max-resolution',
  minResolution: 'min-resolution',

  kmFrom: 'km-from',
  orientation: 'orientation',
  landscape: 'landscape',
  portrait: 'portrait',


  years_ago: '%d-years-ago',
  months_ago: '%d-months-ago',
  weeks_ago: '%d-weeks-ago',
  days_ago: '%d-days-ago',
  every_year: 'every-year',
  every_month: 'every-month',
  every_week: 'every-week',
  lastNDays: 'last-%d-days',
  sameDay: 'same-day',

  any_text: 'any-text',
  keyword: 'keyword',
  caption: 'caption',
  directory: 'directory',
  file_name: 'file-name',
  person: 'person',
  position: 'position',
  someOf: 'some-of',
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

  public static humanToRegexpStr(str: string) {
    return str.replace(/%d/g, '\\d*');
  }

  public parse(str: string, implicitAND = true): SearchQueryDTO {
    str = str
        .replace(/\s\s+/g, ' ') // remove double spaces
        .replace(/:\s+/g, ':')
        .trim();


    const intFromRegexp = (str: string) => {
      const numSTR = new RegExp(/\d+/).exec(str);
      if (!numSTR) {
        return 0;
      }
      return parseInt(numSTR[0], 10);
    };
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

    const addValueRangeParser = (matcher: string, type: SearchQueryTypes): RangeSearch | undefined => {
      if (kwStartsWith(str, matcher)) {
        return {
          type: type,
          value: parseInt(str.substring(str.indexOf(':') + 1), 10),
          ...(str.startsWith(matcher + '!:') && {negate: true}), // only add if the value is true
        } as RangeSearch;
      }
    };

    const range = addValueRangeParser(this.keywords.minRating, SearchQueryTypes.min_rating) ||
        addValueRangeParser(this.keywords.maxRating, SearchQueryTypes.max_rating) ||
        addValueRangeParser(this.keywords.minResolution, SearchQueryTypes.min_resolution) ||
        addValueRangeParser(this.keywords.maxResolution, SearchQueryTypes.max_resolution) ||
        addValueRangeParser(this.keywords.minPersonCount, SearchQueryTypes.min_person_count) ||
        addValueRangeParser(this.keywords.maxPersonCount, SearchQueryTypes.max_person_count);

    if (range) {
      return range;
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
        distance: intFromRegexp(str),
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


    if (kwStartsWith(str, this.keywords.sameDay) ||
        new RegExp('^' + SearchQueryParser.humanToRegexpStr(this.keywords.lastNDays) + '!?:').test(str)) {

      const freqStr = str.indexOf('!:') === -1 ? str.slice(str.indexOf(':') + 1) : str.slice(str.indexOf('!:') + 2);
      let freq: DatePatternFrequency = null;
      let ago;
      if (freqStr == this.keywords.every_week) {
        freq = DatePatternFrequency.every_week;
      } else if (freqStr == this.keywords.every_month) {
        freq = DatePatternFrequency.every_month;
      } else if (freqStr == this.keywords.every_year) {
        freq = DatePatternFrequency.every_year;
      } else if (new RegExp('^' + SearchQueryParser.humanToRegexpStr(this.keywords.days_ago) + '$').test(freqStr)) {
        freq = DatePatternFrequency.days_ago;
        ago = intFromRegexp(freqStr);
      } else if (new RegExp('^' + SearchQueryParser.humanToRegexpStr(this.keywords.weeks_ago) + '$').test(freqStr)) {
        freq = DatePatternFrequency.weeks_ago;
        ago = intFromRegexp(freqStr);
      } else if (new RegExp('^' + SearchQueryParser.humanToRegexpStr(this.keywords.months_ago) + '$').test(freqStr)) {
        freq = DatePatternFrequency.months_ago;
        ago = intFromRegexp(freqStr);
      } else if (new RegExp('^' + SearchQueryParser.humanToRegexpStr(this.keywords.years_ago) + '$').test(freqStr)) {
        freq = DatePatternFrequency.years_ago;
        ago = intFromRegexp(freqStr);
      }

      if (freq) {
        return {
          type: SearchQueryTypes.date_pattern,
          daysLength: kwStartsWith(str, this.keywords.sameDay) ? 0 : intFromRegexp(str),
          frequency: freq,
          ...((new RegExp('^' + SearchQueryParser.humanToRegexpStr(this.keywords.lastNDays) + '!:').test(str) ||
              str.startsWith(this.keywords.sameDay + '!:')) && {
            negate: true
          }),
          ...(!isNaN(ago) && {agoNumber: ago})
        } as DatePatternSearch;
      }
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
      case SearchQueryTypes.min_person_count:
        return (
            this.keywords.minPersonCount +
            colon +
            (isNaN((query as RangeSearch).value)
                ? ''
                : (query as RangeSearch).value)
        );
      case SearchQueryTypes.max_person_count:
        return (
            this.keywords.maxPersonCount +
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
      case SearchQueryTypes.orientation:
        return (
            this.keywords.orientation +
            ':' +
            ((query as OrientationSearch).landscape
                ? this.keywords.landscape
                : this.keywords.portrait)
        );
      case SearchQueryTypes.date_pattern: {
        const q = (query as DatePatternSearch);
        q.daysLength = q.daysLength || 0;
        let strBuilder = '';
        if (q.daysLength <= 0) {
          strBuilder += this.keywords.sameDay;
        } else {
          strBuilder += this.keywords.lastNDays.replace(/%d/g, q.daysLength.toString());
        }
        if (q.negate === true) {
          strBuilder += '!';
        }
        strBuilder += ':';
        switch (q.frequency) {
          case DatePatternFrequency.every_week:
            strBuilder += this.keywords.every_week;
            break;
          case DatePatternFrequency.every_month:
            strBuilder += this.keywords.every_month;
            break;
          case DatePatternFrequency.every_year:
            strBuilder += this.keywords.every_year;
            break;
          case DatePatternFrequency.days_ago:
            strBuilder += this.keywords.days_ago.replace(/%d/g, (q.agoNumber || 0).toString());
            break;
          case DatePatternFrequency.weeks_ago:
            strBuilder += this.keywords.weeks_ago.replace(/%d/g, (q.agoNumber || 0).toString());
            break;
          case DatePatternFrequency.months_ago:
            strBuilder += this.keywords.months_ago.replace(/%d/g, (q.agoNumber || 0).toString());
            break;
          case DatePatternFrequency.years_ago:
            strBuilder += this.keywords.years_ago.replace(/%d/g, (q.agoNumber || 0).toString());
            break;
        }
        return strBuilder;
      }
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
