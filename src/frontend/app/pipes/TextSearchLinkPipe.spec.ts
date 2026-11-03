import {TextSearchLinkPipe} from './TextSearchLinkPipe';
import {SearchQueryTypes, TextSearch, TextSearchQueryMatchTypes} from '../../../common/entities/SearchQueryDTO';
import {SearchQueryUtils} from '../../../common/SearchQueryUtils';

describe('TextSearchLinkPipe', () => {
  const pipe = new TextSearchLinkPipe();

  it('should build the exact match search of a keyword, a person and a place', () => {
    expect(pipe.transform('Balaton nyár', SearchQueryTypes.keyword)).toBe('{"t":104,"mt":1,"v":"Balaton nyár"}');
    expect(pipe.transform('Árvíztűrő Tükörfúrógép', SearchQueryTypes.person)).toBe('{"t":105,"mt":1,"v":"Árvíztűrő Tükörfúrógép"}');
    expect(pipe.transform('Székesfehérvár', SearchQueryTypes.position)).toBe('{"t":106,"mt":1,"v":"Székesfehérvár"}');
  });

  it('should be parsed back to the same query', () => {
    const query = {type: SearchQueryTypes.keyword, matchType: TextSearchQueryMatchTypes.exact_match, value: 'Pécs "belváros" (2)'} as TextSearch;
    expect(SearchQueryUtils.parseURLifiedQuery(pipe.transform(query.value, query.type))).toEqual(query);
  });
});
