import {
  NegatableSearchQuery,
  OrientationSearch,
  RangeSearchQueryTypes,
  SearchListQuery,
  SearchQueryDTO,
  SearchQueryTypes,
  SomeOfSearchQuery,
  TextSearch,
  TextSearchQueryMatchTypes,
  TextSearchQueryTypes
} from './entities/SearchQueryDTO';
import {SearchQueryParser} from './SearchQueryParser';
import {Utils} from './Utils';

export const SearchQueryUtils = {
  negate: (query: SearchQueryDTO): SearchQueryDTO => {
    query = Utils.clone(query);
    switch (query.type) {
      case SearchQueryTypes.AND:
        query.type = SearchQueryTypes.OR;
        (query as SearchListQuery).list = (query as SearchListQuery).list.map(
          (q) => SearchQueryUtils.negate(q)
        );
        return query;
      case SearchQueryTypes.OR:
        query.type = SearchQueryTypes.AND;
        (query as SearchListQuery).list = (query as SearchListQuery).list.map(
          (q) => SearchQueryUtils.negate(q)
        );
        return query;
      case SearchQueryTypes.orientation:
        (query as OrientationSearch).landscape = !(query as OrientationSearch).landscape;
        return query;
      case SearchQueryTypes.date:
      case SearchQueryTypes.rating:
      case SearchQueryTypes.resolution:
      case SearchQueryTypes.person_count:
      case SearchQueryTypes.distance:
      case SearchQueryTypes.any_text:
      case SearchQueryTypes.person:
      case SearchQueryTypes.position:
      case SearchQueryTypes.keyword:
      case SearchQueryTypes.caption:
      case SearchQueryTypes.file_name:
      case SearchQueryTypes.directory:
        (query as NegatableSearchQuery).negate = !(query as NegatableSearchQuery).negate;
        return query;
      case SearchQueryTypes.SOME_OF:
        throw new Error('Some of not supported');
      default:
        throw new Error('Unknown type' + (query).type);
    }
  },
  sortQuery(queryIN: SearchQueryDTO): SearchQueryDTO {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const canonicalize = (value: any): any => {
      if (Array.isArray(value)) {
        return value.map((v) => canonicalize(v));
      }
      if (value && typeof value === 'object') {
        const out: Record<string, unknown> = {};
        const keys = Object.keys(value).sort();
        for (const k of keys) {
          const v = canonicalize(value[k]);
          if (v !== undefined) {
            out[k] = v;
          }
        }
        return out;
      }
      return value;
    };

    if (!queryIN || (queryIN).type === undefined) {
      return queryIN;
    }
    if (
      queryIN.type === SearchQueryTypes.AND ||
      queryIN.type === SearchQueryTypes.OR ||
      queryIN.type === SearchQueryTypes.SOME_OF
    ) {
      const ql = queryIN as SearchListQuery;
      const children = (ql.list || []).map((c) => SearchQueryUtils.sortQuery(c));
      const withKeys = children.map((c) => ({key: JSON.stringify(c), value: c}));
      withKeys.sort((a, b) => a.key.localeCompare(b.key));
      if (queryIN.type === SearchQueryTypes.SOME_OF) {
        const so = queryIN as SomeOfSearchQuery;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const res: any = {type: queryIN.type};
        if (so.min !== undefined) {
          res.min = so.min;
        }
        res.list = withKeys.map((kv) => kv.value);
        return canonicalize(res) as SearchQueryDTO;
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const res: any = {type: queryIN.type};
        res.list = withKeys.map((kv) => kv.value);
        return canonicalize(res) as SearchQueryDTO;
      }
    }
    return canonicalize(queryIN) as SearchQueryDTO;
  },
  stringifyForComparison(queryIN: SearchQueryDTO): string {
    return JSON.stringify(SearchQueryUtils.sortQuery(queryIN));
  },
  isQueryEmpty(query: SearchQueryDTO): boolean {
    return !query ||
      query.type === undefined ||
      (query.type === SearchQueryTypes.any_text && !(query as TextSearch).value);
  },
  // Recursively strip negate:false and matchType:like so that optional/default flags do not break validation
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  stripDefault: (val: any): any => {
    if (Array.isArray(val)) {
      return val.map((v) => SearchQueryUtils.stripDefault(v));
    }
    if (val && typeof val === 'object') {
      const out: Record<string, unknown> = {};
      for (const k of Object.keys(val)) {
        const v = SearchQueryUtils.stripDefault(val[k]);
        if (k === 'negate' && v === false) {
          // drop negate:false
          continue;
        }
        if (k === 'matchType' && v === TextSearchQueryMatchTypes.like) {
          // drop matchType:like (this is the default)
          continue;
        }
        // keep everything else, including negate:true and undefined-handled by equalsFilter
        out[k] = v;
      }
      return out;
    }
    return val;
  },
  validateSearchQuery: (query: SearchQueryDTO, what = 'SearchQuery'): void => {
    if (!query) {
      return;
    }


    const sp = new SearchQueryParser();
    try {
      const parsed = sp.parse(sp.stringify(query));
      const normParsed = SearchQueryUtils.stripDefault(parsed) as SearchQueryDTO;
      const normQuery = SearchQueryUtils.stripDefault(query) as SearchQueryDTO;
      if (!Utils.equalsFilter(normParsed, normQuery) || !Utils.equalsFilter(normQuery, normParsed)) {
        throw new Error(
          `${what} is not valid. Expected: ${JSON.stringify(parsed)} to equal: ${JSON.stringify(query)}`
        );
      }
    } catch (e) {
      if (e && (e as Error).message && (e as Error).message.startsWith(what)) {
        throw e;
      }
      throw new Error(`${what} is not valid. ${(e as Error)?.message ?? e}`);
    }
  },
  URLMap: {
    type: 't',
    list: 'l',
    negate: 'n',
    matchType: 'mt',
    distance: 'd',
    from: 'f',
    value: 'v',
    min: 'm',
    max: 'x',
    landscape: 'ls',
    daysLength: 'dl',
    frequency: 'fq',
    agoNumber: 'an',
    GPSData: 'g',
    latitude: 'lat',
    longitude: 'lng',
  } as Record<string, string>,
  /**
   * Make the SearchQuery URL friendly and shorter
   * @param query
   */
  urlify: (query: SearchQueryDTO): string => {
    if (!query) {
      return '';
    }
    query=SearchQueryUtils.stripDefault(query);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const shorten = (obj: any): any => {
      if (Array.isArray(obj)) {
        return obj.map(shorten);
      }
      if (obj && typeof obj === 'object') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const res: any = {};
        for (const key of Object.keys(obj)) {
          if (key === 'negate' && obj[key] === false) {
            continue;
          }
          res[SearchQueryUtils.URLMap[key] || key] = shorten(obj[key]);
        }
        return res;
      }
      return obj;
    };

    return JSON.stringify(shorten(query));
  },
  /**
   * Pareses the shortened urls and returns with the original SearchQueryDTO
   * @param urlQuery
   */
  parseURLifiedQuery: (urlQuery: string): SearchQueryDTO => {
    if (!urlQuery || urlQuery === '') {
      return null;
    }

    const map: Record<string, string> = {};
    Object.keys(SearchQueryUtils.URLMap).forEach(key => {
      map[SearchQueryUtils.URLMap[key]] = key;
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const unshorten = (obj: any): any => {
      if (Array.isArray(obj)) {
        return obj.map(unshorten);
      }
      if (obj && typeof obj === 'object') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const res: any = {};
        for (const key of Object.keys(obj)) {
          let unshortenedKey = map[key] || key;
          if (unshortenedKey === 'text' && obj.t !== undefined && !TextSearchQueryTypes.includes(obj.t)) {
            // If it's not a text search, 'v' should map to 'value'
            if (RangeSearchQueryTypes.includes(obj.t)) {
              unshortenedKey = 'value';
            }
          }
          res[unshortenedKey] = unshorten(obj[key]);
        }
        return res;
      }
      return obj;
    };

    return unshorten(JSON.parse(urlQuery));


  }
};

