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

describe('FrameComponent', () => {
  let component: FrameComponent;
  let url: ReturnType<typeof signal<string>>;
  let originalLinks: NavigationLinkConfig[];

  const searchQuery = {
    type: SearchQueryTypes.keyword,
    matchType: TextSearchQueryMatchTypes.exact_match,
    value: 'Balaton nyár'
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
      new NavigationLinkConfig(NavigationLinkTypes.search, 'Balaton', searchQuery),
      new NavigationLinkConfig(NavigationLinkTypes.url, 'Térkép', undefined, '/gallery/Térkép'),
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
    expect(activeLinks()).toEqual({gallery: false, albums: true, faces: false, Balaton: false, Térkép: false});

    url.set('/gallery/Nyaralás/Őszi kirándulás');
    expect(activeLinks()).toEqual({gallery: true, albums: false, faces: false, Balaton: false, Térkép: false});
  });

  it('should mark a custom url link active by its prefix', () => {
    url.set('/gallery/Térkép/Szeged');
    expect(activeLinks()).toEqual({gallery: true, albums: false, faces: false, Balaton: false, Térkép: true});
  });

  it('should link and mark the search link active only for its own search', () => {
    const searchUrl = SearchQueryUtils.urlify(searchQuery);
    expect(component.navbarLinkItems().find((i) => i.link.name === 'Balaton')!.searchUrl).toBe(searchUrl);

    // it compares the full (not the urlified) query of the url
    url.set('/search/' + encodeURIComponent(JSON.stringify(searchQuery)));
    expect(activeLinks()['Balaton']).toBe(true);

    url.set('/search/' + encodeURIComponent(JSON.stringify({...searchQuery, value: 'Tihany'})));
    expect(activeLinks()['Balaton']).toBe(false);
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
            user: signal<UserDTO>({name: 'Árvíztűrő Tükörfúrógép', role: UserRoles.Admin} as UserDTO),
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
