import {TestBed} from '@angular/core/testing';
import {signal} from '@angular/core';
import {Router} from '@angular/router';
import {GalleryNavigatorComponent} from './navigator.gallery.component';
import {AuthenticationService} from '../../../model/network/authentication.service';
import {QueryService} from '../../../model/query.service';
import {ContentLoaderService} from '../contentLoader.service';
import {FilterService} from '../filter/filter.service';
import {GallerySortingService} from './sorting.service';
import {GalleryNavigatorService} from './navigator.service';
import {ContentWrapperWithError} from '../../../../../common/entities/ContentWrapper';
import {UserDTO, UserRoles} from '../../../../../common/entities/UserDTO';
import {SearchQueryTypes, TextSearch, TextSearchQueryMatchTypes} from '../../../../../common/entities/SearchQueryDTO';
import {SearchQueryUtils} from '../../../../../common/SearchQueryUtils';

describe('GalleryNavigatorComponent', () => {
  let component: GalleryNavigatorComponent;
  let content: ReturnType<typeof signal<ContentWrapperWithError>>;
  let user: ReturnType<typeof signal<UserDTO>>;
  let router: { navigate: ReturnType<typeof vi.fn> };
  let params: ReturnType<typeof signal<Record<string, string>>>;

  // the folder name has accents on purpose: the routes and the queries must keep them
  const folder = (path: string, name: string, availableParents?: boolean[]): ContentWrapperWithError =>
    ({directory: {path, name, availableParents}} as unknown as ContentWrapperWithError);

  beforeEach(() => {
    content = signal<ContentWrapperWithError>({} as ContentWrapperWithError);
    user = signal<UserDTO>({name: 'admin', role: UserRoles.Admin} as UserDTO);
    router = {navigate: vi.fn().mockResolvedValue(true)};
    params = signal<Record<string, string>>({});
    TestBed.configureTestingModule({
      providers: [
        {provide: ContentLoaderService, useValue: {content}},
        {provide: AuthenticationService, useValue: {user}},
        {provide: QueryService, useValue: {getParams: (): Record<string, string> => ({}), params}},
        {provide: FilterService, useValue: {}},
        {provide: GallerySortingService, useValue: {}},
        {provide: GalleryNavigatorService, useValue: {}},
        {provide: Router, useValue: router}
      ]
    });
    // only the component logic is tested here
    TestBed.overrideComponent(GalleryNavigatorComponent, {set: {template: '', imports: []}});
    component = TestBed.createComponent(GalleryNavigatorComponent).componentInstance;
  });

  describe('routes', () => {
    it('should show only Home for the root folder', () => {
      content.set(folder('.', ''));
      expect(component.routes()).toEqual([{name: 'Home', route: null}]);
    });

    it('should link every parent of an accented folder', () => {
      content.set(folder('Vacation/Lake', 'Árvíztűrő tükörfúrógép'));
      expect(component.routes()).toEqual([
        // '' and not '/': the folder is one URL segment, so '/' would become /gallery/%2F
        {name: 'Home', route: ''},
        {name: 'Vacation', route: 'Vacation'},
        {name: 'Lake', route: 'Vacation/Lake', title: 'key: alt + up'},
        {name: 'Árvíztűrő tükörfúrógép', route: null},
      ]);
    });

    it('should link only the parents the server allows', () => {
      content.set(folder('Vacation/Lake', 'Árvíztűrő tükörfúrógép', [false, false, true]));
      expect(component.routes().map((r) => r.route)).toEqual([null, null, 'Vacation/Lake', null]);
    });

    it('should not link parents for a sharing guest', () => {
      user.set({name: 'Guest', role: UserRoles.LimitedGuest} as UserDTO);
      content.set(folder('Vacation', 'Lake'));
      expect(component.routes().map((r) => r.route)).toEqual([null, null, null]);
    });

    it('should show the folder of an exact directory search', () => {
      content.set({
        searchResult: {
          searchQuery: {
            type: SearchQueryTypes.directory,
            matchType: TextSearchQueryMatchTypes.exact_match,
            value: './Vacation/Lake'
          }
        }
      } as unknown as ContentWrapperWithError);
      expect(component.routes().map((r) => r.name)).toEqual(['Home', 'Vacation', 'Lake']);
    });

    it('should have no routes for a search', () => {
      content.set({searchResult: {searchQuery: {type: SearchQueryTypes.any_text, value: 'Lake'}}} as unknown as ContentWrapperWithError);
      expect(component.routes()).toEqual([]);
    });
  });

  // #1308, CUJ 9: the flatten button opens a directory search of the folder
  describe('flatten', () => {
    const flattenQuery = (): TextSearch => SearchQueryUtils.parseURLifiedQuery(component.directoryFlattenSearchQuery()!) as TextSearch;

    // the server sends the path of a folder like this (DiskManager.pathFromRelativeDirName)
    it('should search the media of the folder with accents and of its subfolders', () => {
      content.set(folder('Vacation/Lake/', 'Árvíztűrő tükörfúrógép'));
      const query = flattenQuery();
      expect(query.type).toBe(SearchQueryTypes.directory);
      expect(query.matchType).toBe(TextSearchQueryMatchTypes.globMatch);
      expect(query.value.startsWith('Vacation/Lake/Árvíztűrő tükörfúrógép')).toBe(true);
    });

    // TODO #1308: the glob is "<folder>*", so it also matches the sibling folders that start with the same name
    // (e.g.: "Árvíztűrő tükörfúrógép 2"). "<folder>/*" matches the folder and its subfolders only (SearchManager.expandDirectoryGlobs).
    it.fails('should not search the sibling folders that start with the same name', () => {
      content.set(folder('Vacation/Lake/', 'Árvíztűrő tükörfúrógép'));
      expect(flattenQuery()).toEqual({
        type: SearchQueryTypes.directory,
        matchType: TextSearchQueryMatchTypes.globMatch,
        value: 'Vacation/Lake/Árvíztűrő tükörfúrógép/*'
      });
    });

    it('should search everything from the root folder', () => {
      content.set(folder('./', '.'));
      expect(flattenQuery().value).toMatch(/^\.\/?\*$/);
    });

    it('should not offer it for a search result', () => {
      content.set({searchResult: {searchQuery: {type: SearchQueryTypes.any_text, value: 'Lake'}}} as unknown as ContentWrapperWithError);
      expect(component.directoryFlattenSearchQuery()).toBeNull();
    });
  });

  describe('alt + up', () => {
    const altUp = new KeyboardEvent('keydown', {key: 'ArrowUp', altKey: true});

    it('should open the parent folder', () => {
      content.set(folder('Vacation/Lake', 'Árvíztűrő tükörfúrógép'));
      component.onKeyPress(altUp);
      expect(router.navigate).toHaveBeenCalledWith(['/gallery', 'Vacation/Lake'], {queryParams: {}});
    });

    it('should follow the content to the next folder', () => {
      content.set(folder('Vacation/Lake', 'Árvíztűrő tükörfúrógép'));
      content.set(folder('Vacation', 'Lake'));
      component.onKeyPress(altUp);
      expect(router.navigate).toHaveBeenCalledWith(['/gallery', 'Vacation'], {queryParams: {}});
    });

    it('should open the root from a top level folder', () => {
      content.set(folder('.', 'Vacation'));
      component.onKeyPress(altUp);
      expect(router.navigate).toHaveBeenCalledWith(['/gallery', ''], {queryParams: {}});
    });

    it('should do nothing without a parent the user may open', () => {
      content.set(folder('Vacation', 'Lake', [false, false]));
      component.onKeyPress(altUp);
      expect(router.navigate).not.toHaveBeenCalled();
    });
  });

  // #1311, CUJ 32: the zip download of the folder or the search
  describe('zip download', () => {
    const zipUrl = (): URL => new URL(component.downloadZipLink()!, 'http://localhost');

    it('should zip the folder with accents', () => {
      content.set(folder('Vacation/', 'Árvíztűrő tükörfúrógép'));
      const url = zipUrl();
      expect(url.pathname.startsWith('/pgapi/gallery/zip/')).toBe(true);
      const query = JSON.parse(decodeURIComponent(url.pathname.substring('/pgapi/gallery/zip/'.length))) as TextSearch;
      expect(query).toEqual({
        type: SearchQueryTypes.directory,
        matchType: TextSearchQueryMatchTypes.exact_match,
        value: 'Vacation/Árvíztűrő tükörfúrógép'
      });
    });

    it('should keep the sharing key', () => {
      params.set({sk: 'abc'});
      content.set(folder('Vacation/', 'Lake'));
      expect(zipUrl().searchParams.get('sk')).toBe('abc');
    });

    // #1311: the query params are joined with '&', not like "?sk=abcfoo=bar"
    it('should keep every query param', () => {
      params.set({sk: 'abc', foo: 'bar'});
      content.set(folder('Vacation/', 'Lake'));
      const url = zipUrl();
      expect(url.searchParams.get('sk')).toBe('abc');
      expect(url.searchParams.get('foo')).toBe('bar');
    });

    // the template shows the button only with items to download
    it('should count no items in a folder without media', () => {
      content.set({directory: {path: './', name: 'emptydirectory', cache: {mediaCount: 0}}} as unknown as ContentWrapperWithError);
      expect(component.itemCount()).toBe(0);
      content.set({directory: {path: './', name: 'Lake', cache: {mediaCount: 3}}} as unknown as ContentWrapperWithError);
      expect(component.itemCount()).toBe(3);
    });
  });
});
