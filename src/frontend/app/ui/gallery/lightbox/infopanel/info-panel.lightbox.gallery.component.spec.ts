import {ComponentFixture, TestBed} from '@angular/core/testing';
import {signal} from '@angular/core';
import {NgIconsModule} from '@ng-icons/core';
import {ionCalendarOutline, ionImageOutline, ionVideocamOutline} from '@ng-icons/ionicons';

import {InfoPanelLightboxComponent} from './info-panel.lightbox.gallery.component';
import {QueryService} from '../../../../model/query.service';
import {MapService} from '../../map/map.service';
import {AuthenticationService} from '../../../../model/network/authentication.service';
import {ThemeService} from '../../../../model/theme.service';
import {ContentLoaderService} from '../../contentLoader.service';
import {MediaDTO} from '../../../../../../common/entities/MediaDTO';
import {provideRouter} from '@angular/router';
import {provideIcons} from '@ng-icons/core';
import {appIcons} from '../../../../icons';
import {Config} from '../../../../../../common/config/public/Config';
import {SearchQueryUtils} from '../../../../../../common/SearchQueryUtils';
import {SearchQueryDTO, SearchQueryTypes, TextSearch, TextSearchQueryMatchTypes} from '../../../../../../common/entities/SearchQueryDTO';

class MockQueryService {
  getParams() {
    return {};
  }
}

class MockMapService {
  get MapLayer() {
    return {url: ''};
  }

  get DarkMapLayer() {
    return {url: ''};
  }

  readonly ShortAttributions = '';
}

class MockAuthenticationService {
  canSearch() {
    return false;
  }
}

class MockThemeService {
  readonly darkMode = signal(false);
}

class MockContentLoaderService {
  isSearchResult() {
    return false;
  }
}

function makePhoto(overrides: any = {}): MediaDTO {
  return {
    name: 'IMG_7936.HEIC',
    directory: {name: 'vacation', path: '/photos'},
    metadata: {
      size: {width: 4032, height: 3024},
      creationDate: Date.now(),
      fileSize: 2048000,
    },
    ...overrides,
  } as MediaDTO;
}

describe('InfoPanelLightboxComponent - Live Photo', () => {
  let component: InfoPanelLightboxComponent;
  let fixture: ComponentFixture<InfoPanelLightboxComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        InfoPanelLightboxComponent,
        NgIconsModule.withIcons({
          ionImageOutline,
          ionVideocamOutline,
          ionCalendarOutline,
        }),
      ],
      providers: [
        {provide: QueryService, useClass: MockQueryService},
        {provide: MapService, useClass: MockMapService},
        {provide: AuthenticationService, useClass: MockAuthenticationService},
        {provide: ThemeService, useClass: MockThemeService},
        {provide: ContentLoaderService, useClass: MockContentLoaderService},
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(InfoPanelLightboxComponent);
    component = fixture.componentInstance;
  });

  it('should show companion video row when media is a Live Photo', () => {
    fixture.componentRef.setInput('media', makePhoto({
      liveVideoPath: 'vacation/IMG_7936_HEVC.MOV',
      liveVideoInfo: {
        name: 'IMG_7936_HEVC.MOV',
        size: {width: 1920, height: 1080},
        fileSize: 4500000,
        duration: 3000,
      },
    }));
    fixture.detectChanges();

    const rows = fixture.nativeElement.querySelectorAll('.row');
    const videoRow = Array.from<HTMLElement>(rows).find(
      (r: HTMLElement) => r.querySelector('ng-icon[name="ionVideocamOutline"]')
    ) as HTMLElement;
    expect(videoRow).toBeTruthy();
    expect(videoRow.textContent).toContain('IMG_7936_HEVC.MOV');
    expect(videoRow.textContent).toContain('1920');
    expect(videoRow.textContent).toContain('1080');
  });

  it('should not show companion video row for regular photos', () => {
    fixture.componentRef.setInput('media', makePhoto());
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    // Should not have a videocam icon in the file info area
    // (videocam may appear in other sections for regular videos)
    const fileInfoRows = el.querySelectorAll<HTMLElement>('.row[title="File information and properties"], .row[title="Companion video"]');
    let hasCompanionRow = false;
    fileInfoRows.forEach((row: HTMLElement) => {
      if (row.getAttribute('title') === 'Companion video') {
        hasCompanionRow = true;
      }
    });
    expect(hasCompanionRow).toBe(false);
  });

  it('isLivePhoto() should return true when liveVideoPath is set', () => {
    fixture.componentRef.setInput('media', makePhoto({
      liveVideoPath: 'vacation/IMG_7936_HEVC.MOV',
    }));
    expect(component.isLivePhoto()).toBe(true);
  });

  it('isLivePhoto() should return false for regular photos', () => {
    fixture.componentRef.setInput('media', makePhoto());
    expect(component.isLivePhoto()).toBe(false);
  });
});

