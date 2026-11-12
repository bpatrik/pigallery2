import {Component} from '@angular/core';

/**
 * The loading indicator in the middle of the page, e.g. while a folder, the albums or the faces load.
 */
@Component({
  selector: 'app-spinner',
  templateUrl: './spinner.component.html',
  styleUrl: './spinner.component.css',
  host: {'class': 'spinner-container'}
})
export class SpinnerComponent {
}
