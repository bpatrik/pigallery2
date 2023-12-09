import {Injectable} from '@angular/core';
import {NetworkService} from '../../model/network/network.service';
import {DuplicatesDTO} from '../../../../common/entities/DuplicatesDTO';
import {BehaviorSubject} from 'rxjs';

@Injectable()
export class DuplicateService {
  public duplicates: BehaviorSubject<DuplicatesDTO[]>;

  constructor(private networkService: NetworkService) {
    this.duplicates = new BehaviorSubject<DuplicatesDTO[]>(null);
  }

  public async getDuplicates(): Promise<void> {
    this.duplicates.next(
        await this.networkService.getJson<DuplicatesDTO[]>('/admin/duplicates')
    );
  }
}