// CUJ 17: the info panel shows non-ASCII metadata as it is, and its search links find it
describe('InfoPanelLightboxComponent - non-ASCII metadata', () => {
  let fixture: ComponentFixture<InfoPanelLightboxComponent>;
  let el: HTMLElement;

  const photo = makePhoto({
    name: 'Árvíztűrő tükörfúrógép 東京.jpg',
    metadata: {
      size: {width: 4032, height: 3024},
      creationDate: Date.UTC(2015, 5, 12),
      fileSize: 2048000,
      title: 'Őszi túra a Bükkben',
      caption: 'Ünnepi kirándulás – 東京タワー, Kraków',
      keywords: ['Árvíztűrő', '桜', 'Zürich'],
      faces: [
        {name: 'Ödön Ősz', box: {left: 0, top: 0, width: 1, height: 1}},
        {name: '山田太郎', box: {left: 0, top: 0, width: 1, height: 1}},
        // the same person twice: listed once
        {name: 'Ödön Ősz', box: {left: 0, top: 0, width: 1, height: 1}},
      ],
      positionData: {
        city: 'Kraków',
        state: '東京都',
        country: 'Magyarország',
        GPSData: {latitude: 35.6586, longitude: 139.7454},
      },
    },
  });

  beforeEach(async () => {
    // the leaflet map needs a layout, which jsdom lacks; the marker is checked on markerLayer
    Config.Map.enabled = false;
    await TestBed.configureTestingModule({
      imports: [InfoPanelLightboxComponent],
      providers: [
        provideIcons(appIcons),
        provideRouter([]),
        {provide: QueryService, useValue: {params: signal({}), getParams: (): Record<string, string> => ({})}},
        {provide: MapService, useClass: MockMapService},
        {provide: AuthenticationService, useValue: {canSearch: (): boolean => true}},
        {provide: ThemeService, useClass: MockThemeService},
        {provide: ContentLoaderService, useClass: MockContentLoaderService},
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(InfoPanelLightboxComponent);
    fixture.componentRef.setInput('media', photo);
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  });

  afterEach(() => {
    Config.load();
  });

  const text = (e: Element | null): string => (e?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const queryOf = (a: Element): SearchQueryDTO =>
    SearchQueryUtils.parseURLifiedQuery(decodeURIComponent(a.getAttribute('href')!.substring('/search/'.length)))!;

  it('should show the name, the title and the caption', () => {
    expect(text(el.querySelector('[title="Filename"]'))).toBe('Árvíztűrő tükörfúrógép 東京.jpg');
    expect(text(el.querySelector('h4'))).toBe('Őszi túra a Bükkben');
    expect(text(el.querySelector('.caption-body'))).toBe('Ünnepi kirándulás – 東京タワー, Kraków');
  });

  it('should list the persons once and the keywords, each linked to its search', () => {
    const links = [...el.querySelectorAll('.keywords a')];
    expect(links.map(text)).toEqual(['Ödön Ősz', '山田太郎', '#Árvíztűrő', '#桜', '#Zürich']);
    expect(links.map(a => queryOf(a))).toEqual([
      {type: SearchQueryTypes.person, matchType: TextSearchQueryMatchTypes.exact_match, value: 'Ödön Ősz'},
      {type: SearchQueryTypes.person, matchType: TextSearchQueryMatchTypes.exact_match, value: '山田太郎'},
      {type: SearchQueryTypes.keyword, matchType: TextSearchQueryMatchTypes.exact_match, value: 'Árvíztűrő'},
      {type: SearchQueryTypes.keyword, matchType: TextSearchQueryMatchTypes.exact_match, value: '桜'},
      {type: SearchQueryTypes.keyword, matchType: TextSearchQueryMatchTypes.exact_match, value: 'Zürich'},
    ]);
  });

  it('should link every part of the place to its search', () => {
    const links = [...el.querySelectorAll('[title="Click location parts to search for media from the same area"] a')];
    expect(links.map(text)).toEqual(['Kraków', '東京都', 'Magyarország']);
    expect(links.map(a => (queryOf(a) as TextSearch).value)).toEqual(['Kraków', '東京都', 'Magyarország']);
    expect(links.map(a => queryOf(a).type)).toEqual([SearchQueryTypes.position, SearchQueryTypes.position, SearchQueryTypes.position]);
  });

  it('should show the GPS position', () => {
    expect(text(el.querySelector('[title="Click GPS coordinates to search for nearby media"]'))).toMatch(/^35\.\d+, 139\.\d+$/);
    const marker = fixture.componentInstance.markerLayer();
    expect(marker.map(m => m.getLatLng())).toEqual([expect.objectContaining({lat: 35.6586, lng: 139.7454})]);
  });
});
