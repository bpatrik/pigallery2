import {Config} from '../../../../src/common/config/private/Config';
import {Server} from '../../../../src/backend/server';
import {UserDTO, UserRoles} from '../../../../src/common/entities/UserDTO';
import {SQLConnection} from '../../../../src/backend/model/database/SQLConnection';
import {ObjectManagers} from '../../../../src/backend/model/ObjectManagers';
import {DatabaseType} from '../../../../src/common/config/private/PrivateConfig';
import * as chai from 'chai';
import {default as chaiHttp, request} from 'chai-http';
import {DBTestHelper} from '../../DBTestHelper';
import {MockOIDCServer} from '../../unit/middlewares/MockOIDCServer';
import {OIDCAuthService} from '../../../../src/backend/middlewares/user/OIDCAuthService';
import {RouteTestingHelper} from './RouteTestingHelper';

process.env.NODE_ENV = 'test';
const should = chai.should();
chai.use(chaiHttp);

describe('OIDCRouter', () => {
  const sqlHelper = new DBTestHelper(DatabaseType.sqlite);
  const mockOidc = new MockOIDCServer();
  let server: Server;
  let issuerUrl: string;

  before(async () => {
    issuerUrl = await mockOidc.start();
  });

  after(async () => {
    await mockOidc.stop();
  });

  const setUp = async () => {
    OIDCAuthService.reset();
    await sqlHelper.initDB();
    server = new Server(false);
    await server.onStarted.wait();
    await ObjectManagers.getInstance().init();

    Config.loadSync();
    Config.Server.urlBase = '';
    Config.Users.oidc.enabled = true;
    Config.Users.oidc.issuerUrl = issuerUrl;
    Config.Users.oidc.clientId = 'test-client-id';
    Config.Users.oidc.clientSecret = 'test-client-secret';
    Config.Users.oidc.redirectUri = 'http://localhost:8081/pgapi/auth/oidc/callback';
    Config.Users.oidc.scopes = ['openid', 'profile', 'email'];
    Config.Users.oidc.usernameClaim = 'preferred_username';
    Config.Users.oidc.emailClaim = 'email';
    Config.Users.oidc.allowedDomains = [];
    Config.Users.oidc.autoCreateUser = true;

    mockOidc.setClaims({
      sub: 'route-user-1',
      preferred_username: 'oidc_route_user',
      email: 'oidc_route_user@example.com'
    });
  };

  const tearDown = async () => {
    OIDCAuthService.reset();
    await ObjectManagers.reset();
    await SQLConnection.close();
    await sqlHelper.clearDB();
  };

  describe('When OIDC is disabled', () => {
    beforeEach(setUp);
    afterEach(tearDown);

    it('GET /auth/oidc/login should return 404', async () => {
      Config.Users.oidc.enabled = false;
      const res = await request.execute(server.Server)
        .get(Config.Server.apiPath + '/auth/oidc/login');
      res.should.have.status(404);
    });

    it('GET /auth/oidc/callback should return 404', async () => {
      Config.Users.oidc.enabled = false;
      const res = await request.execute(server.Server)
        .get(Config.Server.apiPath + '/auth/oidc/callback');
      res.should.have.status(404);
    });
  });

  describe('When OIDC is enabled', () => {
    beforeEach(setUp);
    afterEach(tearDown);

    it('GET /auth/oidc/login should redirect to IdP authorization URL and set session', async () => {
      const res = await request.execute(server.Server)
        .get(Config.Server.apiPath + '/auth/oidc/login')
        .redirects(0);

      res.should.have.status(302);
      res.headers.should.have.property('location');
      const location = res.headers.location;
      location.should.contain('/auth?');
      location.should.contain('client_id=test-client-id');
      location.should.contain('code_challenge=');
      location.should.contain('code_challenge_method=S256');

      res.headers.should.have.property('set-cookie');
    });

    it('Full OIDC flow: login -> callback -> authenticated /user/me', async () => {
      // 1. Hit /auth/oidc/login to initiate flow and receive session cookie
      const loginRes = await request.execute(server.Server)
        .get(Config.Server.apiPath + '/auth/oidc/login')
        .redirects(0);

      loginRes.should.have.status(302);
      const sessionCookie = loginRes.headers['set-cookie'];
      sessionCookie.should.be.an('array').and.not.empty;

      const location = new URL(loginRes.headers.location);
      const state = location.searchParams.get('state');
      should.exist(state);

      // 2. Hit /auth/oidc/callback with returned state and authorization code
      const cbRes = await request.execute(server.Server)
        .get(Config.Server.apiPath + '/auth/oidc/callback')
        .query({code: 'mock-auth-code', state})
        .set('Cookie', sessionCookie)
        .redirects(0);

      cbRes.should.have.status(302);
      cbRes.headers.should.have.property('location');
      cbRes.headers.location.should.equal('/');

      // 3. Verify that the updated session cookie authenticates requests to /user/me
      const updatedCookie = cbRes.headers['set-cookie'] || sessionCookie;
      const meRes = await request.execute(server.Server)
        .get(Config.Server.apiPath + '/user/me')
        .set('Cookie', updatedCookie);

      meRes.should.have.status(200);
      meRes.body.should.be.a('object');
      should.equal(meRes.body.error, null);
      const user = meRes.body.result;
      user.should.have.property('name', 'oidc_route_user');
      user.should.have.property('role', UserRoles.Guest);
      user.should.not.have.property('password');
    });
  });
});
