import {
  DirectorySearch,
  ListSearchQueryTypes,
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
import {foldChar} from './TextFold';

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
    const canonicalize = (value: unknown): unknown => {
      if (Array.isArray(value)) {
        return value.map((v: unknown) => canonicalize(v));
      }
      if (value && typeof value === 'object') {
        const obj = value as Record<string, unknown>;
        const out: Record<string, unknown> = {};
        const keys = Object.keys(obj).sort();
        for (const k of keys) {
          const v = canonicalize(obj[k]);
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
        const res: Record<string, unknown> = {type: queryIN.type};
        if (so.min !== undefined) {
          res['min'] = so.min;
        }
        res['list'] = withKeys.map((kv) => kv.value);
        return canonicalize(res) as SearchQueryDTO;
      } else {
        const res: Record<string, unknown> = {type: queryIN.type};
        res['list'] = withKeys.map((kv) => kv.value);
        return canonicalize(res) as SearchQueryDTO;
      }
    }
    return canonicalize(queryIN) as SearchQueryDTO;
  },
  stringifyForComparison(queryIN: SearchQueryDTO): string {
    return JSON.stringify(SearchQueryUtils.sortQuery(queryIN));
  },
  isQueryEmpty(query: SearchQueryDTO | null | undefined): boolean {
    return !query ||
      query.type === undefined ||
      (query.type === SearchQueryTypes.any_text && !(query as TextSearch).value);
  },
  // Recursively strip negate:false and matchType:like so that optional/default flags do not break validation
  stripDefault: <T>(val: T): T => {
    if (Array.isArray(val)) {
      return val.map((v: unknown) => SearchQueryUtils.stripDefault(v)) as T;
    }
    if (val && typeof val === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, value] of Object.entries(val as Record<string, unknown>)) {
        const v = SearchQueryUtils.stripDefault(value);
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
      return out as T;
    }
    return val;
  },
  /**
   * False if a part of the query has a type that this version does not know, e.g. a hand-edited or outdated search link.
   */
  isKnownQuery: (query: SearchQueryDTO): boolean => {
    if (!query || typeof query !== 'object' || query.type === SearchQueryTypes.UNKNOWN_RELATION ||
      !Object.values(SearchQueryTypes).includes(query.type)) {
      return false;
    }
    if (ListSearchQueryTypes.includes(query.type)) {
      const list = (query as SearchListQuery).list;
      return Array.isArray(list) && list.every(SearchQueryUtils.isKnownQuery);
    }
    return true;
  },
  validateSearchQuery: (query: SearchQueryDTO, what = 'SearchQuery'): void => {
    if (!query) {
      return;
    }


    const sp = new SearchQueryParser();
    try {
      const parsed = sp.parse(sp.stringify(query));
      const normParsed = SearchQueryUtils.stripDefault(parsed);
      const normQuery = SearchQueryUtils.stripDefault(query);
      if (!Utils.equalsFilter(normParsed, normQuery) || !Utils.equalsFilter(normQuery, normParsed)) {
        throw new Error(
          `${what} is set to '${sp.stringify(query)}' and it is not valid. It fails on this validation test: Expected: ${JSON.stringify(parsed)} to equal: ${JSON.stringify(query)}`
        );
      }
    } catch (e) {
      if (e && (e as Error).message && (e as Error).message.startsWith(what)) {
        throw e;
      }
      throw new Error(`${what} is not valid. ${(e as Error)?.message ?? e}`, {cause: e});
    }
  },
  /**
   * Validates a directory allow / block list.
   * Every entry has to be a directory TextSearch (type: SearchQueryTypes.directory).
   */
  validateDirectoryList: (list: DirectorySearch[] | null | undefined, what = 'Directory list'): void => {
    if (list === null || typeof list === 'undefined') {
      return;
    }
    if (!Array.isArray(list)) {
      throw new Error(`${what} is not valid. It should be an array of directory searches. Got: ${JSON.stringify(list)}`);
    }
    for (const d of list) {
      SearchQueryUtils.validateDirectorySearch(d, what);
    }
  },
  /**
   * Validates that the query is a single directory TextSearch (type: SearchQueryTypes.directory).
   */
  validateDirectorySearch: (d: DirectorySearch, what = 'Directory search'): void => {
    if (!d || d.type !== SearchQueryTypes.directory) {
      throw new Error(`${what} is not valid. Only directory searches are allowed. Got: ${JSON.stringify(d)}`);
    }
    if (typeof d.value !== 'string' || d.value.trim() === '') {
      throw new Error(`${what} is not valid. Directory search needs a non empty value. Got: ${JSON.stringify(d)}`);
    }
    if (typeof d.matchType !== 'undefined' && d.matchType !== null &&
      !Object.values(TextSearchQueryMatchTypes).includes(d.matchType)) {
      throw new Error(`${what} is not valid. Unknown match type: ${JSON.stringify(d)}`);
    }
    if (typeof d.negate !== 'undefined' && d.negate !== null && typeof d.negate !== 'boolean') {
      throw new Error(`${what} is not valid. negate should be boolean: ${JSON.stringify(d)}`);
    }
  },
  /**
   * Normalizes a relative directory path for matching:
   * '/' separators, no leading './' or '/', no trailing '/'. Root is ''.
   */
  normalizeDirectoryPath: (dirPath: string): string => {
    const parts = (dirPath || '').replace(/\\/g, '/').split('/')
      .filter(p => p !== '' && p !== '.');
    return parts.join('/');
  },
  /**
   * The directory path as the directory searches compare it: normalized, lower case and with runs of spaces collapsed
   * (the SQL search collapses them too, see SearchManager; a double space in a name is usually a typo #1309).
   * @param foldAccents also removes the accents, where the SQL search ignores them (see SearchManager.ignoresAccents)
   */
  comparableDirectoryPath: (dirPath: string, foldAccents = false): string => {
    const p = SearchQueryUtils.normalizeDirectoryPath(dirPath).toLowerCase().replace(/ {2,}/g, ' ');
    return foldAccents ? p.replace(/\P{ASCII}/gu, foldChar) : p;
  },
  /**
   * Matches a relative directory path against a directory search, without any DB access.
   * It follows the semantic of the SQL directory search (see SearchManager):
   *  - exact_match: the path equals to the value
   *  - like (default): the path contains the value
   *  - globMatch: the whole path matches the glob (* matches any characters, including '/', ? matches one character)
   *    A trailing '/*' means the directory itself and everything below it (e.g.: 'a/*' matches 'a', 'a/b', 'a/b/c').
   *    Use '/?*' to match only below a directory.
   * Matching is case-insensitive, and ignores the accents with foldAccents.
   */
  matchDirectorySearch: (dirPath: string, search: DirectorySearch, foldAccents = false): boolean => {
    const p = SearchQueryUtils.comparableDirectoryPath(dirPath, foldAccents);
    const value = SearchQueryUtils.comparableDirectoryPath(search.value, foldAccents);
    let match: boolean;
    switch (search.matchType ?? TextSearchQueryMatchTypes.like) {
      case TextSearchQueryMatchTypes.exact_match:
        match = p === value;
        break;
      case TextSearchQueryMatchTypes.globMatch: {
        const regex = value.split('').map(c => {
          if (c === '*') {
            return '.*';
          }
          if (c === '?') {
            return '.';
          }
          return c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
        }).join('');
        match = new RegExp('^' + regex + '$', 's').test(p) ||
          (value.endsWith('/*') && p === value.slice(0, -2));
        break;
      }
      default:
        match = p.includes(value);
    }
    return search.negate ? !match : match;
  },
  /**
   * Returns the fixed path segments at the beginning of a directory search, that every match starts with.
   * E.g.: exact 'a/b' -> ['a', 'b'], glob 'a/b/*' -> ['a', 'b'], glob 'a/b*' -> ['a'].
   * Returns null if the matches can be anywhere (like and negated searches).
   */
  getDirectorySearchAnchor: (search: DirectorySearch, foldAccents = false): string[] | null => {
    if (search.negate) {
      return null;
    }
    const segments = SearchQueryUtils.comparableDirectoryPath(search.value, foldAccents).split('/')
      .filter(s => s !== '');
    switch (search.matchType ?? TextSearchQueryMatchTypes.like) {
      case TextSearchQueryMatchTypes.exact_match:
        return segments;
      case TextSearchQueryMatchTypes.globMatch: {
        const firstWildcard = segments.findIndex(s => s.includes('*') || s.includes('?'));
        return firstWildcard === -1 ? segments : segments.slice(0, firstWildcard);
      }
      default:
        return null;
    }
  },
  /**
   * True if all matches of the search can be found from its path alone: exact match, or a glob that has no wildcard
   * other than a trailing '/*'. For other searches, the parents of the matching directories can only be found in the DB.
   */
  isDirectorySearchAnchored: (search: DirectorySearch): boolean => {
    if (search.negate) {
      return false;
    }
    const value = SearchQueryUtils.normalizeDirectoryPath(search.value);
    switch (search.matchType ?? TextSearchQueryMatchTypes.like) {
      case TextSearchQueryMatchTypes.exact_match:
        return true;
      case TextSearchQueryMatchTypes.globMatch: {
        const fixedPart = value.endsWith('/*') ? value.slice(0, -2) : (value === '*' ? '' : value);
        return !fixedPart.includes('*') && !fixedPart.includes('?');
      }
      default:
        return false;
    }
  },
  /**
   * Returns true if the directory is a parent of the fixed part of any entry of the list.
   * These parents are known from the path alone, without DB access.
   * For globs it can be true for a directory that also matches the entry itself (e.g.: 'a' for 'a/*'),
   * so check if the directory is allowed first.
   */
  isDirectoryAnchoredParent: (dirPath: string, list: DirectorySearch[], foldAccents = false): boolean => {
    const p = SearchQueryUtils.comparableDirectoryPath(dirPath, foldAccents).split('/')
      .filter(s => s !== '');
    return (list || []).some(d => {
      const anchor = SearchQueryUtils.getDirectorySearchAnchor(d, foldAccents);
      if (anchor === null || p.length > anchor.length) {
        return false;
      }
      if (!p.every((s, i) => s === anchor[i])) {
        return false;
      }
      // an exact search (or a glob without wildcards) only has parents above its own path
      const hasWildcard = d.matchType === TextSearchQueryMatchTypes.globMatch &&
        (d.value.includes('*') || d.value.includes('?'));
      return p.length < anchor.length || hasWildcard;
    });
  },
  /**
   * Returns true if the directory matches any entry of the list.
   */
  matchDirectoryList: (dirPath: string, list: DirectorySearch[], foldAccents = false): boolean => {
    return (list || []).some(d => SearchQueryUtils.matchDirectorySearch(dirPath, d, foldAccents));
  },
  /**
   * Converts a directory allow / block list to a single search query.
   * A directory matches the list if it matches any of its entries.
   * Returns null for an empty list.
   */
  directoryListToQuery: (list: DirectorySearch[]): SearchQueryDTO | null => {
    SearchQueryUtils.validateDirectoryList(list);
    if (!list || list.length === 0) {
      return null;
    }
    // plain copies, so config objects do not end up in the query
    const queries = list.map(d => {
      const q: DirectorySearch = {type: SearchQueryTypes.directory, value: d.value};
      if (typeof d.matchType !== 'undefined' && d.matchType !== null) {
        q.matchType = d.matchType;
      }
      if (d.negate) {
        q.negate = true;
      }
      return q;
    });
    if (queries.length === 1) {
      return queries[0];
    }
    return {type: SearchQueryTypes.OR, list: queries} as SearchListQuery;
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
    const shorten = (obj: unknown): unknown => {
      if (Array.isArray(obj)) {
        return obj.map(shorten);
      }
      if (obj && typeof obj === 'object') {
        const o = obj as Record<string, unknown>;
        const res: Record<string, unknown> = {};
        for (const key of Object.keys(o)) {
          if (key === 'negate' && o[key] === false) {
            continue;
          }
          res[SearchQueryUtils.URLMap[key] || key] = shorten(o[key]);
        }
        return res;
      }
      return obj;
    };

    return JSON.stringify(shorten(query));
  },
  /**
   * The urlified exact match text search (e.g. for a keyword, a person or a place link)
   */
  urlifyExactMatch: (type: SearchQueryTypes, value: string): string => {
    return SearchQueryUtils.urlify({
      type,
      matchType: TextSearchQueryMatchTypes.exact_match,
      value,
    } as TextSearch);
  },
  /**
   * Pareses the shortened urls and returns with the original SearchQueryDTO
   * @param urlQuery
   */
  parseURLifiedQuery: (urlQuery: string): SearchQueryDTO | null => {
    if (!urlQuery || urlQuery === '') {
      return null;
    }

    const map: Record<string, string> = {};
    Object.keys(SearchQueryUtils.URLMap).forEach(key => {
      map[SearchQueryUtils.URLMap[key]] = key;
    });
    const unshorten = (obj: unknown): unknown => {
      if (Array.isArray(obj)) {
        return obj.map(unshorten);
      }
      if (obj && typeof obj === 'object') {
        const o = obj as Record<string, unknown>;
        const type = o['t'] as SearchQueryTypes | undefined;
        const res: Record<string, unknown> = {};
        for (const key of Object.keys(o)) {
          let unshortenedKey = map[key] || key;
          if (unshortenedKey === 'text' && type !== undefined && !TextSearchQueryTypes.includes(type)) {
            // If it's not a text search, 'v' should map to 'value'
            if (RangeSearchQueryTypes.includes(type)) {
              unshortenedKey = 'value';
            }
          }
          res[unshortenedKey] = unshorten(o[key]);
        }
        return res;
      }
      return obj;
    };

    let parsed: unknown = null;
    try {
      parsed = JSON.parse(urlQuery);
    } catch {
      // not JSON, handled below
    }
    // Not a query object, e.g. a hand-typed /search/cat url: search for it as text
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {type: SearchQueryTypes.any_text, value: urlQuery} as TextSearch;
    }
    return unshorten(parsed) as SearchQueryDTO;


  }
};

