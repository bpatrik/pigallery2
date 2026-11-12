import {inject} from '@angular/core';
import {CanActivateFn} from '@angular/router';
import {AuthenticationService} from '../authentication.service';
import {NavigationService} from '../../navigation.service';

export const authGuard: CanActivateFn = (_route, state): boolean => {
  if (inject(AuthenticationService).isAuthenticated() === true) {
    return true;
  }

  // the login takes the user to the page they opened (e.g. a deep link)
  inject(NavigationService).toLogin(state.url).catch(console.error);
  return false;
};
