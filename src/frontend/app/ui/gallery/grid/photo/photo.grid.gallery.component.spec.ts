import {ComponentFixture, TestBed} from '@angular/core/testing';

import {GalleryPhotoComponent} from './photo.grid.gallery.component';
import {GridMedia} from '../GridMedia';
import {PhotoDTO, PhotoMetadata} from '../../../../../../common/entities/PhotoDTO';
import {ThumbnailManagerService} from '../../thumbnailManager.service';
import {AuthenticationService} from '../../../../model/network/authentication.service';
import {ExtensionService} from '../../../../model/extension.service';
import {MediaButtonModalService} from './media-button-modal/media-button-modal.service';
import {provideIcons} from '@ng-icons/core';
import {appIcons} from '../../../../icons';

class MockThumbnailManagerService {
  getThumbnail() {
    return {
      Available: true,
      Src: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=',
      Error: false,
      loading: false,
      destroy() {
      },
    };
  }
}

class MockAuthenticationService {
  canSearch() {
    return false;
  }
}

class MockExtensionService {
  UIExtensionConfig: unknown[] = [];
}

class MockMediaButtonModalService {
  showModal() {
  }

  executeButtonAction() {
  }
}

function makeGridMedia(overrides: Partial<PhotoDTO> = {}): GridMedia {
  const media = {
    name: 'IMG_001.HEIC',
    directory: {name: 'photos', path: '/'},
    metadata: {
      size: {width: 4032, height: 3024},
      creationDate: Date.now(),
      fileSize: 2048000,
    },
    ...overrides,
  } as any;
  return new GridMedia(media, 100, 100, 0);
}

describe('GalleryPhotoComponent - Live Photo badge', () => {
  let component: GalleryPhotoComponent;
  let fixture: ComponentFixture<GalleryPhotoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GalleryPhotoComponent],
      providers: [
        provideIcons(appIcons),
        {provide: ThumbnailManagerService, useClass: MockThumbnailManagerService},
        {provide: AuthenticationService, useClass: MockAuthenticationService},
        {provide: ExtensionService, useClass: MockExtensionService},
        {provide: MediaButtonModalService, useClass: MockMediaButtonModalService},
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(GalleryPhotoComponent);
    component = fixture.componentInstance;
  });

  it('should render the LIVE badge for paired Live Photos', () => {
    fixture.componentRef.setInput('gridMedia', makeGridMedia({
      liveVideoPath: 'photos/IMG_001_HEVC.MOV',
    } as any));

    fixture.detectChanges();

    const badge = fixture.nativeElement.querySelector('.live-photo-indicator');
    expect(badge).not.toBeNull();
    expect(badge.textContent.trim()).toBe('LIVE');
  });

  it('should not render the LIVE badge for regular photos', () => {
    fixture.componentRef.setInput('gridMedia', makeGridMedia());

    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('.live-photo-indicator')
    ).toBeNull();
  });
});

describe('GalleryPhotoComponent - metadataFilter', () => {
  let component: GalleryPhotoComponent;
  let fixture: ComponentFixture<GalleryPhotoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GalleryPhotoComponent],
      providers: [
        provideIcons(appIcons),
        {provide: ThumbnailManagerService, useClass: MockThumbnailManagerService},
        {provide: AuthenticationService, useClass: MockAuthenticationService},
        {provide: ExtensionService, useClass: MockExtensionService},
        {provide: MediaButtonModalService, useClass: MockMediaButtonModalService},
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(GalleryPhotoComponent);
    component = fixture.componentInstance;
  });

  const withMetadata = (metadata: Partial<PhotoMetadata>): void => {
    fixture.componentRef.setInput('gridMedia', makeGridMedia({metadata: {size: {width: 4032, height: 3024}, ...metadata}} as any));
    fixture.detectChanges();
  };

  it('should keep the existing comparators working', () => {
    withMetadata({rating: 4});
    expect(component.matchesMetadataFilter([{field: 'rating', comparator: '>=', value: 4}])).toBe(true);
    expect(component.matchesMetadataFilter([{field: 'rating', comparator: '<=', value: 3}])).toBe(false);
    expect(component.matchesMetadataFilter([{field: 'size.width', comparator: '==', value: 4032}])).toBe(true);
    expect(component.matchesMetadataFilter([{field: 'title', comparator: '==', value: 'x'}])).toBe(false);
  });

  it('should match "contains" on array items', () => {
    withMetadata({keywords: ['holiday', 'favorite']});
    expect(component.matchesMetadataFilter([{field: 'keywords', comparator: 'contains', value: 'favorite'}])).toBe(true);
    expect(component.matchesMetadataFilter([{field: 'keywords', comparator: 'contains', value: 'fav'}])).toBe(false);
    expect(component.matchesMetadataFilter([{field: 'keywords', comparator: '!contains', value: 'favorite'}])).toBe(false);
  });

  it('should match "contains" as a substring on strings', () => {
    withMetadata({caption: 'Summer at the beach'});
    expect(component.matchesMetadataFilter([{field: 'caption', comparator: 'contains', value: 'beach'}])).toBe(true);
    expect(component.matchesMetadataFilter([{field: 'caption', comparator: '!contains', value: 'snow'}])).toBe(true);
  });

  it('should treat a missing field as not containing anything', () => {
    withMetadata({});
    expect(component.matchesMetadataFilter([{field: 'keywords', comparator: 'contains', value: 'favorite'}])).toBe(false);
    expect(component.matchesMetadataFilter([{field: 'keywords', comparator: '!contains', value: 'favorite'}])).toBe(true);
    expect(component.matchesMetadataFilter([{field: 'positionData.city', comparator: '!contains', value: 'Paris'}])).toBe(true);
  });

  it('should require every filter to match', () => {
    withMetadata({keywords: ['favorite'], rating: 2});
    expect(component.matchesMetadataFilter([
      {field: 'keywords', comparator: 'contains', value: 'favorite'},
      {field: 'rating', comparator: '>=', value: 4},
    ])).toBe(false);
  });
});
