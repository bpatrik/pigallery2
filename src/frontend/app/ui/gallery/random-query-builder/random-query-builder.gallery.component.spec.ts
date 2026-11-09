import '../../../../../common/config/public/Config';
import {TestBed} from '@angular/core/testing';
import {ActivatedRoute, Params} from '@angular/router';
import {BsModalService} from 'ngx-bootstrap/modal';
import {BehaviorSubject} from 'rxjs';
import {RandomQueryBuilderGalleryComponent} from './random-query-builder.gallery.component';
import {ContentLoaderService} from '../contentLoader.service';
import {NotificationService} from '../../../model/notification.service';
import {SearchQueryParserService} from '../search/search-query-parser.service';
import {Config} from '../../../../../common/config/public/Config';
import {SearchQueryUtils} from '../../../../../common/SearchQueryUtils';
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
  let params: BehaviorSubject<Params>;
  let originalPublicUrl: string;
  let originalUrlBase: string;

  const query: ANDSearchQuery = {
    type: SearchQueryTypes.AND,
    list: [
      {type: SearchQueryTypes.directory, matchType: TextSearchQueryMatchTypes.exact_match, value: './Nyaralás 2024'} as TextSearch,
      {type: SearchQueryTypes.person, value: 'Árvíztűrő Ödön'} as TextSearch,
    ]
  };

  beforeEach(() => {
    originalPublicUrl = Config.Server.publicUrl;
    originalUrlBase = Config.Server.urlBase;
    Config.Server.publicUrl = 'https://photos.example.com/';
    Config.Server.urlBase = '/myGallery';
    params = new BehaviorSubject<Params>({});
    TestBed.configureTestingModule({
      providers: [
        {provide: ContentLoaderService, useValue: {}},
        {provide: NotificationService, useValue: {}},
        {provide: SearchQueryParserService, useValue: {}},
        {provide: ActivatedRoute, useValue: {params}},
        {provide: BsModalService, useValue: {}},
      ]
    });
    component = TestBed.runInInjectionContext(() => new RandomQueryBuilderGalleryComponent());
  });

  afterEach(() => {
    component.ngOnDestroy();
    Config.Server.publicUrl = originalPublicUrl;
    Config.Server.urlBase = originalUrlBase;
  });

  /**
   * The search query that the random endpoint gets from the link (as express decodes the path parameter).
   */
  const queryOfLink = (link: string): SearchQueryDTO | null => {
    const prefix = 'https://photos.example.com/myGallery/pgapi/gallery/random/';
    expect(link.startsWith(prefix), link).toBe(true);
    return SearchQueryUtils.parseURLifiedQuery(decodeURIComponent(link.substring(prefix.length)));
  };

  it('should build the random link of the query of the current search', () => {
    params.next({qs: SearchQueryUtils.urlify(query)});

    expect(queryOfLink(component.url())).toEqual(query);
  });

  it('should rebuild the link when the query changes in the builder', () => {
    params.next({qs: SearchQueryUtils.urlify(query)});
    const changed: TextSearch = {type: SearchQueryTypes.keyword, value: 'tűzijáték'};
    component.searchQueryDTO.set(changed);
    component.onQueryChange();

    expect(queryOfLink(component.url())).toEqual(changed);
  });

  it('should keep the default empty query outside of a search', () => {
    component.onQueryChange();

    expect(queryOfLink(component.url())).toEqual({type: SearchQueryTypes.any_text, value: ''});
  });
});
