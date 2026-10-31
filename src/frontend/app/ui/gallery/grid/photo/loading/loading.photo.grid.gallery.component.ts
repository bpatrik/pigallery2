import {Component, input} from '@angular/core';

import { NgIconComponent } from '@ng-icons/core';

@Component({
    selector: 'app-gallery-grid-photo-loading',
    templateUrl: './loading.photo.grid.gallery.component.html',
    styleUrl: './loading.photo.grid.gallery.component.css',
    imports: [NgIconComponent]
})
export class GalleryPhotoLoadingComponent {
  readonly animate = input<boolean>(undefined);
  readonly error = input<boolean>(undefined);
}

