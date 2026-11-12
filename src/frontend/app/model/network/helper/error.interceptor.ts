import {inject} from '@angular/core';
import {HttpInterceptorFn} from '@angular/common/http';
import {throwError} from 'rxjs';
import {catchError} from 'rxjs/operators';
import {AuthenticationService} from '../authentication.service';
import {NavigationService} from '../../navigation.service';
import {ErrorCodes} from '../../../../../common/entities/Error';
import {ToastService} from '../../../ui/toast/toast.service';


export const errorInterceptor: HttpInterceptorFn = (request, next) => {
  const authenticationService = inject(AuthenticationService);
  const navigationService = inject(NavigationService);
  const toastService = inject(ToastService);
  return next(request).pipe(
    catchError((err) => {
      // err.error is not an object when the response body is not JSON (e.g. a proxy error page)
      const serverError = err.error?.error;
      // the session ended (e.g. expired or the user was deleted): log out.
      // Not on a wrong password: the guest of a password protected sharing has to stay on its login page.
      if (err.status === 401 && authenticationService.user() &&
        serverError?.code !== ErrorCodes.CREDENTIAL_NOT_FOUND) {
        // opened before the logout: it stays on the login page. Once, also when several requests answer 401.
        const text = $localize`Your session has ended. Please log in again.`;
        if (!toastService.toasts().some(t => t.text === text)) {
          toastService.open({type: 'warning', text, timeout: ToastService.TIMEOUT, showLoggedOut: true});
        }
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
