import {ComponentFixture, TestBed} from '@angular/core/testing';
import {ActivatedRoute, provideRouter} from '@angular/router';
import {BehaviorSubject, Observable, of} from 'rxjs';
import {ChangeDetectorRef} from '@angular/core';
import {provideHttpClient, withInterceptorsFromDi} from '@angular/common/http';
import {provideHttpClientTesting} from '@angular/common/http/testing';
import {DatePipe} from '@angular/common';

import {GalleryComponent} from './gallery.component';
import {ContentLoaderService} from './contentLoader.service';
import {ContentService} from './content.service';
import {AuthenticationService} from '../../model/network/authentication.service';
import {ShareService} from './share.service';
import {NavigationService} from '../../model/navigation.service';
import {FilterService} from './filter/filter.service';
import {GallerySortingService} from './navigator/sorting.service';
import {PiTitleService} from '../../model/pi-title.service';
import {GPXFilesFilterPipe} from '../../pipes/GPXFilesFilterPipe';
import {MDFilesFilterPipe} from '../../pipes/MDFilesFilterPipe';
import {Config} from '../../../../common/config/public/Config';
import {LeafletMarkerClusterModule} from '@bluehalo/ngx-leaflet-markercluster';
import {GalleryCacheService} from './cache.gallery.service';
import {ContentWrapperWithError} from '../../../../common/entities/ContentWrapper';
import {FullScreenService} from './fullscreen.service';
import {OverlayService} from './overlay.service';
import {provideNoopAnimations} from '@angular/platform-browser/animations';
import {QueryService} from '../../model/query.service';
import {NotificationService} from '../../model/notification.service';
import {GalleryNavigatorService} from './navigator/navigator.service';
import {MediaButtonModalService} from './grid/photo/media-button-modal/media-button-modal.service';
import {SortingMethod} from '../../../../common/entities/SortingMethods';
import {SearchQueryParserService} from './search/search-query-parser.service';
import {BlogService, GroupedMarkdown} from './blog/blog.service';
import {UploaderService, UploadProgress} from './uploader/uploader.service';


// Mock services
class MockContentLoaderService {
  content = new BehaviorSubject<ContentWrapperWithError>({} as ContentWrapperWithError);
  loadDirectory = jasmine.createSpy('loadDirectory');
  search = jasmine.createSpy('search').and.returnValue(Promise.resolve());

  constructor(private initialContent: ContentWrapperWithError = null) {
    if (initialContent) {
      this.content.next(initialContent);
    }
  }
}

class MockContentService {
  sortedFilteredContent = new BehaviorSubject(null);
}

class MockAuthenticationService {
  user = new BehaviorSubject(null); // Add this line
  isAuthenticated = jasmine.createSpy('isAuthenticated').and.returnValue(true);
  canSearch = jasmine.createSpy('canSearch').and.returnValue(true);
  isAuthorized = jasmine.createSpy('isAuthorized').and.returnValue(true);
  logout = jasmine.createSpy('logout'); // Also add logout method if needed
}

class MockShareService {
  sharingSubject = new BehaviorSubject(null);
  currentSharing = new BehaviorSubject(null);

  wait = jasmine.createSpy('wait').and.returnValue(Promise.resolve());
  isSharing = jasmine.createSpy('isSharing').and.returnValue(false);
  getSharingKey = jasmine.createSpy('getSharingKey').and.returnValue('test-key');
}

class MockNavigationService {
  toLogin = jasmine.createSpy('toLogin').and.returnValue(Promise.resolve(true));
  toGallery = jasmine.createSpy('toGallery').and.returnValue(Promise.resolve(true));
}

class MockFilterService {
  applyFilters = jasmine.createSpy('applyFilters').and.returnValue(of(null));
}

class MockCacheService {
  getThemeMode(): any {
    return null;
  }

  setThemeMode() {
  }
}

class MockBlogService{
  getMarkDowns(date: Date): Observable<GroupedMarkdown[]>{
    return of([]);
  }
}


class MockGallerySortingService {
  sorting = new BehaviorSubject({} as SortingMethod);
  grouping = new BehaviorSubject({} as SortingMethod);
  applySorting = jasmine.createSpy('applySorting').and.returnValue(of(null));
  isDefaultSortingAndGrouping = jasmine.createSpy('isDefaultSortingAndGrouping').and.returnValue(of(true));
}

class MockPiTitleService {
  setSearchTitle = jasmine.createSpy('setSearchTitle');
  setDirectoryTitle = jasmine.createSpy('setDirectoryTitle');
}

