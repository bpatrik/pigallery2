import {ComponentFixture, TestBed} from '@angular/core/testing';
import {BehaviorSubject} from 'rxjs';
import {NgIconsModule} from '@ng-icons/core';
import {ionCalendarOutline, ionImageOutline, ionVideocamOutline} from '@ng-icons/ionicons';

import {InfoPanelLightboxComponent} from './info-panel.lightbox.gallery.component';
import {QueryService} from '../../../../model/query.service';
import {MapService} from '../../map/map.service';
import {AuthenticationService} from '../../../../model/network/authentication.service';
import {ThemeService} from '../../../../model/theme.service';
import {ContentLoaderService} from '../../contentLoader.service';
import {MediaDTO} from '../../../../../../common/entities/MediaDTO';

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

  get ShortAttributions() {
    return '';
  }
}

class MockAuthenticationService {
  canSearch() {
    return false;
  }
}

class MockThemeService {
  darkMode = new BehaviorSubject(false);
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
    component.media = makePhoto({
      liveVideoPath: 'vacation/IMG_7936_HEVC.MOV',
      liveVideoInfo: {
        name: 'IMG_7936_HEVC.MOV',
        size: {width: 1920, height: 1080},
        fileSize: 4500000,
        duration: 3000,
      },
    });
    component.ngOnChanges();
    fixture.detectChanges();

    const rows = fixture.nativeElement.querySelectorAll('.row');
    const videoRow = Array.from(rows).find(
      (r: HTMLElement) => r.querySelector('ng-icon[name="ionVideocamOutline"]')
    ) as HTMLElement;
    expect(videoRow).toBeTruthy();
    expect(videoRow.textContent).toContain('IMG_7936_HEVC.MOV');
    expect(videoRow.textContent).toContain('1920');
    expect(videoRow.textContent).toContain('1080');
  });

  it('should not show companion video row for regular photos', () => {
    component.media = makePhoto();
    component.ngOnChanges();
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    const videocamIcons = el.querySelectorAll('ng-icon[name="ionVideocamOutline"]');
    // Should not have a videocam icon in the file info area
    // (videocam may appear in other sections for regular videos)
    const fileInfoRows = el.querySelectorAll('.row[title="File information and properties"], .row[title="Companion video"]');
    let hasCompanionRow = false;
    fileInfoRows.forEach((row: HTMLElement) => {
      if (row.getAttribute('title') === 'Companion video') {
        hasCompanionRow = true;
      }
    });
    expect(hasCompanionRow).toBeFalse();
  });

  it('isLivePhoto() should return true when liveVideoPath is set', () => {
    component.media = makePhoto({
      liveVideoPath: 'vacation/IMG_7936_HEVC.MOV',
    });
    expect(component.isLivePhoto()).toBeTrue();
  });

  it('isLivePhoto() should return false for regular photos', () => {
    component.media = makePhoto();
    expect(component.isLivePhoto()).toBeFalse();
  });
});
