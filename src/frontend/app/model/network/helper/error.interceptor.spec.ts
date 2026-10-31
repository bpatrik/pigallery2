import type {Mocked} from 'vitest';
import {TestBed} from '@angular/core/testing';
import {HttpClient, provideHttpClient, withInterceptors} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {errorInterceptor} from './error.interceptor';
import {AuthenticationService} from '../authentication.service';
import {NavigationService} from '../../navigation.service';
import {ErrorCodes} from '../../../../../common/entities/Error';

describe('errorInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let authService: Mocked<AuthenticationService>;
  let navigationService: Mocked<NavigationService>;

  beforeEach(() => {
    authService = {logout: vi.fn()} as unknown as Mocked<AuthenticationService>;
    authService.logout.mockResolvedValue(undefined);
    navigationService = {toError: vi.fn()} as unknown as Mocked<NavigationService>;
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
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
