import {Injectable} from '@angular/core';
import {HttpEvent, HttpHandler, HttpInterceptor, HttpRequest} from '@angular/common/http';
import {Observable, throwError} from 'rxjs';
import {catchError} from 'rxjs/operators';
import {AuthenticationService} from '../authentication.service';
import {NavigationService} from '../../navigation.service';
import {ErrorCodes} from '../../../../../common/entities/Error';


@Injectable()
export class ErrorInterceptor implements HttpInterceptor {
  constructor(private authenticationService: AuthenticationService,
              private navigationService: NavigationService) {
  }

  intercept(
    request: HttpRequest<any>,
    next: HttpHandler
  ): Observable<HttpEvent<any>> {
    return next.handle(request).pipe(
      catchError((err) => {
        if (err.status === 401) {
          if (this.authenticationService.user.value !== null) {
            // Logged-in user got a 401 — log them out
            this.authenticationService.logout();
          } else {
            // Already unauthenticated — just navigate to login to avoid a logout→getSessionUser→401 loop
            this.navigationService.toLogin();
          }
        }
        if (err.status === 500 && err.error.error.code === ErrorCodes.INTERNAL) {
          // Unknown server error
          this.navigationService.toError();
        }

        const error = err.error.error || err.error.message || err.statusText;
        return throwError(error);
      })
    );
  }
}
