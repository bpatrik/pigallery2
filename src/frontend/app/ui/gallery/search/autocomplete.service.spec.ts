import {TestBed} from '@angular/core/testing';
import {AutoCompleteService, RenderableAutoCompleteItem} from './autocomplete.service';
import {NetworkService} from '../../../model/network/network.service';
import {GalleryCacheService} from '../cache.gallery.service';
import {IAutoCompleteItem} from '../../../../../common/entities/AutoCompleteItem';
import {SearchQueryTypes} from '../../../../../common/entities/SearchQueryDTO';

// stores the server answers like the localStorage based cache
class FakeGalleryCacheService {
  items = new Map<string, IAutoCompleteItem[]>();

  getAutoComplete(text: string, type: SearchQueryTypes | null | undefined): IAutoCompleteItem[] | null {
    return this.items.get(type + ':' + text) ?? null;
  }

  setAutoComplete(text: string, type: SearchQueryTypes | null | undefined, items: IAutoCompleteItem[]): void {
    this.items.set(type + ':' + text, items);
  }
}

// #1309, CUJ 21: the suggestions of the search bar
describe('AutoCompleteService', () => {
  let service: AutoCompleteService;
  let cache: FakeGalleryCacheService;
  let getJson: ReturnType<typeof vi.fn>;
  let serverItems: IAutoCompleteItem[];

  const values = (items: RenderableAutoCompleteItem[]): string[] => items.map(i => i.value);
  const hints = (items: RenderableAutoCompleteItem[]): string[] => items.map(i => i.queryHint);

  beforeEach(() => {
    serverItems = [];
    getJson = vi.fn(() => Promise.resolve(serverItems));
    TestBed.configureTestingModule({
      providers: [
        {provide: NetworkService, useValue: {getJson}},
        {provide: GalleryCacheService, useClass: FakeGalleryCacheService},
      ]
    });
    service = TestBed.inject(AutoCompleteService);
    cache = TestBed.inject(GalleryCacheService) as unknown as FakeGalleryCacheService;
  });

  it('should suggest "and" for an empty search, but not twice', () => {
    expect(service.autoComplete({current: '', prev: 'Balaton'})).toEqual({
      items: [{value: 'and', queryHint: 'and', notSearchable: true}],
      more: null
    });
    expect(service.autoComplete({current: '', prev: 'and'}).items).toEqual([]);
    expect(getJson).not.toHaveBeenCalled();
  });

  it('should suggest the keywords that start with the typed text', () => {
    const items = service.autoComplete({current: 'pe', prev: ''}).items;
    expect(values(items)).toEqual(expect.arrayContaining(['person:', 'person-count<=9']));
    expect(items.every(i => i.notSearchable)).toBe(true);
    expect(values(items)).not.toContain('keyword:');
  });

  it('should suggest the rating values without asking the server', () => {
    const result = service.autoComplete({current: 'rating:', prev: ''});
    expect(values(result.items)).toEqual(expect.arrayContaining(['rating:1', 'rating:5', 'rating:1..5']));
    expect(result.more).toBeNull();
    expect(getJson).not.toHaveBeenCalled();
  });

  it('should ask the server for a text with accents and sort the persons first', async () => {
    serverItems = [
      {value: 'Árvíztűrő tükörfúrógép', type: SearchQueryTypes.keyword},
      {value: 'Árpád', type: SearchQueryTypes.person},
      {value: 'Szent Árpád utca', type: SearchQueryTypes.position},
    ];
    const result = service.autoComplete({current: 'Ár', prev: ''});
    expect(result.more).not.toBeNull();
    expect(getJson).toHaveBeenCalledWith('/autocomplete/' + encodeURIComponent('Ár'), {});

    const items = await result.more!;
    // those that start with the text first, persons first among them; a later word that starts with it after them
    expect(values(items)).toEqual(['Árpád', 'Árvíztűrő tükörfúrógép', 'Szent Árpád utca']);
    expect(hints(items)).toEqual(['person:"Árpád"', 'keyword:"Árvíztűrő tükörfúrógép"', 'position:"Szent Árpád utca"']);
  });

  it('should ask the server for the type of the typed keyword', async () => {
    serverItems = [{value: 'Őszi kirándulás', type: SearchQueryTypes.keyword}];
    const result = service.autoComplete({current: 'keyword:"Ősz', prev: ''});
    expect(getJson).toHaveBeenCalledWith('/autocomplete/' + encodeURIComponent('Ősz'), {type: SearchQueryTypes.keyword});
    expect(hints(await result.more!)).toEqual(['keyword:"Őszi kirándulás"']);
  });

  it('should keep the distance in the hint of a place', async () => {
    serverItems = [{value: 'Pécs', type: SearchQueryTypes.position}];
    const result = service.autoComplete({current: '5-km-from:Pé', prev: ''});
    expect(getJson).toHaveBeenCalledWith('/autocomplete/' + encodeURIComponent('Pé'), {type: SearchQueryTypes.distance});
    expect(hints(await result.more!)).toContain('5-km-from:"Pécs"');
  });

  it('should answer from the cache without asking the server again', async () => {
    serverItems = [{value: 'Ábel', type: SearchQueryTypes.person}];
    await service.autoComplete({current: 'Áb', prev: ''}).more;
    expect(cache.getAutoComplete('Áb', null)).toEqual(serverItems);

    const result = service.autoComplete({current: 'Áb', prev: ''});
    expect(result.more).toBeNull();
    expect(hints(result.items)).toEqual(['person:"Ábel"']);
    expect(getJson).toHaveBeenCalledTimes(1);
  });
});
