import {TestBed} from '@angular/core/testing';
import {FacesService} from './faces.service';
import {NetworkService} from '../../model/network/network.service';
import {PersonDTO} from '../../../../common/entities/PersonDTO';

describe('FacesService', () => {

  it('should set a new persons array on setFavourite', async () => {
    const adam = {id: 1, name: 'Ádám', isFavourite: false} as PersonDTO;
    const eva = {id: 2, name: 'Éva', isFavourite: false} as PersonDTO;
    const updated = {...adam, isFavourite: true};
    const networkService = {postJson: vi.fn().mockResolvedValue(updated)};
    TestBed.configureTestingModule({
      providers: [{provide: NetworkService, useValue: networkService}]
    });
    const service = TestBed.inject(FacesService);
    const before = [adam, eva];
    service.persons.set(before);

    await service.setFavourite(adam, true);

    expect(networkService.postJson).toHaveBeenCalledWith('/person/Ádám', {isFavourite: true});
    expect(service.persons()).not.toBe(before);
    expect(service.persons()).toEqual([updated, eva]);
    // the old array is not changed in place
    expect(before[0]).toBe(adam);
  });
});
