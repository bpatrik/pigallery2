import {Component} from '@angular/core';
import {FacesService} from '../faces.service';
import {SortByDirectionalTypes} from '../../../../../common/entities/SortingMethods';
import {Config} from '../../../../../common/config/public/Config';

import {NgIconComponent} from '@ng-icons/core';
import {SortingMethodIconComponent} from '../../utils/sorting-method-icon/sorting-method-icon.component';
import {BsDropdownDirective, BsDropdownMenuDirective, BsDropdownToggleDirective} from 'ngx-bootstrap/dropdown';
import {StringifySortingMethod} from '../../../pipes/StringifySortingMethod';

@Component({
  selector: 'app-faces-navbar',
  styleUrls: ['./navigator.faces.component.css'],
  templateUrl: './navigator.faces.component.html',
  imports: [
    NgIconComponent,
    BsDropdownDirective,
    BsDropdownToggleDirective,
    SortingMethodIconComponent,
    BsDropdownMenuDirective,
    StringifySortingMethod
]
})
export class FacesNavigatorComponent {
  public readonly sortingByTypes: { key: number; value: string }[] = [];
  public readonly config = Config;

  constructor(
    public facesService: FacesService,
  ) {
    this.sortingByTypes = [
      {key: SortByDirectionalTypes.Name, value: SortByDirectionalTypes[SortByDirectionalTypes.Name]},
      {key: SortByDirectionalTypes.PersonCount, value: SortByDirectionalTypes[SortByDirectionalTypes.PersonCount]}
    ];
  }

  isDefaultSorting(): boolean {
    return this.facesService.isDefaultSorting();
  }

  setSortingBy(sorting: number): void {
    this.facesService.setSorting({
      method: sorting,
      ascending: this.facesService.sorting.value.ascending
    });
  }

  setSortingAscending(asc: boolean) {
    this.facesService.setSorting({
      method: this.facesService.sorting.value.method,
      ascending: asc
    });
  }
}
