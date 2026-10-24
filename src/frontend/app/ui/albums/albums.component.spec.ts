import {AlbumsComponent} from './albums.component';
import {AlbumsService} from './albums.service';
import {SearchQueryParserService} from '../gallery/search/search-query-parser.service';
import {RangeSearch, SearchQueryDTO, SearchQueryTypes, TextSearch} from '../../../../common/entities/SearchQueryDTO';

describe('AlbumsComponent - IsSearchQueryEmpty', () => {
  let component: AlbumsComponent;

  beforeEach(() => {
    const albumsService = {getAlbums: () => Promise.resolve()} as unknown as AlbumsService;
    component = new AlbumsComponent(
      albumsService, null, null, null, null, null, null,
      new SearchQueryParserService()
    );
  });

  const withQuery = (q: SearchQueryDTO): boolean => {
    component.savedSearch.searchQuery = q as TextSearch;
    return component.IsSearchQueryEmpty;
  };

  it('should be empty for an empty text query', () => {
    expect(withQuery({type: SearchQueryTypes.any_text, value: ''} as TextSearch)).toBeTrue();
  });

  it('should not be empty for a text query', () => {
    expect(withQuery({type: SearchQueryTypes.any_text, value: 'cat'} as TextSearch)).toBeFalse();
  });

  it('should be empty for a date query without dates', () => {
    expect(withQuery({type: SearchQueryTypes.date} as RangeSearch)).toBeTrue();
  });

  it('should not be empty for a date query with dates', () => {
    expect(withQuery({type: SearchQueryTypes.date, min: Date.UTC(2024, 0, 10)} as RangeSearch)).toBeFalse();
    expect(withQuery({type: SearchQueryTypes.date, max: Date.UTC(2024, 0, 10)} as RangeSearch)).toBeFalse();
    expect(withQuery({
      type: SearchQueryTypes.date,
      min: Date.UTC(2024, 0, 10),
      max: Date.UTC(2024, 1, 20)
    } as RangeSearch)).toBeFalse();
  });

  it('should not be empty for a date query with a leftover empty text value', () => {
    // switching the type in the query builder used to leave value: '' behind
    expect(withQuery({type: SearchQueryTypes.date, value: '', min: Date.UTC(2024, 0, 10)} as unknown as RangeSearch)).toBeFalse();
  });
});
