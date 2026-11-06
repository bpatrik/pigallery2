import {ComponentFixture, TestBed} from '@angular/core/testing';
import {ActivatedRoute, provideRouter} from '@angular/router';
import {BehaviorSubject, of} from 'rxjs';
import {ChangeDetectorRef, signal} from '@angular/core';
import {provideHttpClient, withXhr} from '@angular/common/http';
import {provideHttpClientTesting} from '@angular/common/http/testing';

import {GalleryComponent} from './gallery.component';
import {ContentLoaderService} from './contentLoader.service';
import {ContentService} from './content.service';
import {AuthenticationService} from '../../model/network/authentication.service';
import {ShareService} from './share.service';
import {NavigationService} from '../../model/navigation.service';
import {FilterService} from './filter/filter.service';
import {GallerySortingService, GroupedDirectoryContent} from './navigator/sorting.service';
import {PiTitleService} from '../../model/pi-title.service';
import {Config} from '../../../../common/config/public/Config';
import {LeafletMarkerClusterModule} from '@bluehalo/ngx-leaflet-markercluster';
import {GalleryCacheService} from './cache.gallery.service';
import {ContentWrapperWithError} from '../../../../common/entities/ContentWrapper';
import {FullScreenService} from './fullscreen.service';
import {OverlayService} from './overlay.service';
import {QueryService} from '../../model/query.service';
import {NotificationService} from '../../model/notification.service';
import {GalleryNavigatorService} from './navigator/navigator.service';
import {MediaButtonModalService} from './grid/photo/media-button-modal/media-button-modal.service';
import {SortingMethod} from '../../../../common/entities/SortingMethods';
import {GridSizes} from '../../../../common/entities/GridSizes';
import {PhotoDTO} from '../../../../common/entities/PhotoDTO';
import {SearchQueryParserService} from './search/search-query-parser.service';
import {BlogService, GroupedMarkdown} from './blog/blog.service';
import {UploaderService} from './uploader/uploader.service';
import {ThemeService} from '../../model/theme.service';
import {DeviceHelper} from '../../model/device.helper';
import {provideIcons} from '@ng-icons/core';
import {appIcons} from '../../icons';


// Mock services
class MockContentLoaderService {
  readonly content = signal<ContentWrapperWithError | null>({} as ContentWrapperWithError);
  loadDirectory = vi.fn();
  search = vi.fn().mockReturnValue(Promise.resolve());

  constructor(private initialContent: ContentWrapperWithError | null = null) {
    if (initialContent) {
      this.content.set(initialContent);
    }
  }
}

class MockContentService {
  readonly sortedFilteredContent = signal<GroupedDirectoryContent | null>(null);
}

class MockAuthenticationService {
  readonly user = signal(null);
  isAuthenticated = vi.fn().mockReturnValue(true);
  canSearch = vi.fn().mockReturnValue(true);
  isAuthorized = vi.fn().mockReturnValue(true);
  isAdmin = vi.fn().mockReturnValue(false);
  logout = vi.fn(); // Also add logout method if needed
}

class MockShareService {
  readonly sharing = signal(null);
  currentSharing = new BehaviorSubject(null);

  wait = vi.fn().mockReturnValue(Promise.resolve());
  isSharing = vi.fn().mockReturnValue(false);
  getSharingKey = vi.fn().mockReturnValue('test-key');
}

class MockNavigationService {
  readonly url = signal('/gallery');
  toLogin = vi.fn().mockReturnValue(Promise.resolve(true));
  toGallery = vi.fn().mockReturnValue(Promise.resolve(true));
}

class MockFilterService {
  readonly filteredContent = signal({content: null, filters: {areFiltersActive: false}});
}

class MockCacheService {
  getThemeMode(): any {
    return null;
  }

  setThemeMode = vi.fn();
}

class MockBlogService{
  getMarkDowns(): GroupedMarkdown[] {
    return [];
  }
}


class MockGallerySortingService {
  readonly sorting = signal({} as SortingMethod);
  readonly grouping = signal({} as SortingMethod);
  isDefaultSortingAndGrouping = vi.fn().mockReturnValue(of(true));
}

class MockPiTitleService {
  setSearchTitle = vi.fn();
  setDirectoryTitle = vi.fn();
}

class MockUploaderService{
  public uploadProgress: unknown[] = [];
}

// the map reads the dark mode; the real service needs window.matchMedia, which jsdom lacks
class MockThemeService {
  readonly darkMode = signal(false);
}


