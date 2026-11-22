import {TestBed} from '@angular/core/testing';
import {LoginComponent} from './login.component';
import {AuthenticationService} from '../../model/network/authentication.service';
import {NavigationService} from '../../model/navigation.service';
import {Config} from '../../../../common/config/public/Config';
import {ActivatedRoute, convertToParamMap} from '@angular/router';

describe('LoginComponent', () => {
  let origUrlBase: string;
  let origApiPath: string;

  beforeEach(() => {
    origUrlBase = Config.Server.urlBase;
    origApiPath = Config.Server.apiPath;
    Config.Server.apiPath = '/pgapi';
  });

  afterEach(() => {
    Config.Server.urlBase = origUrlBase;
    Config.Server.apiPath = origApiPath;
  });

  const createComponent = (queryParams: Record<string, string> = {}): LoginComponent => {
    TestBed.configureTestingModule({
      providers: [
        {provide: ActivatedRoute, useValue: {snapshot: {queryParamMap: convertToParamMap(queryParams)}}},
        {provide: AuthenticationService, useValue: null},
        {provide: NavigationService, useValue: null},
      ]
    });
    return TestBed.runInInjectionContext(() => new LoginComponent());
  };

  it('should link OIDC login to the api path without urlBase', () => {
    Config.Server.urlBase = '';
    expect(createComponent().oidcLoginUrl).toBe('/pgapi/auth/oidc/login');
  });

  it('should prefix OIDC login with urlBase', () => {
    Config.Server.urlBase = '/galerie';
    expect(createComponent().oidcLoginUrl).toBe('/galerie/pgapi/auth/oidc/login');
  });

  // #1422
  it('should tell when the OIDC provider denied the access', () => {
    expect(createComponent({oidcError: 'denied'}).oidcError).toBe('denied');
  });

  it('should tell when the OIDC login failed', () => {
    expect(createComponent({oidcError: 'failed'}).oidcError).toBe('failed');
  });

  it('should ignore unknown OIDC errors', () => {
    expect(createComponent({oidcError: '<b>x</b>'}).oidcError).toBe(null);
  });

  it('should show no OIDC error by default', () => {
    expect(createComponent().oidcError).toBe(null);
  });
});
