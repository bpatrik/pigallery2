import {inject} from '@angular/core';
import {HttpInterceptorFn} from '@angular/common/http';
import {throwError} from 'rxjs';
import {catchError} from 'rxjs/operators';
import {AuthenticationService} from '../authentication.service';
import {NavigationService} from '../../navigation.service';
import {ErrorCodes} from '../../../../../common/entities/Error';


export const errorInterceptor: HttpInterceptorFn = (request, next) => {
  const authenticationService = inject(AuthenticationService);
  const navigationService = inject(NavigationService);
  return next(request).pipe(
    catchError((err) => {
      // err.error is not an object when the response body is not JSON (e.g. a proxy error page)
      const serverError = err.error?.error;
      // the session ended (e.g. expired or the user was deleted): log out.
      // Not on a wrong password: the guest of a password protected sharing has to stay on its login page.
      if (err.status === 401 && authenticationService.user() &&
        serverError?.code !== ErrorCodes.CREDENTIAL_NOT_FOUND) {
        authenticationService.logout(serverError?.code).catch(console.error);
      }
      // an illegal move (e.g. a normal user calls the admin API): log out
      if (err.status === 403 && serverError?.code === ErrorCodes.NOT_AUTHORISED) {
        authenticationService.logout(serverError.code).catch(console.error);
      }
      if (err.status === 500 && serverError?.code === ErrorCodes.INTERNAL) {
        // Unknown server error
        navigationService.toError();
      }

      const error = serverError || err.error?.message || err.statusText;
      return throwError(() => error);
    })
  );
};
