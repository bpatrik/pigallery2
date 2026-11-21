import {Component} from '@angular/core';
import {RouterLink} from '@angular/router';
import {Config} from '../../../../common/config/public/Config';
import {IconComponent} from '../../icon.component';
import {EmptyStateComponent} from '../utils/empty-state/empty-state.component';

/**
 * An app URL that does not exist (#1305). The server answers it with HTTP 404 too.
 */
@Component({
  selector: 'app-not-found',
  templateUrl: './not-found.component.html',
  styleUrl: './not-found.component.css',
  imports: [IconComponent, EmptyStateComponent, RouterLink]
})
export class NotFoundComponent {
  readonly title = Config.Server.applicationTitle;
}
