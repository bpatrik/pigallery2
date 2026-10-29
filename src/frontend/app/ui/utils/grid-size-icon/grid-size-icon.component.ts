import {Component, input} from '@angular/core';
import {GridSizes} from '../../../../../common/entities/GridSizes';

import { NgIconComponent } from '@ng-icons/core';

@Component({
    selector: 'app-grid-size-icon',
    templateUrl: './grid-size-icon.component.html',
    styleUrl: './grid-size-icon.component.css',
    imports: [NgIconComponent]
})
export class GridSizeIconComponent {
  readonly method = input<number>(undefined);
  public readonly GridSizes = GridSizes;
}
