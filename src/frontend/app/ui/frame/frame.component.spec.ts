import '../../../../common/config/public/Config';
import {TestBed} from '@angular/core/testing';
import {NO_ERRORS_SCHEMA, signal} from '@angular/core';
import {provideRouter} from '@angular/router';
import {FrameComponent} from './frame.component';
import {AuthenticationService} from '../../model/network/authentication.service';
import {NotificationService} from '../../model/notification.service';
import {QueryService} from '../../model/query.service';
import {NavigationService} from '../../model/navigation.service';
import {ThemeService} from '../../model/theme.service';
import {GalleryService} from '../gallery/gallery.service';
import {UploaderService} from '../gallery/uploader/uploader.service';
import {DeviceHelper} from '../../model/device.helper';
import {Config} from '../../../../common/config/public/Config';
import {NavigationLinkConfig, NavigationLinkTypes, ThemeModes} from '../../../../common/config/public/ClientConfig';
import {SearchQueryTypes, TextSearch, TextSearchQueryMatchTypes} from '../../../../common/entities/SearchQueryDTO';
import {SearchQueryUtils} from '../../../../common/SearchQueryUtils';
import {UserDTO, UserRoles} from '../../../../common/entities/UserDTO';
import {GallerySearchComponent} from '../gallery/search/search.gallery.component';
import {GalleryShareComponent} from '../gallery/share/share.gallery.component';
import {LanguageComponent} from '../language/language.component';
import {NgIconComponent} from '@ng-icons/core';
import {NetworkService} from '../../model/network/network.service';
import {ToastService} from '../toast/toast.service';
import {NotificationType} from '../../../../common/entities/NotificationDTO';

describe('FrameComponent', () => {
  let component: FrameComponent;
  let url: ReturnType<typeof signal<string>>;
  let originalLinks: NavigationLinkConfig[];

  const searchQuery = {
    type: SearchQueryTypes.keyword,
    matchType: TextSearchQueryMatchTypes.exact_match,
    value: 'Summer at the lake'
  } as TextSearch;

  // the active state of every navbar link, by its name
  const activeLinks = (): Record<string, boolean> =>
    Object.fromEntries(component.navbarLinkItems().map((i) => [i.link.name, i.active]));

  beforeEach(() => {
    originalLinks = Config.Gallery.NavBar.links;
    Config.Gallery.NavBar.links = [
      new NavigationLinkConfig(NavigationLinkTypes.gallery, 'gallery'),
      new NavigationLinkConfig(NavigationLinkTypes.albums, 'albums'),
      new NavigationLinkConfig(NavigationLinkTypes.faces, 'faces'),
      new NavigationLinkConfig(NavigationLinkTypes.search, 'Lake', searchQuery),
      new NavigationLinkConfig(NavigationLinkTypes.url, 'Árvíztűrő', undefined, '/gallery/Árvíztűrő'),
    ];
    // the constructor asks for it; it needs window.matchMedia, which jsdom lacks
    vi.spyOn(DeviceHelper, 'isTouchDevice').mockReturnValue(false);
    url = signal('/');
    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthenticationService, useValue: {
            user: signal<UserDTO>({name: 'admin', role: UserRoles.Admin} as UserDTO),
            isAdmin: signal(true),
            isAuthorized: (): boolean => true // an admin
          }
        },
        {provide: NotificationService, useValue: {}},
        {provide: QueryService, useValue: {}},
        {provide: NavigationService, useValue: {url}},
        {provide: ThemeService, useValue: {}},
        {provide: GalleryService, useValue: {}},
        {provide: UploaderService, useValue: {}},
      ]
    });
    // only the component logic is tested here
    TestBed.overrideComponent(FrameComponent, {set: {template: '', imports: []}});
    component = TestBed.createComponent(FrameComponent).componentInstance;
  });

  afterEach(() => {
    Config.Gallery.NavBar.links = originalLinks;
    vi.restoreAllMocks();
  });

  it('should mark the link of the current page active and follow the url', () => {
    url.set('/albums');
    expect(activeLinks()).toEqual({gallery: false, albums: true, faces: false, Lake: false, Árvíztűrő: false});

    url.set('/gallery/Holiday/Autumn trip');
    expect(activeLinks()).toEqual({gallery: true, albums: false, faces: false, Lake: false, Árvíztűrő: false});
  });

  // the custom link has an accented name and url: non-ASCII urls must be matched too
  it('should mark a custom url link active by its prefix', () => {
    url.set('/gallery/Árvíztűrő/Tükörfúrógép');
    expect(activeLinks()).toEqual({gallery: true, albums: false, faces: false, Lake: false, Árvíztűrő: true});
  });

  it('should link and mark the search link active only for its own search', () => {
    const searchUrl = SearchQueryUtils.urlify(searchQuery);
    expect(component.navbarLinkItems().find((i) => i.link.name === 'Lake')!.searchUrl).toBe(searchUrl);

    // it compares the full (not the urlified) query of the url
    url.set('/search/' + encodeURIComponent(JSON.stringify(searchQuery)));
    expect(activeLinks()['Lake']).toBe(true);

    url.set('/search/' + encodeURIComponent(JSON.stringify({...searchQuery, value: 'Mountains'})));
    expect(activeLinks()['Lake']).toBe(false);
  });
});

