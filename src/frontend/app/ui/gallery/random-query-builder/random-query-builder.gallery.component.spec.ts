import '../../../../../common/config/public/Config';
import {TestBed} from '@angular/core/testing';
import {signal} from '@angular/core';
import {BsModalService} from 'ngx-bootstrap/modal';
import {RandomQueryBuilderGalleryComponent} from './random-query-builder.gallery.component';
import {ContentLoaderService} from '../contentLoader.service';
import {NotificationService} from '../../../model/notification.service';
import {Config} from '../../../../../common/config/public/Config';
import {SearchQueryUtils} from '../../../../../common/SearchQueryUtils';
import {ContentWrapperWithError} from '../../../../../common/entities/ContentWrapper';
import {
  ANDSearchQuery,
  SearchQueryDTO,
  SearchQueryTypes,
  TextSearch,
  TextSearchQueryMatchTypes
} from '../../../../../common/entities/SearchQueryDTO';

// The random photo link (#1313, CUJ 33): a public API URL that answers a random photo of the query.
describe('RandomQueryBuilderGalleryComponent', () => {
  let component: RandomQueryBuilderGalleryComponent;
  let content: ReturnType<typeof signal<ContentWrapperWithError>>;
  let originalPublicUrl: string;
  let originalUrlBase: string;

  // accents in the person name: non-ASCII text must survive the link of the query
  const query: ANDSearchQuery = {
    type: SearchQueryTypes.AND,
    list: [
      {type: SearchQueryTypes.directory, matchType: TextSearchQueryMatchTypes.exact_match, value: './Holiday 2024'} as TextSearch,
      {type: SearchQueryTypes.person, value: 'Árvíztűrő Tükörfúrógép'} as TextSearch,
    ]
  };

  beforeEach(() => {
    originalPublicUrl = Config.Server.publicUrl;
    originalUrlBase = Config.Server.urlBase;
    Config.Server.publicUrl = 'https://photos.example.com/';
    Config.Server.urlBase = '/myGallery';
    content = signal({} as ContentWrapperWithError);
    TestBed.configureTestingModule({
      providers: [
        {provide: ContentLoaderService, useValue: {content}},
        {provide: NotificationService, useValue: {}},
        {provide: BsModalService, useValue: {show: vi.fn()}},
      ]
    });
    component = TestBed.runInInjectionContext(() => new RandomQueryBuilderGalleryComponent());
  });

  afterEach(() => {
    Config.Server.publicUrl = originalPublicUrl;
    Config.Server.urlBase = originalUrlBase;
  });

  const showDirectory = (path: string, name: string): void =>
    content.set({directory: {path, name}} as unknown as ContentWrapperWithError);
  const showSearch = (searchQuery: SearchQueryDTO): void =>
    content.set({searchResult: {searchQuery}} as unknown as ContentWrapperWithError);
  const open = (): void => {
    component.openModal(null as never);
  };

  const prefix = 'https://photos.example.com/myGallery/pgapi/gallery/random/';

  /**
   * The search query that the random endpoint gets from the link: express decodes the path parameter,
   * the server parses the query as the search page does.
   */
  const queryOfLink = (link: string): SearchQueryDTO | null => {
    expect(link.startsWith(prefix), link).toBe(true);
    return SearchQueryUtils.parseURLifiedQuery(decodeURIComponent(link.substring(prefix.length)));
  };

  it('should build the random link of the photos of the opened folder', () => {
    showDirectory('./Holiday 2024/', 'Árvíztűrő');
    open();

    expect(queryOfLink(component.url())).toEqual({
      type: SearchQueryTypes.directory,
      matchType: TextSearchQueryMatchTypes.exact_match,
      value: './Holiday 2024/Árvíztűrő',
    });
  });

  it('should build the random link of the query of the opened search', () => {
    showSearch(query);
    open();

    expect(queryOfLink(component.url())).toEqual(query);
  });

  it('should be enabled both in a folder and in a search', () => {
    expect(component.enabled()).toBe(false);
    showDirectory('./', 'Holiday 2024');
    expect(component.enabled()).toBe(true);
    showSearch(query);
    expect(component.enabled()).toBe(true);
  });

  it('should follow the opened folder or search each time the dialog opens', () => {
    showDirectory('./', 'Holiday 2024');
    open();
    showSearch(query);
    open();

    expect(queryOfLink(component.url())).toEqual(query);
  });

  it('should rebuild the link when the query changes in the builder', () => {
    showSearch(query);
    open();
    const changed: TextSearch = {type: SearchQueryTypes.keyword, value: 'fireworks'};
    component.searchQueryDTO.set(changed);
    component.onQueryChange();

    expect(queryOfLink(component.url())).toEqual(changed);
  });

  // a link that a person copies into a photo frame or a chat: no raw quotes or braces
  it('should build a valid, url encoded link', () => {
    showDirectory('./Holiday 2024/', 'Árvíztűrő');
    open();

    const path = component.url().substring(prefix.length);
    expect(path).toBe(encodeURIComponent(decodeURIComponent(path)));
    expect(() => new URL(component.url())).not.toThrow();
    expect(path).not.toMatch(/[{}"\s]/);
  });
});
