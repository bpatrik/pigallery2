import { TestBed } from '@angular/core/testing';
import { FilterService } from './filter.service';
import { PhotoDTO, FaceRegion, PhotoMetadata } from '../../../../../common/entities/PhotoDTO';
import { DirectoryContent } from '../contentLoader.service';
import { BehaviorSubject, firstValueFrom } from 'rxjs';

describe('FilterService', () => {
  let service: FilterService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [FilterService]
    });
    service = TestBed.inject(FilterService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('Face filtering', () => {
    it('should keep photos that contain selected face even if photo has multiple faces', async () => {
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

      const testContent: DirectoryContent = {
        directories: [],
        media: testPhotos,
        metaFile: []
      };

      const content$ = new BehaviorSubject<DirectoryContent>(testContent);

      // Make filters visible and apply initial filters to populate options
      service.setShowingFilters(true);
      const filtered$ = service.applyFilters(content$);

      // Subscribe once to avoid multiple resets
      let latestResult: DirectoryContent;
      const subscription = filtered$.subscribe(result => {
        latestResult = result;
      });

      // Wait for initial population
      await new Promise(resolve => setTimeout(resolve, 0));

      // Get the faces filter and verify initial state
      const activeFacesFilter = service.activeFilters.value.selectedFilters
        .find(f => f.filter.name === $localize`Faces`);
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

      // Wait for changes to propagate
      await new Promise(resolve => setTimeout(resolve, 0));

      // Should keep all photos containing Kate (3 photos: Kate alone, Kate+John, John+Kate, Kate+Bob)
      expect(latestResult.media.length).toBe(4);
      expect(latestResult.media.every(photo =>
        (photo.metadata as PhotoMetadata).faces?.some((face: FaceRegion) => face.name === 'Kate')
      )).toBe(true);

      subscription.unsubscribe();
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
