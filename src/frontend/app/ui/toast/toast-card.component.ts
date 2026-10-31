import {Component, input, output} from '@angular/core';
import {NgIconComponent} from '@ng-icons/core';

/**
 * The card shared by the notification toasts and the upload progress:
 * a colored status icon, a title and a text, an optional action (e.g. close button)
 * and a thin colored bar at the bottom that shows a countdown or a progress.
 *
 * Content: <span toastTitle>title</span>, the text, and an element with the toastAction attribute.
 */
@Component({
  selector: 'app-toast-card',
  templateUrl: './toast-card.component.html',
  styleUrls: ['./toast-card.component.css'],
  host: {
    '[class.single-line]': '!wrap()'
  },
  imports: [NgIconComponent]
})
export class ToastCardComponent {
  readonly icon = input.required<string>();
  // Bootstrap color name: primary, secondary, success, danger, warning, info
  readonly color = input.required<string>();
  // false: the title and text are cut to one line each
  readonly wrap = input(true);
  // ms; the bar shrinks over this time and countdownEnd fires. It pauses while the mouse is over the card.
  readonly countdown = input<number>(null);
  // 0-100; the bar shows this progress
  readonly progress = input<number>(null);
  readonly countdownEnd = output();
}
