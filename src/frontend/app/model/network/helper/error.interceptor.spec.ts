import type {Mocked} from 'vitest';
import {signal} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {HttpClient, provideHttpClient, withInterceptors, withXhr} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {errorInterceptor} from './error.interceptor';
import {AuthenticationService} from '../authentication.service';
import {NavigationService} from '../../navigation.service';
import {ErrorCodes} from '../../../../../common/entities/Error';
import {UserDTO} from '../../../../../common/entities/UserDTO';

describe('errorInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let authService: Mocked<AuthenticationService>;
  let navigationService: Mocked<NavigationService>;
  const user = signal<UserDTO | null>(null);

  beforeEach(() => {
    user.set({name: 'user'} as UserDTO);
    authService = {logout: vi.fn(), user} as unknown as Mocked<AuthenticationService>;
    authService.logout.mockResolvedValue(undefined);
    navigationService = {toError: vi.fn()} as unknown as Mocked<NavigationService>;
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withXhr(), withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        {provide: AuthenticationService, useValue: authService},
        {provide: NavigationService, useValue: navigationService},
      ]
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  const request = (): Promise<unknown> => new Promise((resolve) => {
    http.get('/api/test').subscribe({error: resolve});
  });

  it('should log out with the server error code on 401', async () => {
    const result = request();
    httpMock.expectOne('/api/test').flush({error: {code: ErrorCodes.NOT_AUTHENTICATED}},
      {status: 401, statusText: 'Unauthorized'});

    expect(await result).toEqual({code: ErrorCodes.NOT_AUTHENTICATED});
    expect(authService.logout).toHaveBeenCalledWith(ErrorCodes.NOT_AUTHENTICATED);
  });

  it('should log out on a 401 without a JSON body', async () => {
    const result = request();
    httpMock.expectOne('/api/test').flush('Unauthorized', {status: 401, statusText: 'Unauthorized'});

    expect(await result).toEqual('Unauthorized');
    expect(authService.logout).toHaveBeenCalledWith(undefined);
  });

  // a wrong password on the login or the sharing login page: the guest of a sharing must stay on it
  it('should not log out on a wrong password', async () => {
    const result = request();
    httpMock.expectOne('/api/test').flush({error: {code: ErrorCodes.CREDENTIAL_NOT_FOUND}},
      {status: 401, statusText: 'Unauthorized'});

    expect(await result).toEqual({code: ErrorCodes.CREDENTIAL_NOT_FOUND});
    expect(authService.logout).not.toHaveBeenCalled();
  });

  it('should not log out on a 401 when nobody is logged in', async () => {
    user.set(null);
    const result = request();
    httpMock.expectOne('/api/test').flush({error: {code: ErrorCodes.NOT_AUTHENTICATED}},
      {status: 401, statusText: 'Unauthorized'});

    expect(await result).toEqual({code: ErrorCodes.NOT_AUTHENTICATED});
    expect(authService.logout).not.toHaveBeenCalled();
  });

  // an illegal move (e.g. a normal user calls the admin API or uploads without the right): log out, also on uploads
  it('should log out on NOT_AUTHORISED', async () => {
    const result = request();
    httpMock.expectOne('/api/test').flush({error: {code: ErrorCodes.NOT_AUTHORISED}},
      {status: 403, statusText: 'Forbidden'});

    expect(await result).toEqual({code: ErrorCodes.NOT_AUTHORISED});
    expect(authService.logout).toHaveBeenCalledWith(ErrorCodes.NOT_AUTHORISED);
  });

  it('should not log out on other 403 errors', async () => {
    const result = request();
    httpMock.expectOne('/api/test').flush({error: {code: ErrorCodes.PERMISSION_DENIED}},
      {status: 403, statusText: 'Forbidden'});

    expect(await result).toEqual({code: ErrorCodes.PERMISSION_DENIED});
    expect(authService.logout).not.toHaveBeenCalled();
  });

  it('should go to the error page on an internal server error', async () => {
    const result = request();
    httpMock.expectOne('/api/test').flush({error: {code: ErrorCodes.INTERNAL}},
      {status: 500, statusText: 'Server Error'});

    await result;
    expect(navigationService.toError).toHaveBeenCalled();
  });

  it('should pass on a 500 without a JSON body', async () => {
    const result = request();
    httpMock.expectOne('/api/test').flush(null, {status: 500, statusText: 'Server Error'});

    expect(await result).toEqual('Server Error');
    expect(navigationService.toError).not.toHaveBeenCalled();
  });
});
