import {
  ANDSearchQuery,
  DatePatternFrequency,
  DatePatternSearch,
  DistanceSearch,
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
  resolution: string;
  rating: string;
  personCount: string;
  NSomeOf: string;
  someOf: string;
  or: string;
  and: string;
  date: string;
  any_text: string;
  caption: string;
  directory: string;
  file_name: string;
  keyword: string;
  person: string;
  position: string;
  title: string;
}

export const defaultQueryKeywords: QueryKeywords = {
  NSomeOf: 'of',
  and: 'and',
  or: 'or',

  date: 'date',

  rating: 'rating',
  personCount: 'person-count',
  resolution: 'resolution',

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
  title: 'title',
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
    if (matchType === TextSearchQueryMatchTypes.globMatch) {
      if (text.indexOf(' ') !== -1) {
        return '"' + text + '"';
      }
      return text;
    }
    if (text.indexOf(' ') !== -1) {
      return '(' + text + ')';
    }
    return text;
  }

  public static stringifyDate(time: number): string {
    if (!time) {
      return null;
    }
    const date = new Date(time);

    // simplify date with yeah only if its first of jan
    if (date.getMonth() === 0 && date.getDate() === 1) {
      return date.getFullYear().toString();
    }
    return this.stringifyText(date.toISOString().substring(0, 10));
  }

  public static humanToRegexpStr(str: string) {
    return str.replace(/%d/g, '\\d*');
  }

  /**
   * Returns the number of milliseconds between midnight, January 1, 1970 Universal Coordinated Time (UTC) (or GMT) and the specified date.
   * @param text
   * @private
   */
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
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

    const addValueRangeParser = (matcher: string, type: SearchQueryTypes): RangeSearch => {


      const value =
        matcher === 'date'
          ? '(\\d{4}(?:-\\d{1,2})?(?:-\\d{1,2})?)' // YYYY-MM or YYYY-MM-DD
          : '(\\d+)';                     // number
      /**
       * Matching:
       * rating:4..6
       * rating:4
       * rating=4
       * rating!>3
       * rating>3
       * rating!>=3
       * rating>=3
       * rating!<3
       * rating<3
       * rating!<=3
       * rating<=3
       */
      const regex = new RegExp(
        `^${matcher}(!?[:=]|!?[<>]=?)${value}(?:\\.\\.${value})?$`
      );

      const m = str.match(regex);
      if (!m) {
        return null;
      }

      let relation = m[1];
      const rawA = m[2];
      const rawB = m[3];

      const toValue =
        matcher === this.keywords.date
          ? (v: string) => SearchQueryParser.parseDate(v)
          : (v: string) => Number(v);

      const addValue =
        matcher === this.keywords.date
          ? (v: number, a: number) => v + a * 24 * 60 * 60 * 1000
          : (v: number, a: number) => v + a;


      const a = toValue(rawA);
      const b = rawB !== undefined ? toValue(rawB) : undefined;

      let negate = false;
      if (relation.startsWith('!')) {
        negate = true;
        relation = relation.slice(1);
      }
      const base =
        relation === '='
          ? {type, min: a, max: a}
          : relation === ':'
            ? b === undefined
              ? {type, min: a, max: a}
              : {type, min: a, max: b}
            : relation === '>='
              ? {type, min: a}
              : relation === '>'
                ? {type, min: addValue(a, 1)}
                : relation === '<='
                  ? {type, max: a}
                  : relation === '<'
                    ? {type, max: addValue(a, -1)}
                    : null;

      if (!base) {
        return null;
      }

      return negate ? {...base, negate: true} : base;

    };


    const range =
      addValueRangeParser(this.keywords.rating, SearchQueryTypes.rating) ||
      addValueRangeParser(this.keywords.personCount, SearchQueryTypes.person_count) ||
      addValueRangeParser(this.keywords.date, SearchQueryTypes.date) ||
      addValueRangeParser(this.keywords.resolution, SearchQueryTypes.resolution);

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

      // Check if the from part matches coordinate pattern (number, number)
      const coordMatch = from.match(/^\s*(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)\s*$/);
      if (coordMatch) {
        // It's a coordinate pair
        const latitude = parseFloat(coordMatch[1]);
        const longitude = parseFloat(coordMatch[2]);
        return {
          type: SearchQueryTypes.distance,
          distance: intFromRegexp(str),
          from: {
            GPSData: {
              latitude,
              longitude
            }
          },
          // only add negate if the value is true
          ...(new RegExp('^\\d*-' + this.keywords.kmFrom + '!:').test(str) && {
            negate: true,
          }),
        } as DistanceSearch;
      }

      // If not coordinates, treat as location text
      return {
        type: SearchQueryTypes.distance,
        distance: intFromRegexp(str),
        from: {value: from},
        // only add negate if the value is true
        ...(new RegExp('^\\d*-' + this.keywords.kmFrom + '!:').test(str) && {
          negate: true,
        }),
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
      key: (this.keywords as never)[SearchQueryTypes[type]] + ':',
      queryTemplate: {type, value: ''} as TextSearch,
    })).concat(
      TextSearchQueryTypes.map((type) => ({
        key: (this.keywords as never)[SearchQueryTypes[type]] + '!:',
        queryTemplate: {type, value: '', negate: true} as TextSearch,
      }))
    ).concat(
      TextSearchQueryTypes.map((type) => ({
        key: (this.keywords as never)[SearchQueryTypes[type]] + '~:',
        queryTemplate: {type, value: '', matchType: TextSearchQueryMatchTypes.globMatch} as TextSearch,
      }))
    ).concat(
      TextSearchQueryTypes.map((type) => ({
        key: (this.keywords as never)[SearchQueryTypes[type]] + '!~:',
        queryTemplate: {type, value: '', negate: true, matchType: TextSearchQueryMatchTypes.globMatch} as TextSearch,
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
          ret.value = str.slice(typeTmp.key.length + 1, str.length - 1);
          if (ret.matchType !== TextSearchQueryMatchTypes.globMatch) {
            ret.matchType = TextSearchQueryMatchTypes.exact_match;
          }
          // like match
        } else if (
          str.charAt(typeTmp.key.length) === '(' &&
          str.charAt(str.length - 1) === ')'
        ) {
          if (ret.matchType === TextSearchQueryMatchTypes.globMatch) {
            throw new Error('Parentheses groups are not supported for globMatch');
          }
          ret.value = str.slice(typeTmp.key.length + 1, str.length - 1);
        } else {
          ret.value = str.slice(typeTmp.key.length);
        }
        return ret;
      }
    }

    return {type: SearchQueryTypes.any_text, value: str} as TextSearch;
  }

  public stringify(query: SearchQueryDTO): string {
    const ret = this.stringifyOneEntry(query);
    if (ret.charAt(0) === '(' && ret.charAt(ret.length - 1) === ')') {
      return ret.slice(1, ret.length - 1);
    }
    return ret;
  }

  private stringifyOneEntry(query: SearchQueryDTO): string {
    if (!query || !query.type) {
      return '';
    }
    const negateSign = (query as NegatableSearchQuery).negate === true ? '!' : '';
    const colon = negateSign + ':';
    const isGlob = TextSearchQueryTypes.includes(query.type) && (query as TextSearch).matchType === TextSearchQueryMatchTypes.globMatch;
    const op = negateSign + (isGlob ? '~:' : ':');
    switch (query.type) {
      case SearchQueryTypes.AND:
        return (
          '(' +
          (query as SearchListQuery).list
            .map((q) => this.stringifyOneEntry(q))
            .join(' ' + this.keywords.and + ' ') +
          ')'
        );

      case SearchQueryTypes.OR:
        return (
          '(' +
          (query as SearchListQuery).list
            .map((q) => this.stringifyOneEntry(q))
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
              .map((q) => this.stringifyOneEntry(q))
              .join(' ') +
            ')'
          );
        }
        return (
          this.keywords.someOf +
          ':(' +
          (query as SearchListQuery).list
            .map((q) => this.stringifyOneEntry(q))
            .join(' ') +
          ')'
        );


      case SearchQueryTypes.date:
      case SearchQueryTypes.rating:
      case SearchQueryTypes.resolution:
      case SearchQueryTypes.person_count: {
        const dq = query as unknown as RangeSearch;
        let kw = this.keywords.date;
        if (dq.type == SearchQueryTypes.rating) {
          kw = this.keywords.rating;
        }
        if (dq.type == SearchQueryTypes.resolution) {
          kw = this.keywords.resolution;
        }
        if (dq.type == SearchQueryTypes.person_count) {
          kw = this.keywords.personCount;
        }
        let minStr = '' + dq.min;
        let maxStr = '' + dq.max;
        if (dq.type == SearchQueryTypes.date) {
          minStr = SearchQueryParser.stringifyDate(dq.min);
          maxStr = SearchQueryParser.stringifyDate(dq.max);
        }

        if (isNaN(dq.min) && isNaN(dq.max)) {
          return '';
        }
        if (dq.min == dq.max) {
          return (
            kw +
            negateSign +
            '=' +
            minStr
          );
        } else if (!isNaN(dq.min) && !isNaN(dq.max)) {
          return (
            kw +
            negateSign +
            ':' +
            minStr +
            '..' +
            maxStr
          );
        } else if (!isNaN(dq.min)) {
          return (
            kw +
            negateSign +
            '>=' +
            minStr);
        }
        return (
          kw +
          negateSign +
          '<=' +
          maxStr);
      }

      case SearchQueryTypes.distance: {
        const distanceQuery = query as DistanceSearch;
        const value = distanceQuery.from.value;
        const coords = distanceQuery.from.GPSData;

        let locationStr = '';
        if (value) {
          // If we have location text, use that
          locationStr = value;
        } else if (coords && coords.latitude != null && coords.longitude != null) {
          // If we only have coordinates, use them
          locationStr = `${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`;
        }

        // Add brackets if the location string contains spaces
        if (locationStr.indexOf(' ') !== -1) {
          locationStr = `(${locationStr})`;
        }

        return `${distanceQuery.distance}-${this.keywords.kmFrom}${colon}${locationStr}`;
      }

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
        if (!(query as TextSearch).negate &&
          (typeof (query as TextSearch).matchType === 'undefined' ||
            (query as TextSearch).matchType === TextSearchQueryMatchTypes.like) &&
          !/\s/.test((query as TextSearch).value)) {
          return SearchQueryParser.stringifyText(
            (query as TextSearch).value,
            (query as TextSearch).matchType
          );
        } else {
          return (
            (this.keywords as never)[SearchQueryTypes[query.type]] +
            op +
            SearchQueryParser.stringifyText(
              (query as TextSearch).value,
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
      case SearchQueryTypes.title:
        if (!(query as TextSearch).value) {
          return '';
        }
        return (
          (this.keywords as never)[SearchQueryTypes[query.type]] +
          op +
          SearchQueryParser.stringifyText(
            (query as TextSearch).value,
            (query as TextSearch).matchType
          )
        );

      default:
        throw new Error('Unknown type: ' + query.type);
    }
  }
}
