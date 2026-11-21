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
// (the typed texts and the suggestions have accents on purpose: they must survive the request, the sorting and the cache)
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
    expect(service.autoComplete({current: '', prev: 'lake'})).toEqual({
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
      {value: 'Éclair', type: SearchQueryTypes.keyword},
      {value: 'Étienne', type: SearchQueryTypes.person},
      {value: 'Rue Étienne Marcel', type: SearchQueryTypes.position},
    ];
    const result = service.autoComplete({current: 'É', prev: ''});
    expect(result.more).not.toBeNull();
    expect(getJson).toHaveBeenCalledWith('/autocomplete/' + encodeURIComponent('É'), {});

    const items = await result.more!;
    // those that start with the text first, persons first among them; a later word that starts with it after them
    expect(values(items)).toEqual(['Étienne', 'Éclair', 'Rue Étienne Marcel']);
    expect(hints(items)).toEqual(['person:"Étienne"', 'keyword:"Éclair"', 'position:"Rue Étienne Marcel"']);
  });

  it('should ask the server for the type of the typed keyword', async () => {
    serverItems = [{value: 'Éclair', type: SearchQueryTypes.keyword}];
    const result = service.autoComplete({current: 'keyword:"Écl', prev: ''});
    expect(getJson).toHaveBeenCalledWith('/autocomplete/' + encodeURIComponent('Écl'), {type: SearchQueryTypes.keyword});
    expect(hints(await result.more!)).toEqual(['keyword:"Éclair"']);
  });

  it('should keep the distance in the hint of a place', async () => {
    serverItems = [{value: 'Orléans', type: SearchQueryTypes.position}];
    const result = service.autoComplete({current: '5-km-from:Orlé', prev: ''});
    expect(getJson).toHaveBeenCalledWith('/autocomplete/' + encodeURIComponent('Orlé'), {type: SearchQueryTypes.distance});
    expect(hints(await result.more!)).toContain('5-km-from:"Orléans"');
  });

  it('should answer from the cache without asking the server again', async () => {
    serverItems = [{value: 'Étienne', type: SearchQueryTypes.person}];
    await service.autoComplete({current: 'Ét', prev: ''}).more;
    expect(cache.getAutoComplete('Ét', null)).toEqual(serverItems);

    const result = service.autoComplete({current: 'Ét', prev: ''});
    expect(result.more).toBeNull();
    expect(hints(result.items)).toEqual(['person:"Étienne"']);
    expect(getJson).toHaveBeenCalledTimes(1);
  });
});