class MockGPXFilesFilterPipe {
  transform = jasmine.createSpy('transform').and.returnValue([]);
}

class MockMDFilesFilterPipe {
  transform = jasmine.createSpy('transform').and.returnValue([]);
}

class MockRouter {
  navigate = jasmine.createSpy('navigate').and.returnValue(Promise.resolve(true));
}


class MockUploaderService{
  public uploadProgress: unknown[] = [];
}


describe('GalleryComponent', () => {
  let component: GalleryComponent;
  let fixture: ComponentFixture<GalleryComponent>;
  let mockContentLoader: MockContentLoaderService;
  let mockAuthService: MockAuthenticationService;
  let mockShareService: MockShareService;
  let mockCacheService: MockCacheService;

  const setUp = async () => {
    // Reset Config to default state
    Config.load();
    Config.Server.languages = ['en'];

    mockContentLoader = new MockContentLoaderService();
    mockAuthService = new MockAuthenticationService();
    mockShareService = new MockShareService();
    mockCacheService = new MockCacheService();

    await TestBed.configureTestingModule({
      imports: [GalleryComponent],
      providers: [
        ChangeDetectorRef,
        DatePipe,
        {provide: GalleryCacheService, useValue: mockCacheService},
        {provide: ContentLoaderService, useValue: mockContentLoader},
        {provide: ContentService, useClass: MockContentService},
        {provide: AuthenticationService, useValue: mockAuthService},
        {provide: ShareService, useValue: mockShareService},
        {provide: NavigationService, useValue: MockNavigationService},
        {provide: FilterService, useClass: MockFilterService},
        {provide: GallerySortingService, useClass: MockGallerySortingService},
        {provide: PiTitleService, useClass: MockPiTitleService},
        {provide: GPXFilesFilterPipe, useClass: MockGPXFilesFilterPipe},
        {provide: BlogService, useClass: MockBlogService},
        {provide: MDFilesFilterPipe, useClass: MockMDFilesFilterPipe},
        {provide: UploaderService, useClass: MockUploaderService},
        {provide: FullScreenService, useValue: jasmine.createSpyObj('FullScreenService', ['mock'])},
        {provide: OverlayService, useValue: jasmine.createSpyObj('OverlayService', ['mock'])},
        {provide: QueryService, useValue: jasmine.createSpyObj('QueryService', ['getParams', 'getMediaStringId', 'getParamsForDirs'])},
        {provide: NotificationService, useValue: jasmine.createSpyObj('NotificationService ', ['mock'])},
        {
          provide: GalleryNavigatorService, useValue: jasmine.createSpyObj('GalleryNavigatorService ', [], {
            isDefaultGridSize: () => true,
            girdSize: {
              subscribe: () => {
              },
              unsubscribe: () => {
              }
            }
          })
        },
        {
          provide: MediaButtonModalService, useValue: jasmine.createSpyObj('MediaButtonModalService ', [], {
            modalData: {
              subscribe: () => {
              }
            }
          })
        },
        {provide: SearchQueryParserService, useValue: jasmine.createSpyObj('SearchQueryParserService', [], {stringify: () => ''})},
        {
          provide: ActivatedRoute,
          useValue: {
            params: of({}),
            queryParams: of({})
          }
        },
        LeafletMarkerClusterModule,
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideNoopAnimations(),
        provideRouter([])
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(GalleryComponent);
    component = fixture.componentInstance;
  };

  beforeEach(setUp);

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with default values', () => {
    expect(component.showSearchBar).toBeFalse();
    expect(component.showShare).toBeFalse();
    expect(component.showRandomPhotoBuilder).toBeFalse();
    expect(component.blogOpen).toBe(Config.Gallery.TopBlogStartsOpen);
    expect(component.mapEnabled).toBe(Config.Map.enabled);
  });

  describe('ContentWrapper getter', () => {
    it('should return the current content from contentLoader', () => {
      const testContent = {} as ContentWrapperWithError;
      testContent.directory = {name: 'test', path: 'test'} as any;
      mockContentLoader.content.next(testContent);

      expect(component.ContentWrapper).toBe(testContent);
    });

    it('should return null when contentLoader has no content', () => {
      mockContentLoader.content.next(null);
      expect(component.ContentWrapper).toBeNull();
    });
  });

  describe('when caching is disabled', () => {
    beforeEach(async () => {
      // Reset TestBed before reconfiguring
      TestBed.resetTestingModule();
      // Simulate caching disabled scenario
      Config.Gallery.enableCache = false;
      await setUp();
    });

    afterEach(() => {
      // Reset config after each test in this describe block
      Config.Gallery.enableCache = true;
    });


    it('should handle null ContentWrapper gracefully', () => {
      // Simulate the scenario when cache is disabled and ContentWrapper is null
      mockContentLoader.content.next(null);
      fixture.detectChanges();

      expect(component.ContentWrapper).toBeNull();
      expect(() => fixture.detectChanges()).not.toThrow();
    });

    it('should not crash when accessing ContentWrapper properties with null value', () => {
      mockContentLoader.content.next(null);
      fixture.detectChanges();

      // These should not throw errors due to the null checks in the template
      expect(() => {
        const hasError = component.ContentWrapper?.error;
        const hasDirectory = component.ContentWrapper?.directory;
        const hasSearchResult = component.ContentWrapper?.searchResult;
      }).not.toThrow();
    });

    it('should render template correctly with null ContentWrapper', () => {
      mockContentLoader.content.next(null);
      fixture.detectChanges();

      const compiled = fixture.nativeElement;

      // Main content container should not be visible when ContentWrapper is null
      const mainContainer = compiled.querySelector('.app-gallery-body');
      console.log(mainContainer);
      expect(mainContainer).toBeNull();

      // Spinner container should also not be visible
      const spinnerContainer = compiled.querySelector('.spinner-container');
      expect(spinnerContainer).toBeNull();
    });

    it('should show main content when ContentWrapper is not null', () => {
      const contentWrapper = {} as ContentWrapperWithError;
      contentWrapper.directory = {name: 'test', path: 'test'} as any;
      mockContentLoader.content.next(contentWrapper);
      fixture.detectChanges();

      const compiled = fixture.nativeElement;
      const mainContainer = compiled.querySelector('.app-gallery-body');
      expect(mainContainer).toBeTruthy();
    });
  });

  describe('error handling', () => {
    it('should display error message when ContentWrapper has error', () => {
      const contentWrapper = {} as ContentWrapperWithError;
      contentWrapper.error = 'Test error message';
      mockContentLoader.content.next(contentWrapper);
      fixture.detectChanges();

      const compiled = fixture.nativeElement;
      const errorAlert = compiled.querySelector('.alert-danger');
      expect(errorAlert).toBeTruthy();
      expect(errorAlert.textContent.trim()).toBe('Test error message');
    });

    it('should not show error alert when there is no error', () => {
      const contentWrapper = {} as ContentWrapperWithError;
      contentWrapper.directory = {name: 'test', path: 'test'} as any;
      mockContentLoader.content.next(contentWrapper);
      fixture.detectChanges();

      const compiled = fixture.nativeElement;
      const errorAlert = compiled.querySelector('.alert-danger');
      expect(errorAlert).toBeNull();
    });
  });

  describe('content display', () => {
    it('should show directory content when available', () => {
      const contentWrapper = {} as ContentWrapperWithError;
      contentWrapper.directory = {
        name: 'test',
        path: 'test',
        directories: [],
        media: [],
        metaFile: []
      } as any;
      mockContentLoader.content.next(contentWrapper);

      component.directoryContent = {
        directories: [],
        mediaGroups: [],
        metaFile: []
      };

      fixture.detectChanges();

      const compiled = fixture.nativeElement;
      const galleryGrid = compiled.querySelector('app-gallery-grid');
      expect(galleryGrid).toBeTruthy();
    });

    it('should show search result when available', () => {
      const contentWrapper = {} as ContentWrapperWithError;
      contentWrapper.searchResult = {
        media: [],
        directories: [],
        resultOverflow: false
      } as any;
      mockContentLoader.content.next(contentWrapper);
      fixture.detectChanges();

      const compiled = fixture.nativeElement;
      const galleryGrid = compiled.querySelector('app-gallery-grid');
      expect(galleryGrid).toBeTruthy();
    });

    it('should show search result overflow warning when applicable', () => {
      const contentWrapper = {} as ContentWrapperWithError;
      contentWrapper.searchResult = {
        media: [],
        directories: [],
        resultOverflow: true
      } as any;
      mockContentLoader.content.next(contentWrapper);
      fixture.detectChanges();

      const compiled = fixture.nativeElement;
      const overflowAlert = compiled.querySelector('.alert-info');
      expect(overflowAlert).toBeTruthy();
      expect(overflowAlert.textContent).toContain('Too many results');
    });
  });

  describe('spinner display', () => {
    it('should show spinner when directory is partial', () => {
      const contentWrapper = {} as ContentWrapperWithError;
      contentWrapper.directory = {
        name: 'test',
        path: 'test',
        isPartial: true
      } as any;
      mockContentLoader.content.next(contentWrapper);
      fixture.detectChanges();

      const compiled = fixture.nativeElement;
      const spinner = compiled.querySelector('.spinner');
      expect(spinner).toBeTruthy();
    });

    it('should not show spinner when directory is complete', () => {
      const contentWrapper = {} as ContentWrapperWithError;
      contentWrapper.directory = {
        name: 'test',
        path: 'test',
        isPartial: false
      } as any;
      mockContentLoader.content.next(contentWrapper);
      fixture.detectChanges();

      const compiled = fixture.nativeElement;
      const spinner = compiled.querySelector('.spinner');
      expect(spinner).toBeNull();
    });

    it('should not show spinner when there is an error', () => {
      const contentWrapper = {} as ContentWrapperWithError;
      contentWrapper.error = 'Test error';
      mockContentLoader.content.next(contentWrapper);
      fixture.detectChanges();

      const compiled = fixture.nativeElement;
      const spinner = compiled.querySelector('.spinner');
      expect(spinner).toBeNull();
    });

    it('should not show spinner when there is search result', () => {
      const contentWrapper = {} as ContentWrapperWithError;
      contentWrapper.searchResult = {
        media: [],
        directories: [],
        resultOverflow: false
      } as any;
      mockContentLoader.content.next(contentWrapper);
      fixture.detectChanges();

      const compiled = fixture.nativeElement;
      const spinner = compiled.querySelector('.spinner');
      expect(spinner).toBeNull();
    });
  });

  describe('authentication and permissions', () => {
    it('should set showSearchBar based on authentication', async () => {
      mockAuthService.canSearch.and.returnValue(true);
      await component.ngOnInit();
      expect(component.showSearchBar).toBeTrue();

      mockAuthService.canSearch.and.returnValue(false);
      await component.ngOnInit();
      expect(component.showSearchBar).toBeFalse();
    });

    it('should set showShare based on config and authorization', async () => {
      Config.Sharing.enabled = true;
      mockAuthService.isAuthorized.and.returnValue(true);
      await component.ngOnInit();
      expect(component.showShare).toBeTrue();

      Config.Sharing.enabled = false;
      await component.ngOnInit();
      expect(component.showShare).toBeFalse();
    });

    it('should set showRandomPhotoBuilder based on config and authorization', async () => {
      Config.RandomPhoto.enabled = true;
      mockAuthService.isAuthorized.and.returnValue(true);
      await component.ngOnInit();
      expect(component.showRandomPhotoBuilder).toBeTrue();

      Config.RandomPhoto.enabled = false;
      await component.ngOnInit();
      expect(component.showRandomPhotoBuilder).toBeFalse();
    });
  });

  describe('component lifecycle', () => {
    it('should properly clean up subscriptions on destroy', () => {
      component.ngOnDestroy();
      // If there were subscription errors, they would be thrown here
      expect(() => component.ngOnDestroy()).not.toThrow();
    });
  });

  describe('ShowMarkDown getter', () => {
    it('should return true when markdown is enabled and metaFile has MD files', () => {
      Config.MetaFile.markdown = true;
      component.directoryContent = {
        directories: [],
        mediaGroups: [],
        metaFile: [{name: 'README.md'} as any]
      };

      const mockMDPipe = TestBed.inject(MDFilesFilterPipe) as any;
      mockMDPipe.transform.and.returnValue([{name: 'README.md'}]);

      expect(component.ShowMarkDown).toBeTrue();
    });

    it('should return false when markdown is disabled', () => {
      Config.MetaFile.markdown = false;
      component.directoryContent = {
        directories: [],
        mediaGroups: [],
        metaFile: [{name: 'README.md'} as any]
      };

      expect(component.ShowMarkDown).toBeFalse();
    });
  });

  describe('ShowMap getter', () => {
    it('should return true when photos have GPS data and map is enabled', () => {
      component.isPhotoWithLocation = true;
      expect(component.ShowMap).toBeTrue();
    });

    it('should return false when map is disabled', () => {
      const originalMapEnabled = component.mapEnabled;
      (component as any).mapEnabled = false;
      component.isPhotoWithLocation = true;

      expect(component.ShowMap).toBeFalse();

      (component as any).mapEnabled = originalMapEnabled;
    });
  });
});
