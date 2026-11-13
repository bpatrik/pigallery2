import {inject} from '@angular/core';
import {ActivatedRouteSnapshot, RouterStateSnapshot} from '@angular/router';
import {AuthenticationService} from '../authentication.service';
import {NavigationService} from '../../navigation.service';
import {ToastService} from '../../../ui/toast/toast.service';
import {UserRoles} from '../../../../../common/entities/UserDTO';

export const authGuard = (_route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean => {
  if (inject(AuthenticationService).isAuthenticated() === true) {
    return true;
  }

  // the login takes the user to the page they opened (e.g. a deep link)
  inject(NavigationService).toLogin(state.url).catch(console.error);
  return false;
};

/**
 * A guest logs in first; a logged-in user who is not an admin gets the gallery with a warning (#1315).
 */
export const adminGuard = (route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean => {
  if (!authGuard(route, state)) {
    return false;
  }
  if (inject(AuthenticationService).isAuthorized(UserRoles.Admin)) {
    return true;
  }
  inject(ToastService).open({
    type: 'warning',
    text: $localize`Only admins can open the admin page.`,
    timeout: ToastService.TIMEOUT
  });
  inject(NavigationService).toGallery().catch(console.error);
  return false;
};
