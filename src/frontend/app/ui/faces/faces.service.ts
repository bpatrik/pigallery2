import { Injectable, computed, inject, signal } from '@angular/core';
import {NetworkService} from '../../model/network/network.service';
import {PersonDTO} from '../../../../common/entities/PersonDTO';
import {type SortingMethod} from '../../../../common/entities/SortingMethods';
import {Config} from '../../../../common/config/public/Config';

@Injectable({providedIn: 'root'})
export class FacesService {
  private networkService = inject(NetworkService);

  public readonly persons = signal<PersonDTO[]>([]);
  public readonly sorting = signal<SortingMethod>({
    method: Config.Faces.sorting.method,
    ascending: Config.Faces.sorting.ascending
  });

  public readonly isDefaultSorting = computed((): boolean =>
    this.sorting().method === Config.Faces.sorting.method &&
    this.sorting().ascending === Config.Faces.sorting.ascending);

  public async setFavourite(
    person: PersonDTO,
    isFavourite: boolean
  ): Promise<void> {
    const updated = await this.networkService.postJson<PersonDTO>(
      '/person/' + person.name,
      {isFavourite}
    );
    if (!this.persons().some((p) => p.id === updated.id)) {
      return;
    }
    // a new array, so the signal notifies its consumers
    this.persons.update((persons) =>
      persons.map((p) => (p.id === updated.id ? updated : p))
    );
  }

  public async getPersons(): Promise<void> {
    this.persons.set(
      await this.networkService.getJson<PersonDTO[]>('/person')
    );
  }

  public setSorting(sorting: SortingMethod): void {
    this.sorting.set(sorting);
  }
}
