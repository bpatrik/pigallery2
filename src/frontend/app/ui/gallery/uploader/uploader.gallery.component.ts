import { Component, input } from '@angular/core';

import {NgIconComponent} from '@ng-icons/core';

// The drop overlay. The upload progress is shown by the toasts (see UploaderService).
@Component({
  selector: 'app-gallery-uploader',
  templateUrl: './uploader.gallery.component.html',
  styleUrl: './uploader.gallery.component.css',
  imports: [
    NgIconComponent
]
})
export class UploaderComponent {
  readonly isUploadOver = input<boolean>(undefined);
}