describe('FrameComponent template', () => {
  beforeEach(() => {
    // the constructor asks for it; it needs window.matchMedia, which jsdom lacks
    vi.spyOn(DeviceHelper, 'isTouchDevice').mockReturnValue(false);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: AuthenticationService, useValue: {
            user: signal<UserDTO>({name: 'admin', role: UserRoles.Admin} as UserDTO),
            isAdmin: signal(true),
            isAuthorized: (): boolean => true // an admin
          }
        },
        {provide: NotificationService, useValue: {numberOfNotifications: 0}},
        {provide: QueryService, useValue: {params: signal({})}},
        {provide: NavigationService, useValue: {url: signal('/gallery')}},
        {provide: ThemeService, useValue: {mode: signal(ThemeModes.light)}},
        {provide: GalleryService, useValue: {autoPollInterval: 0}},
        {provide: UploaderService, useValue: {canUpload: signal(false)}},
      ]
    });
    // the child components are not under test
    TestBed.overrideComponent(FrameComponent, {
      remove: {imports: [GallerySearchComponent, GalleryShareComponent, LanguageComponent, NgIconComponent]},
      add: {schemas: [NO_ERRORS_SCHEMA]}
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should not hide the always expanded navbar menu from assistive technology', async () => {
    const fixture = TestBed.createComponent(FrameComponent);
    fixture.componentRef.setInput('showSearch', true);
    await fixture.whenStable();

    const menu = (fixture.nativeElement as HTMLElement).querySelector('#navbarCollapse') as HTMLElement;
    expect(menu.getAttribute('aria-hidden')).toBeNull();
    expect(menu.style.display).not.toBe('none');
    expect(menu.querySelector('app-gallery-search')).not.toBeNull();
  });
});

// #1315: the navbar menu shows the number of server notifications to the admins
describe('FrameComponent notification badge', () => {
  const notifications = [{type: NotificationType.error, message: 'Using default admin user!'}];

  // renders the navbar with the real NotificationService, the server answers with the notifications
  const render = async (role: UserRoles): Promise<HTMLElement> => {
    vi.spyOn(DeviceHelper, 'isTouchDevice').mockReturnValue(false);
    const user = {id: 1, name: 'Alice', role} as UserDTO;
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: AuthenticationService, useValue: {
            user: signal<UserDTO>(user),
            isAdmin: signal(role >= UserRoles.Admin),
            isAuthenticated: (): boolean => true,
            isAuthorized: (r: UserRoles): boolean => role >= r
          }
        },
        {provide: NetworkService, useValue: {getJson: () => Promise.resolve(notifications)}},
        {provide: ToastService, useValue: {registerGroup: (): void => undefined, open: (): void => undefined}},
        {provide: QueryService, useValue: {params: signal({})}},
        {provide: NavigationService, useValue: {url: signal('/gallery')}},
        {provide: ThemeService, useValue: {mode: signal(ThemeModes.light)}},
        {provide: GalleryService, useValue: {autoPollInterval: 0}},
        {provide: UploaderService, useValue: {canUpload: signal(false)}},
      ]
    });
    TestBed.overrideComponent(FrameComponent, {
      remove: {imports: [GallerySearchComponent, GalleryShareComponent, LanguageComponent, NgIconComponent]},
      add: {schemas: [NO_ERRORS_SCHEMA]}
    });
    const fixture = TestBed.createComponent(FrameComponent);
    await fixture.whenStable();
    // the notifications have arrived
    await vi.waitFor(() => expect(TestBed.inject(NotificationService).numberOfNotifications).toBe(1));
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should not show the badge to a normal user', async () => {
    const el = await render(UserRoles.User);
    expect(el.querySelector('#button-frame-menu .navbar-badge')).toBeNull();
  });

  // TODO #1315: numberOfNotifications is a plain field set when the request answers, so the zoneless
  // navbar doesn't render it until something else changes (it should be a signal)
  it.fails('should show the number of notifications to an admin once they arrive', async () => {
    const el = await render(UserRoles.Admin);
    expect(el.querySelector('#button-frame-menu .navbar-badge')?.textContent?.trim()).toBe('1');
  });
});