describe('GalleryComponent', () => {
  let component: GalleryComponent;
  let fixture: ComponentFixture<GalleryComponent>;
  let mockContentLoader: MockContentLoaderService;
  let mockAuthService: MockAuthenticationService;
  let mockShareService: MockShareService;
  let mockCacheService: MockCacheService;

  const setSortedContent = (content: GroupedDirectoryContent): void =>
    (TestBed.inject(ContentService) as unknown as MockContentService).sortedFilteredContent.set(content);

  const setUp = async () => {
    // Reset Config to default state
    Config.load();
    Config.Server.languages = ['en'];
    // the frame asks for it; it needs window.matchMedia, which jsdom lacks
    vi.spyOn(DeviceHelper, 'isTouchDevice').mockReturnValue(false);

    mockContentLoader = new MockContentLoaderService();
    mockAuthService = new MockAuthenticationService();
    mockShareService = new MockShareService();
    mockCacheService = new MockCacheService();

    await TestBed.configureTestingModule({
      imports: [GalleryComponent],
      providers: [
        provideIcons(appIcons),
        ChangeDetectorRef,
        {provide: GalleryCacheService, useValue: mockCacheService},
        {provide: ContentLoaderService, useValue: mockContentLoader},
        {provide: ContentService, useClass: MockContentService},
        {provide: AuthenticationService, useValue: mockAuthService},
        {provide: ShareService, useValue: mockShareService},
        {provide: NavigationService, useClass: MockNavigationService},
        {provide: FilterService, useClass: MockFilterService},
        {provide: GallerySortingService, useClass: MockGallerySortingService},
        {provide: PiTitleService, useClass: MockPiTitleService},
        {provide: BlogService, useClass: MockBlogService},
        {provide: UploaderService, useClass: MockUploaderService},
        {provide: ThemeService, useClass: MockThemeService},
        {provide: FullScreenService, useValue: {mock: vi.fn()}},
        {provide: OverlayService, useValue: {mock: vi.fn()}},
        {provide: QueryService, useValue: {params: signal({}), getParams: vi.fn(), getMediaStringId: vi.fn(), getParamsForDirs: vi.fn()}},
        {provide: NotificationService, useValue: {mock: vi.fn()}},
        {
          provide: GalleryNavigatorService, useValue: {
            isDefaultGridSize: () => true,
            girdSize: signal(GridSizes.medium)
          }
        },
        {
          provide: MediaButtonModalService, useValue: {
            modalData: signal(null)
          }
        },
        {provide: SearchQueryParserService, useValue: {stringify: () => ''}},
        {
          provide: ActivatedRoute,
          useValue: {
            params: of({}),
            queryParams: of({})
          }
        },
        LeafletMarkerClusterModule,
        provideHttpClient(withXhr()),
        provideHttpClientTesting(),
        provideRouter([])
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(GalleryComponent);
    component = fixture.componentInstance;
  };

  beforeEach(setUp);

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with default values', () => {
    expect(component.showSearchBar()).toBe(false);
    expect(component.showShare()).toBe(false);
    expect(component.showRandomPhotoBuilder()).toBe(false);
    expect(component.blogOpen).toBe(Config.Gallery.TopBlogStartsOpen);
    expect(component.mapEnabled).toBe(Config.Map.enabled);
  });

  describe('ContentWrapper getter', () => {
    it('should return the current content from contentLoader', () => {
      const testContent = {} as ContentWrapperWithError;
      testContent.directory = {name: 'test', path: 'test'} as any;
      mockContentLoader.content.set(testContent);

      expect(component.ContentWrapper).toBe(testContent);
    });

    it('should return null when contentLoader has no content', () => {
      mockContentLoader.content.set(null);
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
      mockContentLoader.content.set(null);
      fixture.detectChanges();

      expect(component.ContentWrapper).toBeNull();
      expect(() => fixture.detectChanges()).not.toThrow();
    });

    it('should not crash when accessing ContentWrapper properties with null value', () => {
      mockContentLoader.content.set(null);
      fixture.detectChanges();

      // These should not throw errors due to the null checks in the template
      expect(() => {
        void component.ContentWrapper?.error;
        void component.ContentWrapper?.directory;
        void component.ContentWrapper?.searchResult;
      }).not.toThrow();
    });

    it('should render template correctly with null ContentWrapper', () => {
      mockContentLoader.content.set(null);
      fixture.detectChanges();

      const compiled = fixture.nativeElement;

      // Main content container should not be visible when ContentWrapper is null
      const mainContainer = compiled.querySelector('.app-gallery-body');
      expect(mainContainer).toBeNull();

      // Spinner container should also not be visible
      const spinnerContainer = compiled.querySelector('.spinner-container');
      expect(spinnerContainer).toBeNull();
    });

    it('should show main content when ContentWrapper is not null', () => {
      const contentWrapper = {} as ContentWrapperWithError;
      contentWrapper.directory = {name: 'test', path: 'test'} as any;
      mockContentLoader.content.set(contentWrapper);
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
      mockContentLoader.content.set(contentWrapper);
      fixture.detectChanges();

      const compiled = fixture.nativeElement;
      const errorAlert = compiled.querySelector('.alert-danger');
      expect(errorAlert).toBeTruthy();
      expect(errorAlert.textContent.trim()).toBe('Test error message');
    });

    it('should not show error alert when there is no error', () => {
      const contentWrapper = {} as ContentWrapperWithError;
      contentWrapper.directory = {name: 'test', path: 'test'} as any;
      mockContentLoader.content.set(contentWrapper);
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
      mockContentLoader.content.set(contentWrapper);

      setSortedContent({
        directories: [],
        mediaGroups: [],
        metaFile: []
      });

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
      mockContentLoader.content.set(contentWrapper);
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
      mockContentLoader.content.set(contentWrapper);
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
      mockContentLoader.content.set(contentWrapper);
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
      mockContentLoader.content.set(contentWrapper);
      fixture.detectChanges();

      const compiled = fixture.nativeElement;
      const spinner = compiled.querySelector('.spinner');
      expect(spinner).toBeNull();
    });

    it('should not show spinner when there is an error', () => {
      const contentWrapper = {} as ContentWrapperWithError;
      contentWrapper.error = 'Test error';
      mockContentLoader.content.set(contentWrapper);
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
      mockContentLoader.content.set(contentWrapper);
      fixture.detectChanges();

      const compiled = fixture.nativeElement;
      const spinner = compiled.querySelector('.spinner');
      expect(spinner).toBeNull();
    });
  });

  describe('authentication and permissions', () => {
    it('should set showSearchBar based on authentication', async () => {
      mockAuthService.canSearch.mockReturnValue(true);
      await component.ngOnInit();
      expect(component.showSearchBar()).toBe(true);

      mockAuthService.canSearch.mockReturnValue(false);
      await component.ngOnInit();
      expect(component.showSearchBar()).toBe(false);
    });

    it('should set showShare based on config and authorization', async () => {
      Config.Sharing.enabled = true;
      mockAuthService.isAuthorized.mockReturnValue(true);
      await component.ngOnInit();
      expect(component.showShare()).toBe(true);

      Config.Sharing.enabled = false;
      await component.ngOnInit();
      expect(component.showShare()).toBe(false);
    });

    it('should set showRandomPhotoBuilder based on config and authorization', async () => {
      Config.RandomPhoto.enabled = true;
      mockAuthService.isAuthorized.mockReturnValue(true);
      await component.ngOnInit();
      expect(component.showRandomPhotoBuilder()).toBe(true);

      Config.RandomPhoto.enabled = false;
      await component.ngOnInit();
      expect(component.showRandomPhotoBuilder()).toBe(false);
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
      setSortedContent({
        directories: [],
        mediaGroups: [],
        metaFile: [{name: 'README.md'} as any]
      });

      expect(component.ShowMarkDown).toBe(true);
    });

    it('should return false when markdown is disabled', () => {
      Config.MetaFile.markdown = false;
      setSortedContent({
        directories: [],
        mediaGroups: [],
        metaFile: [{name: 'README.md'} as any]
      });

      expect(component.ShowMarkDown).toBe(false);
    });
  });

  describe('ShowMap getter', () => {
    it('should return true when photos have GPS data and map is enabled', () => {
      setSortedContent({
        directories: [],
        metaFile: [],
        mediaGroups: [{name: '', media: [{metadata: {positionData: {GPSData: {latitude: 47.5, longitude: 19.04}}}} as PhotoDTO]}]
      });
      expect(component.ShowMap).toBe(true);
    });

    it('should return false when map is disabled', () => {
      const originalMapEnabled = component.mapEnabled;
      (component as any).mapEnabled = false;
      setSortedContent({
        directories: [],
        metaFile: [],
        mediaGroups: [{name: '', media: [{metadata: {positionData: {GPSData: {latitude: 47.5, longitude: 19.04}}}} as PhotoDTO]}]
      });

      expect(component.ShowMap).toBe(false);

      (component as any).mapEnabled = originalMapEnabled;
    });
  });
});
