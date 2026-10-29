import { Injectable, inject } from '@angular/core';
import {NetworkService} from '../../model/network/network.service';
import {BehaviorSubject} from 'rxjs';
import {PersonDTO} from '../../../../common/entities/PersonDTO';
import {SortByDirectionalTypes, type SortingMethod} from '../../../../common/entities/SortingMethods';
import {Config} from '../../../../common/config/public/Config';

@Injectable({providedIn: 'root'})
export class FacesService {
  private networkService = inject(NetworkService);

  public persons: BehaviorSubject<PersonDTO[]>;
  public sorting: BehaviorSubject<SortingMethod>;

  constructor() {
    this.persons = new BehaviorSubject<PersonDTO[]>([]);
    this.sorting = new BehaviorSubject<SortingMethod>({
      method: Config.Faces.sorting.method,
      ascending: Config.Faces.sorting.ascending
    });
  }

  public isDefaultSorting(){
    return this.sorting.value.method === Config.Faces.sorting.method &&
      this.sorting.value.ascending === Config.Faces.sorting.ascending;
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
      await this.networkService.getJson<PersonDTO[]>('/person')
    );
  }

  public setSorting(sorting: SortingMethod): void {
    this.sorting.next(sorting);
  }
}
