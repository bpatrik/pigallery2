import {EnvironmentInjector, inject, runInInjectionContext} from '@angular/core';
import {CanActivateFn, RedirectCommand, Router} from '@angular/router';
import {ShareService} from '../../../ui/gallery/share.service';
import {NavigationService} from '../../navigation.service';
import {authGuard} from './auth.guard';

/**
 * A missing, expired or deleted sharing link (#1307) shows the invalid link page instead of the gallery,
 * also to a guest. Otherwise the auth guard decides. It runs only after this check: it would send a guest to a login
 * first, which loses the link from the address bar.
 */
export const sharingGuard: CanActivateFn = async (route, state): Promise<boolean | RedirectCommand> => {
  const shareService = inject(ShareService);
  const router = inject(Router);
  const injector = inject(EnvironmentInjector);
  await shareService.wait();
  if (shareService.isSharing() && !await shareService.getPublicSharing()) {
    return new RedirectCommand(router.parseUrl(NavigationService.INVALID_SHARING_URL), {skipLocationChange: true});
  }
  return runInInjectionContext(injector, () => authGuard(route, state));
};
