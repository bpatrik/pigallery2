import { Injectable, inject, signal } from '@angular/core';
import {NetworkService} from '../../model/network/network.service';
import {DuplicatesDTO} from '../../../../common/entities/DuplicatesDTO';

@Injectable({providedIn: 'root'})
export class DuplicateService {
  private networkService = inject(NetworkService);

  public readonly duplicates = signal<DuplicatesDTO[] | null>(null);

  public async getDuplicates(): Promise<void> {
    this.duplicates.set(
        await this.networkService.getJson<DuplicatesDTO[]>('/admin/duplicates')
    );
  }
}
