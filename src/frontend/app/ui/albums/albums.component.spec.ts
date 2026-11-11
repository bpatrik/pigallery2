import {TestBed} from '@angular/core/testing';
import {NO_ERRORS_SCHEMA, signal} from '@angular/core';
import {provideIcons} from '@ng-icons/core';
import {BsModalService} from 'ngx-bootstrap/modal';
import {AlbumsComponent} from './albums.component';
import {AlbumsService} from './albums.service';
import {AuthenticationService} from '../../model/network/authentication.service';
import {PiTitleService} from '../../model/pi-title.service';
import {ShareService} from '../gallery/share.service';
import {NavigationService} from '../../model/navigation.service';
import {RangeSearch, SearchQueryDTO, SearchQueryTypes, TextSearch} from '../../../../common/entities/SearchQueryDTO';
import {AlbumBaseDTO} from '../../../../common/entities/album/AlbumBaseDTO';
import {FrameComponent} from '../frame/frame.component';
import {AlbumComponent} from './album/album.component';
import {GallerySearchQueryBuilderComponent} from '../gallery/search/query-builder/query-bulder.gallery.component';
import {SavedSearchPopupComponent} from './saved-search-popup/saved-search-popup.component';
import {appIcons} from '../../icons';

describe('AlbumsComponent - IsSearchQueryEmpty', () => {
  let component: AlbumsComponent;

  beforeEach(() => {
    const albumsService = {albums: signal(null), getAlbums: () => Promise.resolve()} as unknown as AlbumsService;
    TestBed.configureTestingModule({
      providers: [
        {provide: AlbumsService, useValue: albumsService},
        {provide: BsModalService, useValue: null},
        {provide: AuthenticationService, useValue: null},
        {provide: PiTitleService, useValue: null},
        {provide: ShareService, useValue: null},
        {provide: NavigationService, useValue: null},
      ]
    });
    component = TestBed.runInInjectionContext(() => new AlbumsComponent());
  });

  const withQuery = (q: SearchQueryDTO): boolean => {
    component.savedSearch.searchQuery = q as TextSearch;
    return component.IsSearchQueryEmpty;
  };

  it('should be empty for an empty text query', () => {
    expect(withQuery({type: SearchQueryTypes.any_text, value: ''} as TextSearch)).toBe(true);
  });

  it('should not be empty for a text query', () => {
    expect(withQuery({type: SearchQueryTypes.any_text, value: 'cat'} as TextSearch)).toBe(false);
  });

  it('should be empty for a date query without dates', () => {
    expect(withQuery({type: SearchQueryTypes.date} as RangeSearch)).toBe(true);
  });

  it('should not be empty for a date query with dates', () => {
    expect(withQuery({type: SearchQueryTypes.date, min: Date.UTC(2024, 0, 10)} as RangeSearch)).toBe(false);
    expect(withQuery({type: SearchQueryTypes.date, max: Date.UTC(2024, 0, 10)} as RangeSearch)).toBe(false);
    expect(withQuery({
      type: SearchQueryTypes.date,
      min: Date.UTC(2024, 0, 10),
      max: Date.UTC(2024, 1, 20)
    } as RangeSearch)).toBe(false);
  });

  it('should not be empty for a date query with a leftover empty text value', () => {
    // switching the type in the query builder used to leave value: '' behind
    expect(withQuery({type: SearchQueryTypes.date, value: '', min: Date.UTC(2024, 0, 10)} as unknown as RangeSearch)).toBe(false);
  });
});

describe('AlbumsComponent - empty state', () => {

  const render = async (albums: AlbumBaseDTO[]): Promise<HTMLElement> => {
    const albumsService = {albums: signal(albums), getAlbums: () => Promise.resolve()} as unknown as AlbumsService;
    TestBed.configureTestingModule({
      providers: [
        provideIcons(appIcons),
        {provide: AlbumsService, useValue: albumsService},
        {provide: BsModalService, useValue: null},
        {provide: AuthenticationService, useValue: {isAuthorized: () => true, isAuthenticated: () => true}},
        {provide: PiTitleService, useValue: {setTitle: (): void => undefined}},
        {provide: ShareService, useValue: {wait: () => Promise.resolve()}},
        {provide: NavigationService, useValue: null},
      ]
    });
    // the navbar (app-frame) and the album cards are not needed: only the albums page itself is rendered
    TestBed.overrideComponent(AlbumsComponent, {
      remove: {imports: [FrameComponent, AlbumComponent, GallerySearchQueryBuilderComponent, SavedSearchPopupComponent]},
      add: {schemas: [NO_ERRORS_SCHEMA]}
    });
    const fixture = TestBed.createComponent(AlbumsComponent);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  };

  /**
   * The outermost block that tells that there are no albums (not the page container with the "Add saved search" button).
   */
  const emptyState = (el: HTMLElement): HTMLElement | undefined =>
    [...el.querySelectorAll<HTMLElement>('div')]
      .find(d => /no albums/i.test(d.textContent ?? '') && !d.querySelector('button'));

  it('should not show the empty state when there are albums', async () => {
    const el = await render([{id: 1, name: 'Summer', locked: false} as AlbumBaseDTO]);
    expect(emptyState(el)).toBeUndefined();
  });

  // #1312: an icon and a short explanation of how to save a search as an album, not only ":( No albums to show."
  it.fails('should show an icon and explain how to add an album when there are no albums yet', async () => {
    const el = await render([]);

    const state = emptyState(el);
    expect(state, 'the empty state').toBeDefined();
    expect(state!.querySelector('ng-icon'), 'icon of the empty state').not.toBeNull();
    expect(state!.textContent).toMatch(/save.*search|search.*album/i);
  });
});
