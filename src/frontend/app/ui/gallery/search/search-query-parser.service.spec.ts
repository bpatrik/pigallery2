import {TestBed} from '@angular/core/testing';
import {SearchQueryParserService} from './search-query-parser.service';
import {
  ANDSearchQuery,
  ORSearchQuery,
  SearchQueryDTO,
  SearchQueryTypes,
  TextSearch,
  TextSearchQueryMatchTypes
} from '../../../../../common/entities/SearchQueryDTO';
import {SearchQueryUtils} from '../../../../../common/SearchQueryUtils';

// #1309, CUJ 21: the search bar text and the query of the query builder (and of the URL) turn into each other
// (the texts have accents and other non-ASCII letters on purpose: the parser must keep them)
describe('SearchQueryParserService', () => {
  let service: SearchQueryParserService;

  beforeEach(() => {
    service = TestBed.inject(SearchQueryParserService);
  });

  describe('text -> query -> text', () => {
    it.each([
      'Árvíztűrő',
      'any-text:(Árvíztűrő tükörfúrógép)',
      'keyword:café',
      'keyword:(crème brûlée)',
      'person:"Zoë Smith"',
      'person!:"Zoë Smith"',
      'caption:(fête dinner)',
      'file-name:"IMG_ÅÄÖ.jpg"',
      'position:Orléans',
      'directory~:Vacation/Orléans/*',
      'directory~:"Vacation/Árvíztűrő tükörfúrógép/*"',
      'directory:(with special caracters(_.-.,-.,) 1234 56789 űáéú őóüö)',
      'Zoë and keyword:café',
      'person:"Zoë Smith" or person:"José García"',
      'Zoë and (Chloé or José)',
      '2-of:(Zoë Chloé José)',
      '日本 and Москва',
    ])('should keep "%s"', (text) => {
      expect(service.stringify(service.parse(text))).toBe(text);
    });

    // TODO #1309: the parser collapses the double space, so the search of a folder with two spaces in its name
    // (e.g.: the "its  a along directory name..." folder of demo/images) does not find that folder.
    it.fails('should keep the double space of a folder name', () => {
      const name = 'its  a along directory name. with special caracters(_.-.,-.,) 1234 56789 űáéú őóüö';
      expect((service.parse('directory:(' + name + ')') as TextSearch).value).toBe(name);
    });

    it('should search free text with accents as any text', () => {
      expect(service.parse('Árvíztűrő')).toEqual({type: SearchQueryTypes.any_text, value: 'Árvíztűrő'} as TextSearch);
    });

    it('should search the words of free text with accents together', () => {
      expect(service.parse('Árvíztűrő tükörfúrógép')).toEqual({
        type: SearchQueryTypes.AND,
        list: [
          {type: SearchQueryTypes.any_text, value: 'Árvíztűrő'} as TextSearch,
          {type: SearchQueryTypes.any_text, value: 'tükörfúrógép'} as TextSearch
        ]
      } as ANDSearchQuery);
    });
  });

  describe('query -> text -> query', () => {
    it.each<[string, SearchQueryDTO]>([
      ['any text', {type: SearchQueryTypes.any_text, value: 'Árvíztűrő tükörfúrógép'} as TextSearch],
      ['exact person', {type: SearchQueryTypes.person, value: 'Zoë Smith', matchType: TextSearchQueryMatchTypes.exact_match} as TextSearch],
      ['negated keyword', {type: SearchQueryTypes.keyword, value: 'crème brûlée', negate: true} as TextSearch],
      ['directory glob', {
        type: SearchQueryTypes.directory,
        value: 'Vacation/Orléans/*',
        matchType: TextSearchQueryMatchTypes.globMatch
      } as TextSearch],
      ['or of and', {
        type: SearchQueryTypes.OR,
        list: [
          {type: SearchQueryTypes.caption, value: 'fête'} as TextSearch,
          {
            type: SearchQueryTypes.AND,
            list: [
              {type: SearchQueryTypes.position, value: 'Orléans'} as TextSearch,
              {type: SearchQueryTypes.file_name, value: 'ÅÄÖ'} as TextSearch,
            ]
          } as ANDSearchQuery
        ]
      } as ORSearchQuery],
    ])('should keep the %s query', (_, query) => {
      expect(service.parse(service.stringify(query))).toEqual(query);
    });

    it('should leave out the default match type', () => {
      const query = {type: SearchQueryTypes.keyword, value: 'café', matchType: TextSearchQueryMatchTypes.like} as TextSearch;
      expect(service.stringify(query)).toBe('keyword:café');
    });

    it('should stringify nothing to an empty text', () => {
      expect(service.stringify(null)).toBe('');
      expect(service.stringify(undefined)).toBe('');
    });
  });

  // the URL of a search (/search/<query>) carries the query in a shortened JSON
  describe('URL', () => {
    it('should keep a query with accents through the URL', () => {
      const query = service.parse('person:"Zoë Smith" and directory~:"Vacation/Árvíztűrő tükörfúrógép/*"');
      const url = '/search/' + encodeURIComponent(SearchQueryUtils.urlify(query));
      const back = SearchQueryUtils.parseURLifiedQuery(decodeURIComponent(url.substring('/search/'.length)));
      expect(back).toEqual(query);
      expect(service.stringify(back)).toBe('person:"Zoë Smith" and directory~:"Vacation/Árvíztűrő tükörfúrógép/*"');
    });

    it('should search a hand typed URL with accents as text', () => {
      expect(SearchQueryUtils.parseURLifiedQuery('Árvíztűrő')).toEqual({type: SearchQueryTypes.any_text, value: 'Árvíztűrő'});
    });
  });
});
