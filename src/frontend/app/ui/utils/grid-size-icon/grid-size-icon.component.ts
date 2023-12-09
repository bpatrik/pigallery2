import {Component, Input} from '@angular/core';
import {GridSizes} from '../../../../../common/entities/GridSizes';

@Component({
  selector: 'app-grid-size-icon',
  templateUrl: './grid-size-icon.component.html',
  styleUrls: ['./grid-size-icon.component.css']
})
export class GridSizeIconComponent {
  @Input() method: number;
  public readonly GridSizes = GridSizes;
}
