import {LoginComponent} from './login.component';
import {Config} from '../../../../common/config/public/Config';

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

  const createComponent = () => new LoginComponent(null, null);

  it('should link OIDC login to the api path without urlBase', () => {
    Config.Server.urlBase = '';
    expect(createComponent().oidcLoginUrl).toBe('/pgapi/auth/oidc/login');
  });

  it('should prefix OIDC login with urlBase', () => {
    Config.Server.urlBase = '/galerie';
    expect(createComponent().oidcLoginUrl).toBe('/galerie/pgapi/auth/oidc/login');
  });
});
