import {Component, computed, inject} from '@angular/core';
import {Config} from '../../../../common/config/public/Config';
import {IconComponent} from '../../icon.component';
import {EmptyStateComponent} from '../utils/empty-state/empty-state.component';
import {AuthenticationService} from '../../model/network/authentication.service';
import {ShareService} from '../gallery/share.service';
import {NavigationService} from '../../model/navigation.service';

/**
 * A missing, expired or deleted sharing link (#1307), also one that ended while it was open.
 * No gallery around it: the guest of the sharing can't go anywhere else.
 */
@Component({
  selector: 'app-invalid-sharing',
  templateUrl: './invalid-sharing.component.html',
  styleUrl: './invalid-sharing.component.css',
  imports: [IconComponent, EmptyStateComponent]
})
export class InvalidSharingComponent {
  private authService = inject(AuthenticationService);
  private shareService = inject(ShareService);
  private navigationService = inject(NavigationService);

  readonly title = Config.Server.applicationTitle;
  // a logged-in user, not the guest of a sharing, has an own gallery to go to
  readonly canOpenGallery = computed((): boolean => {
    const user = this.authService.user();
    return !!user && !user.usedSharingKey;
  });

  openGallery(): void {
    this.shareService.dropSharing();
    this.navigationService.toDefault().catch(console.error);
  }
}
