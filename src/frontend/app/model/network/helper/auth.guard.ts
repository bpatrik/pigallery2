import {inject} from '@angular/core';
import {CanActivateFn} from '@angular/router';
import {AuthenticationService} from '../authentication.service';
import {NavigationService} from '../../navigation.service';

export const authGuard: CanActivateFn = (): boolean => {
  if (inject(AuthenticationService).isAuthenticated() === true) {
    return true;
  }

  inject(NavigationService).toLogin().catch(console.error);
  return false;
};
