import {Injectable} from '@angular/core';
import {NetworkService} from '../../model/network/network.service';
import {BehaviorSubject} from 'rxjs';
import {PersonDTO} from '../../../../common/entities/PersonDTO';

@Injectable()
export class FacesService {
  public persons: BehaviorSubject<PersonDTO[]>;

  constructor(private networkService: NetworkService) {
    this.persons = new BehaviorSubject<PersonDTO[]>([]);
  }

  public async setFavourite(
      person: PersonDTO,
      isFavourite: boolean
  ): Promise<void> {
    const updated = await this.networkService.postJson<PersonDTO>(
        '/person/' + person.name,
        {isFavourite}
    );
    const updatesList = this.persons.getValue();
    for (let i = 0; i < updatesList.length; i++) {
      if (updatesList[i].id === updated.id) {
        updatesList[i] = updated;
        this.persons.next(updatesList);
        return;
      }
    }
  }

  public async getPersons(): Promise<void> {
    this.persons.next(
        (await this.networkService.getJson<PersonDTO[]>('/person')).sort(
            (a, b): number => a.name.localeCompare(b.name)
        )
    );
  }
}
