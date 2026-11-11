import {TestBed} from '@angular/core/testing';
import {DuplicateService} from './duplicates.service';
import {NetworkService} from '../../model/network/network.service';
import {DuplicatesDTO} from '../../../../common/entities/DuplicatesDTO';

describe('DuplicateService', () => {
  let service: DuplicateService;
  let getJson: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    getJson = vi.fn();
    TestBed.configureTestingModule({providers: [{provide: NetworkService, useValue: {getJson}}]});
    service = TestBed.inject(DuplicateService);
  });

  it('should be loading (null) until the duplicates arrive', () => {
    expect(service.duplicates()).toBeNull();
  });

  it('should load the duplicates', async () => {
    const duplicates = [{media: [{name: 'Hévíz.jpg'}, {name: 'Hévíz.jpg'}]}] as unknown as DuplicatesDTO[];
    getJson.mockResolvedValue(duplicates);
    await service.getDuplicates();
    expect(getJson).toHaveBeenCalledWith('/admin/duplicates');
    expect(service.duplicates()).toEqual(duplicates);
  });

  // an empty list is not loading anymore: the page shows its "No duplicates found" message
  it('should keep an empty result apart from loading', async () => {
    getJson.mockResolvedValue([]);
    await service.getDuplicates();
    expect(service.duplicates()).toEqual([]);
  });
});
