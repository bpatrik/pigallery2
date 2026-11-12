import {inject} from '@angular/core';
import {CanActivateFn, RedirectCommand, Router} from '@angular/router';
import {ShareService} from '../../../ui/gallery/share.service';
import {NavigationService} from '../../navigation.service';

/**
 * A missing, expired or deleted sharing link (#1307) shows the invalid link page instead of the gallery.
 */
export const sharingGuard: CanActivateFn = async (): Promise<true | RedirectCommand> => {
  const shareService = inject(ShareService);
  const router = inject(Router);
  await shareService.wait();
  if (!shareService.isSharing() || await shareService.getPublicSharing()) {
    return true;
  }
  return new RedirectCommand(router.parseUrl(NavigationService.INVALID_SHARING_URL), {skipLocationChange: true});
};
