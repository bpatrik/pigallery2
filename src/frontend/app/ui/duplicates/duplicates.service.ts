import { Injectable, inject } from '@angular/core';
import {NetworkService} from '../../model/network/network.service';
import {DuplicatesDTO} from '../../../../common/entities/DuplicatesDTO';
import {BehaviorSubject} from 'rxjs';

@Injectable({providedIn: 'root'})
export class DuplicateService {
  private networkService = inject(NetworkService);

  public duplicates: BehaviorSubject<DuplicatesDTO[]>;

  constructor() {
    this.duplicates = new BehaviorSubject<DuplicatesDTO[]>(null);
  }

  public async getDuplicates(): Promise<void> {
    this.duplicates.next(
        await this.networkService.getJson<DuplicatesDTO[]>('/admin/duplicates')
    );
  }
}
