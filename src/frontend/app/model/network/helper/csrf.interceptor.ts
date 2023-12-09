import {Injectable} from '@angular/core';
import {HttpEvent, HttpHandler, HttpInterceptor, HttpRequest,} from '@angular/common/http';
import {Observable} from 'rxjs';
import {AuthenticationService} from '../authentication.service';

@Injectable()
export class CSRFInterceptor implements HttpInterceptor {
  constructor(private authenticationService: AuthenticationService) {
  }

  intercept(
      request: HttpRequest<any>,
      next: HttpHandler
  ): Observable<HttpEvent<any>> {
    // add authorization header with jwt token if available
    const currentUser = this.authenticationService.user.value;
    if (currentUser && currentUser.csrfToken) {
      request = request.clone({
        setHeaders: {
          'CSRF-Token': `${currentUser.csrfToken}`,
        },
      });
    }
    return next.handle(request);
  }
}
