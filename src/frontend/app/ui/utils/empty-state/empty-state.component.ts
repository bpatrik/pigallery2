import {booleanAttribute, Component, input} from '@angular/core';
import {NgIconComponent} from '@ng-icons/core';

/**
 * Tells that there is nothing to show (an empty folder, a search without a match, no albums yet, ...).
 * The content is the message; an element with the `hint` attribute is shown below it, one with `action` after that.
 */
@Component({
  selector: 'app-empty-state',
  templateUrl: './empty-state.component.html',
  styleUrl: './empty-state.component.css',
  imports: [NgIconComponent],
  host: {'[class.center]': 'center()'}
})
export class EmptyStateComponent {
  readonly icon = input.required<string>();
  // in the middle of the page, like the loading spinner, instead of in the flow of the page
  readonly center = input(false, {transform: booleanAttribute});
}
