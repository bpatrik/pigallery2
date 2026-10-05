import {Component, Input, ChangeDetectionStrategy} from '@angular/core';

import { NgIconComponent } from '@ng-icons/core';

@Component({
    selector: 'app-gallery-grid-photo-loading',
    templateUrl: './loading.photo.grid.gallery.component.html',
    styleUrls: ['./loading.photo.grid.gallery.component.css'],
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [NgIconComponent]
})
export class GalleryPhotoLoadingComponent {
  @Input() animate: boolean;
  @Input() error: boolean;
}

