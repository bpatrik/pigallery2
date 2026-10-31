import {Component, input} from '@angular/core';
import {GroupSortByTypes} from '../../../../../common/entities/SortingMethods';

import { NgIconComponent } from '@ng-icons/core';

@Component({
    selector: 'app-sorting-method-icon',
    templateUrl: './sorting-method-icon.component.html',
    styleUrl: './sorting-method-icon.component.css',
    imports: [NgIconComponent]
})
export class SortingMethodIconComponent {
  readonly method = input<number>(undefined);
  public readonly GroupSortByTypes = GroupSortByTypes;
}
