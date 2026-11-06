import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { FilterService } from './filter.service';
import { PhotoDTO, FaceRegion, PhotoMetadata } from '../../../../../common/entities/PhotoDTO';
import { ContentLoaderService, DirectoryContent } from '../contentLoader.service';

describe('FilterService', () => {
  let service: FilterService;
  let originalContent: ReturnType<typeof signal<DirectoryContent | null>>;

  const getFacesFilter = () => service.filteredContent().filters.selectedFilters
    .find(f => f.filter.name === $localize`Faces`)!;

  beforeEach(() => {
    originalContent = signal<DirectoryContent | null>(null);
    TestBed.configureTestingModule({
      providers: [
        FilterService,
        {provide: ContentLoaderService, useValue: {originalContent}}
      ]
    });
    service = TestBed.inject(FilterService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('Face filtering', () => {
    it('should keep photos that contain selected face even if photo has multiple faces', () => {
      // Create test photos with various face combinations
      const testPhotos: PhotoDTO[] = [
        createPhotoWithFaces(['John']),
        createPhotoWithFaces(['Kate']),
        createPhotoWithFaces(['John', 'Kate']),
        createPhotoWithFaces(['Kate', 'John']), // Same as above but different order
        createPhotoWithFaces(['Kate', 'Bob']),
        createPhotoWithFaces(['Bob']),
        createPhotoWithFaces([]),
      ];

      originalContent.set({
        directories: [],
        media: testPhotos,
        metaFile: []
      });

      // Make filters visible; filtering populates the options
      service.setShowingFilters(true);

      // Get the faces filter and verify initial state
      const activeFacesFilter = getFacesFilter();
      expect(activeFacesFilter).toBeTruthy();
      expect(activeFacesFilter.options.length).toBe(3); // John, Kate, Bob

      // Initially all options are selected, set all to unselected first
      activeFacesFilter.options.forEach(opt => opt.selected = false);
      service.onFilterChange();

      // Now set only Kate as selected
      activeFacesFilter.options.forEach(opt => {
        if (opt.name === 'Kate') {
          opt.selected = true;
        }
      });

      // Trigger filter change to apply the selection
      service.onFilterChange();

      // Should keep all photos containing Kate (3 photos: Kate alone, Kate+John, John+Kate, Kate+Bob)
      const result = service.filteredContent().content!;
      expect(result.media.length).toBe(4);
      expect(result.media.every(photo =>
        (photo.metadata as PhotoMetadata).faces?.some((face: FaceRegion) => face.name === 'Kate')
      )).toBe(true);
      expect(service.filteredContent().filters.areFiltersActive).toBe(true);
    });

    it('should reset the selected options for new content', () => {
      originalContent.set({directories: [], media: [createPhotoWithFaces(['Kovács Éva']), createPhotoWithFaces(['Bob'])], metaFile: []});
      service.setShowingFilters(true);
      getFacesFilter().options.find(opt => opt.name === 'Bob')!.selected = false;
      service.onFilterChange();
      expect(service.filteredContent().content!.media.length).toBe(1);

      originalContent.set({directories: [], media: [createPhotoWithFaces(['Bob']), createPhotoWithFaces(['Bob'])], metaFile: []});

      expect(service.filteredContent().content!.media.length).toBe(2);
      expect(getFacesFilter().options.map(opt => [opt.name, opt.selected])).toEqual([['Bob', true]]);
      // the filter panel stays open
      expect(service.filteredContent().filters.filtersVisible).toBe(true);
    });
  });
});

function createPhotoWithFaces(faceNames: string[]): PhotoDTO {
  return {
    id: Math.random(),
    name: `photo_${faceNames.join('_')}.jpg`,
    directory: { path: '/test', name: 'test' },
    metadata: {
      faces: faceNames.map(name => ({ name } as FaceRegion)),
      size: { width: 100, height: 100 },
      creationDate: Date.now(),
      fileSize: 1000,
      title: undefined,
      caption: undefined,
      cameraData: {
        ISO: undefined,
        model: undefined,
        make: undefined,
        fStop: undefined,
        exposure: undefined,
        focalLength: undefined,
        lens: undefined
      },
      positionData: {
        GPSData: undefined,
        country: undefined,
        state: undefined,
        city: undefined
      }
    }
  } as PhotoDTO;
}
