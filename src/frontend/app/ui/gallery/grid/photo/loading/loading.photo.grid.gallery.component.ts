import {Component, Input} from '@angular/core';

@Component({
  selector: 'app-gallery-grid-photo-loading',
  templateUrl: './loading.photo.grid.gallery.component.html',
  styleUrls: ['./loading.photo.grid.gallery.component.css'],
})
export class GalleryPhotoLoadingComponent {
  @Input() animate: boolean;
  @Input() error: boolean;
}

