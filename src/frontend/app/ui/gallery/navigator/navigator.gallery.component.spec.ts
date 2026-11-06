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
import {SearchQueryTypes, TextSearchQueryMatchTypes} from '../../../../../common/entities/SearchQueryDTO';

describe('GalleryNavigatorComponent', () => {
  let component: GalleryNavigatorComponent;
  let content: ReturnType<typeof signal<ContentWrapperWithError>>;
  let user: ReturnType<typeof signal<UserDTO>>;
  let router: { navigate: ReturnType<typeof vi.fn> };

  const folder = (path: string, name: string, availableParents?: boolean[]): ContentWrapperWithError =>
    ({directory: {path, name, availableParents}} as unknown as ContentWrapperWithError);

  beforeEach(() => {
    content = signal<ContentWrapperWithError>({} as ContentWrapperWithError);
    user = signal<UserDTO>({name: 'admin', role: UserRoles.Admin} as UserDTO);
    router = {navigate: vi.fn().mockResolvedValue(true)};
    TestBed.configureTestingModule({
      providers: [
        {provide: ContentLoaderService, useValue: {content}},
        {provide: AuthenticationService, useValue: {user}},
        {provide: QueryService, useValue: {getParams: (): Record<string, string> => ({})}},
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
      content.set(folder('Nyaralás/Balaton', 'Őszi kirándulás'));
      expect(component.routes()).toEqual([
        {name: 'Home', route: '/'},
        {name: 'Nyaralás', route: 'Nyaralás'},
        {name: 'Balaton', route: 'Nyaralás/Balaton', title: 'key: alt + up'},
        {name: 'Őszi kirándulás', route: null},
      ]);
    });

    it('should link only the parents the server allows', () => {
      content.set(folder('Nyaralás/Balaton', 'Őszi kirándulás', [false, false, true]));
      expect(component.routes().map((r) => r.route)).toEqual([null, null, 'Nyaralás/Balaton', null]);
    });

    it('should not link parents for a sharing guest', () => {
      user.set({name: 'Guest', role: UserRoles.LimitedGuest} as UserDTO);
      content.set(folder('Nyaralás', 'Balaton'));
      expect(component.routes().map((r) => r.route)).toEqual([null, null, null]);
    });

    it('should show the folder of an exact directory search', () => {
      content.set({
        searchResult: {
          searchQuery: {
            type: SearchQueryTypes.directory,
            matchType: TextSearchQueryMatchTypes.exact_match,
            value: './Nyaralás/Balaton'
          }
        }
      } as unknown as ContentWrapperWithError);
      expect(component.routes().map((r) => r.name)).toEqual(['Home', 'Nyaralás', 'Balaton']);
    });

    it('should have no routes for a search', () => {
      content.set({searchResult: {searchQuery: {type: SearchQueryTypes.any_text, value: 'Balaton'}}} as unknown as ContentWrapperWithError);
      expect(component.routes()).toEqual([]);
    });
  });

  describe('alt + up', () => {
    const altUp = new KeyboardEvent('keydown', {key: 'ArrowUp', altKey: true});

    it('should open the parent folder', () => {
      content.set(folder('Nyaralás/Balaton', 'Őszi kirándulás'));
      component.onKeyPress(altUp);
      expect(router.navigate).toHaveBeenCalledWith(['/gallery', 'Nyaralás/Balaton'], {queryParams: {}});
    });

    it('should follow the content to the next folder', () => {
      content.set(folder('Nyaralás/Balaton', 'Őszi kirándulás'));
      content.set(folder('Nyaralás', 'Balaton'));
      component.onKeyPress(altUp);
      expect(router.navigate).toHaveBeenCalledWith(['/gallery', 'Nyaralás'], {queryParams: {}});
    });

    it('should do nothing without a parent the user may open', () => {
      content.set(folder('Nyaralás', 'Balaton', [false, false]));
      component.onKeyPress(altUp);
      expect(router.navigate).not.toHaveBeenCalled();
    });
  });
});
