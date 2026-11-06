import {TestBed} from '@angular/core/testing';
import {signal} from '@angular/core';
import {GalleryNavigatorService} from './navigator.service';
import {GalleryCacheService} from '../cache.gallery.service';
import {ContentLoaderService} from '../contentLoader.service';
import {ContentWrapperWithError} from '../../../../../common/entities/ContentWrapper';
import {GridSizes} from '../../../../../common/entities/GridSizes';
import {Config} from '../../../../../common/config/public/Config';

// stores the grid size per folder, like the localStorage based cache
class FakeGalleryCacheService {
  gridSizes = new Map<string, GridSizes>();

  getGridSize(cw: ContentWrapperWithError): GridSizes | null {
    return this.gridSizes.get(cw?.directory?.name ?? '') ?? null;
  }

  setGridSize(cw: ContentWrapperWithError, gs: GridSizes): void {
    this.gridSizes.set(cw?.directory?.name ?? '', gs);
  }

  removeGridSize(cw: ContentWrapperWithError): void {
    this.gridSizes.delete(cw?.directory?.name ?? '');
  }
}

const folder = (name: string): ContentWrapperWithError =>
  ({directory: {name, path: './'}} as unknown as ContentWrapperWithError);

describe('GalleryNavigatorService', () => {
  let service: GalleryNavigatorService;
  let cache: FakeGalleryCacheService;
  let content: ReturnType<typeof signal<ContentWrapperWithError>>;
  const otherSize = Config.Gallery.NavBar.defaultGidSize === GridSizes.large ? GridSizes.small : GridSizes.large;

  beforeEach(() => {
    content = signal(folder('Őszi kirándulás'));
    TestBed.configureTestingModule({
      providers: [
        {provide: GalleryCacheService, useClass: FakeGalleryCacheService},
        {provide: ContentLoaderService, useValue: {content}}
      ]
    });
    service = TestBed.inject(GalleryNavigatorService);
    cache = TestBed.inject(GalleryCacheService) as unknown as FakeGalleryCacheService;
  });

  it('should use the default grid size for a folder without a saved one', () => {
    expect(service.girdSize()).toBe(Config.Gallery.NavBar.defaultGidSize);
    expect(service.isDefaultGridSize()).toBe(true);
  });

  it('should save the chosen grid size for the folder and restore it', () => {
    service.setGridSize(otherSize);
    expect(service.girdSize()).toBe(otherSize);
    expect(cache.gridSizes.get('Őszi kirándulás')).toBe(otherSize);

    content.set(folder('Balaton'));
    expect(service.girdSize()).toBe(Config.Gallery.NavBar.defaultGidSize);

    content.set(folder('Őszi kirándulás'));
    expect(service.girdSize()).toBe(otherSize);
  });

  it('should forget the saved grid size when the default is chosen again', () => {
    service.setGridSize(otherSize);
    service.setGridSize(service.getDefaultGridSize());
    expect(cache.gridSizes.has('Őszi kirándulás')).toBe(false);
  });
});
