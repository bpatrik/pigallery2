import {Component, Input} from '@angular/core';
import {GroupSortByTypes} from '../../../../../common/entities/SortingMethods';

@Component({
  selector: 'app-sorting-method-icon',
  templateUrl: './sorting-method-icon.component.html',
  styleUrls: ['./sorting-method-icon.component.css']
})
export class SortingMethodIconComponent {
  @Input() method: number;
  public readonly GroupSortByTypes = GroupSortByTypes;
}
