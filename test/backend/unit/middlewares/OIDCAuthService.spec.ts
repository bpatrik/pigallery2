/* eslint-disable no-unused-expressions,@typescript-eslint/no-unused-expressions */
import {expect} from 'chai';
import {Config} from '../../../../src/common/config/private/Config';
import {OIDCAuthService} from '../../../../src/backend/middlewares/user/OIDCAuthService';
import {ObjectManagers} from '../../../../src/backend/model/ObjectManagers';
import {UserDTO, UserRoles} from '../../../../src/common/entities/UserDTO';
import {ErrorCodes, ErrorDTO} from '../../../../src/common/entities/Error';
import {DatabaseType} from '../../../../src/common/config/private/PrivateConfig';
import {SQLConnection} from '../../../../src/backend/model/database/SQLConnection';
import {DBTestHelper} from '../../DBTestHelper';
import {MockOIDCServer} from './MockOIDCServer';

declare const describe: any;
declare const before: any;
declare const after: any;
declare const beforeEach: any;
declare const afterEach: any;
declare const it: any;

interface MockResponseResult {
  redirectUrl: string | null;
}

function createMockReq(overrides: Record<string, any> = {}): any {
  return {
    session: {},
    query: {},
    ...overrides
  };
}

function createMockRes(): { res: any; getRedirectUrl: () => string | null } {
  const result: MockResponseResult = {
    redirectUrl: null
  };
  const res: any = {
    redirect: (url: string) => {
      result.redirectUrl = url;
    }
  };
  return {
    res,
    getRedirectUrl: () => result.redirectUrl
  };
}

describe('OIDCAuthService', () => {
  const sqlHelper = new DBTestHelper(DatabaseType.sqlite);
  const mockOidc = new MockOIDCServer();
  let issuerUrl: string;

  before(async () => {
    issuerUrl = await mockOidc.start();
    await sqlHelper.initDB();
    await ObjectManagers.getInstance().init();
  });

  after(async () => {
    await mockOidc.stop();
    await ObjectManagers.reset();
    await SQLConnection.close();
    await sqlHelper.clearDB();
  });

  beforeEach(async () => {
    OIDCAuthService.reset();
    Config.loadSync();
    Config.Users.oidc.enabled = true;
    Config.Users.oidc.issuerUrl = issuerUrl;
    Config.Users.oidc.clientId = 'test-client-id';
    Config.Users.oidc.clientSecret = 'test-client-secret';
    Config.Users.oidc.redirectUri = 'http://localhost:8081/pgapi/auth/oidc/callback';
    Config.Users.oidc.scopes = ['openid', 'profile', 'email'];
    Config.Users.oidc.usernameClaim = 'preferred_username';
    Config.Users.oidc.emailClaim = 'email';
    Config.Users.oidc.allowedDomains = [];
    Config.Users.oidc.autoCreateUser = false;
    Config.Server.urlBase = '';

    mockOidc.setClaims({
      sub: 'mock-sub-1',
      preferred_username: 'oidc_test_user',
      email: 'oidc_test_user@example.com'
    });
  });

  afterEach(async () => {
    Config.loadSync();
    Config.Server.urlBase = '';
    OIDCAuthService.reset();
  });

  describe('Configuration validation', () => {
    it('should throw when OIDC is disabled', async () => {
      Config.Users.oidc.enabled = false;
      const req = createMockReq();
      const {res} = createMockRes();
      try {
        await OIDCAuthService.login(req, res);
        expect.fail('Should have thrown');
      } catch (err: any) {
        expect(err.message).to.equal('OIDC is not enabled');
      }
    });

    it('should throw when issuerUrl is empty', async () => {
      Config.Users.oidc.issuerUrl = '';
      const req = createMockReq();
      const {res} = createMockRes();
      try {
        await OIDCAuthService.login(req, res);
        expect.fail('Should have thrown');
      } catch (err: any) {
        expect(err.message).to.equal('OIDC issuerUrl is not configured');
      }
    });
  });

  describe('login', () => {
    it('should generate PKCE challenge, state, store in session, and redirect to authorization URL', async () => {
      const req = createMockReq();
      const {res, getRedirectUrl} = createMockRes();

      await OIDCAuthService.login(req, res);

      expect(req.session.oidc).to.be.an('object');
      expect(req.session.oidc.state).to.be.a('string').and.not.empty;
      expect(req.session.oidc.verifier).to.be.a('string').and.not.empty;

      const redirectUrl = getRedirectUrl();
      expect(redirectUrl).to.be.a('string');

      const parsedUrl = new URL(redirectUrl!);
      expect(parsedUrl.pathname).to.equal('/auth');
      expect(parsedUrl.searchParams.get('client_id')).to.equal('test-client-id');
      expect(parsedUrl.searchParams.get('response_type')).to.equal('code');
      expect(parsedUrl.searchParams.get('state')).to.equal(req.session.oidc.state);
      expect(parsedUrl.searchParams.get('scope')).to.equal('openid profile email');
      expect(parsedUrl.searchParams.get('code_challenge_method')).to.equal('S256');
      expect(parsedUrl.searchParams.get('code_challenge')).to.be.a('string').and.not.empty;
    });
  });

  describe('callback - validation and error cases', () => {
    it('should throw GENERAL_ERROR when session has no oidc state', async () => {
      const req = createMockReq({query: {code: 'mock-code', state: 'some-state'}});
      const {res} = createMockRes();

      try {
        await OIDCAuthService.callback(req, res);
        expect.fail('Should have thrown');
      } catch (err: any) {
        expect(err).to.be.instanceOf(ErrorDTO);
        expect(err.code).to.equal(ErrorCodes.GENERAL_ERROR);
        expect(err.message).to.equal('Invalid OIDC state');
      }
    });

    it('should throw GENERAL_ERROR when query state does not match session state', async () => {
      const req = createMockReq({
        session: {oidc: {state: 'state-aaa', verifier: 'ver-aaa'}},
        query: {code: 'mock-code', state: 'state-bbb'}
      });
      const {res} = createMockRes();

      try {
        await OIDCAuthService.callback(req, res);
        expect.fail('Should have thrown');
      } catch (err: any) {
        expect(err).to.be.instanceOf(ErrorDTO);
        expect(err.code).to.equal(ErrorCodes.GENERAL_ERROR);
        expect(err.message).to.equal('Invalid OIDC state');
      }
    });

    it('should throw CREDENTIAL_NOT_FOUND when claims lack username and email', async () => {
      mockOidc.setClaims({sub: 'user-sub-only'});

      // Initiate login to set session oidc state & verifier
      const loginReq = createMockReq();
      const {res: loginRes} = createMockRes();
      await OIDCAuthService.login(loginReq, loginRes);

      const cbReq = createMockReq({
        session: loginReq.session,
        query: {code: 'mock-code', state: loginReq.session.oidc.state}
      });
      const {res: cbRes} = createMockRes();

      try {
        await OIDCAuthService.callback(cbReq, cbRes);
        expect.fail('Should have thrown');
      } catch (err: any) {
        expect(err).to.be.instanceOf(ErrorDTO);
        expect(err.code).to.equal(ErrorCodes.CREDENTIAL_NOT_FOUND);
        expect(err.message).to.equal('OIDC: missing username/email');
      }
    });

    it('should reject when email domain is not in allowedDomains', async () => {
      Config.Users.oidc.allowedDomains = ['trusted-company.com'];
      mockOidc.setClaims({
        sub: 'ext-user',
        preferred_username: 'ext_user',
        email: 'ext_user@untrusted.com'
      });

      const loginReq = createMockReq();
      const {res: loginRes} = createMockRes();
      await OIDCAuthService.login(loginReq, loginRes);

      const cbReq = createMockReq({
        session: loginReq.session,
        query: {code: 'mock-code', state: loginReq.session.oidc.state}
      });
      const {res: cbRes} = createMockRes();

      try {
        await OIDCAuthService.callback(cbReq, cbRes);
        expect.fail('Should have thrown');
      } catch (err: any) {
        expect(err).to.be.instanceOf(ErrorDTO);
        expect(err.code).to.equal(ErrorCodes.CREDENTIAL_NOT_FOUND);
        expect(err.message).to.contain('Email domain not allowed: untrusted.com');
      }
    });

    it('should reject when user does not exist in DB and autoCreateUser is false', async () => {
      Config.Users.oidc.autoCreateUser = false;
      mockOidc.setClaims({
        sub: 'sub-nonexistent',
        preferred_username: 'nonexistent_user',
        email: 'nonexistent_user@example.com'
      });

      const loginReq = createMockReq();
      const {res: loginRes} = createMockRes();
      await OIDCAuthService.login(loginReq, loginRes);

      const cbReq = createMockReq({
        session: loginReq.session,
        query: {code: 'mock-code', state: loginReq.session.oidc.state}
      });
      const {res: cbRes} = createMockRes();

      try {
        await OIDCAuthService.callback(cbReq, cbRes);
        expect.fail('Should have thrown');
      } catch (err: any) {
        expect(err).to.be.instanceOf(ErrorDTO);
        expect(err.code).to.equal(ErrorCodes.CREDENTIAL_NOT_FOUND);
        expect(err.message).to.equal('User not found');
      }
    });

    it('should throw when callback query contains error from IdP', async () => {
      const loginReq = createMockReq();
      const {res: loginRes} = createMockRes();
      await OIDCAuthService.login(loginReq, loginRes);

      const cbReq = createMockReq({
        session: loginReq.session,
        query: {
          error: 'access_denied',
          error_description: 'User denied authorization',
          state: loginReq.session.oidc.state
        }
      });
      const {res: cbRes} = createMockRes();

      try {
        await OIDCAuthService.callback(cbReq, cbRes);
        expect.fail('Should have thrown');
      } catch (err: any) {
        expect(err).to.exist;
        expect(err.error || err.message).to.contain('access_denied');
      }
    });
  });

  describe('callback - successful authentication flows', () => {
    it('should authenticate existing user matching preferred_username claim', async () => {
      const existingUser: UserDTO = {
        name: 'alice_existing',
        password: 'password123',
        role: UserRoles.User
      } as any;
      await ObjectManagers.getInstance().UserManager.createUser(existingUser);

      mockOidc.setClaims({
        sub: 'alice-sub',
        preferred_username: 'alice_existing',
        email: 'alice@example.com'
      });

      const loginReq = createMockReq();
      const {res: loginRes} = createMockRes();
      await OIDCAuthService.login(loginReq, loginRes);

      const cbReq = createMockReq({
        session: loginReq.session,
        query: {code: 'mock-code-alice', state: loginReq.session.oidc.state}
      });
      const {res: cbRes, getRedirectUrl} = createMockRes();

      await OIDCAuthService.callback(cbReq, cbRes);

      expect(getRedirectUrl()).to.equal('/');
      expect(cbReq.session.oidc).to.be.undefined;
      expect(mockOidc.lastTokenRequestBody).to.be.an('object');
      expect(mockOidc.lastTokenRequestBody?.grant_type).to.equal('authorization_code');
      expect(mockOidc.lastTokenRequestBody?.code).to.equal('mock-code-alice');
      expect(mockOidc.lastTokenRequestBody?.redirect_uri).to.equal(Config.Users.oidc.redirectUri);
      expect(mockOidc.lastTokenRequestBody?.client_id).to.equal('test-client-id');
      expect(mockOidc.lastTokenRequestBody?.client_secret).to.equal('test-client-secret');
      expect(mockOidc.lastTokenRequestBody?.code_verifier).to.be.a('string').and.not.empty;
      expect(cbReq.session.rememberMe).to.be.true;
      expect(cbReq.session.context).to.be.an('object');
      expect(cbReq.session.context.user.name).to.equal('alice_existing');
      expect(cbReq.session.context.user.role).to.equal(UserRoles.User);
    });

    it('should fallback to email prefix when preferred_username claim is empty', async () => {
      const existingUser: UserDTO = {
        name: 'charlie',
        password: 'password123',
        role: UserRoles.User
      } as any;
      await ObjectManagers.getInstance().UserManager.createUser(existingUser);

      mockOidc.setClaims({
        sub: 'charlie-sub',
        preferred_username: '',
        email: 'charlie@company.org'
      });

      const loginReq = createMockReq();
      const {res: loginRes} = createMockRes();
      await OIDCAuthService.login(loginReq, loginRes);

      const cbReq = createMockReq({
        session: loginReq.session,
        query: {code: 'mock-code-charlie', state: loginReq.session.oidc.state}
      });
      const {res: cbRes, getRedirectUrl} = createMockRes();

      await OIDCAuthService.callback(cbReq, cbRes);

      expect(getRedirectUrl()).to.equal('/');
      expect(cbReq.session.context.user.name).to.equal('charlie');
    });

    it('should auto-create new user with Guest role when autoCreateUser is enabled', async () => {
      Config.Users.oidc.autoCreateUser = true;

      mockOidc.setClaims({
        sub: 'newbie-sub',
        preferred_username: 'new_guest_user',
        email: 'new_guest@example.com'
      });

      const loginReq = createMockReq();
      const {res: loginRes} = createMockRes();
      await OIDCAuthService.login(loginReq, loginRes);

      const cbReq = createMockReq({
        session: loginReq.session,
        query: {code: 'mock-code-newbie', state: loginReq.session.oidc.state}
      });
      const {res: cbRes, getRedirectUrl} = createMockRes();

      await OIDCAuthService.callback(cbReq, cbRes);

      expect(getRedirectUrl()).to.equal('/');
      expect(cbReq.session.context).to.be.an('object');
      expect(cbReq.session.context.user.name).to.equal('new_guest_user');
      expect(cbReq.session.context.user.role).to.equal(UserRoles.Guest);

      // Verify user was persisted in database
      const dbUser = await ObjectManagers.getInstance().UserManager.findOne({name: 'new_guest_user'});
      expect(dbUser).to.be.an('object');
      expect(dbUser.role).to.equal(UserRoles.Guest);
    });

    it('should allow login when email matches allowedDomains case-insensitively', async () => {
      Config.Users.oidc.allowedDomains = ['Enterprise.Com'];
      Config.Users.oidc.autoCreateUser = true;

      mockOidc.setClaims({
        sub: 'corp-sub',
        preferred_username: 'corp_user',
        email: 'corp_user@enterprise.com'
      });

      const loginReq = createMockReq();
      const {res: loginRes} = createMockRes();
      await OIDCAuthService.login(loginReq, loginRes);

      const cbReq = createMockReq({
        session: loginReq.session,
        query: {code: 'mock-code-corp', state: loginReq.session.oidc.state}
      });
      const {res: cbRes, getRedirectUrl} = createMockRes();

      await OIDCAuthService.callback(cbReq, cbRes);

      expect(getRedirectUrl()).to.equal('/');
      expect(cbReq.session.context.user.name).to.equal('corp_user');
    });

    it('should redirect to subpath when Config.Server.urlBase is set', async () => {
      Config.Server.urlBase = 'gallery';
      Config.Users.oidc.autoCreateUser = true;

      mockOidc.setClaims({
        sub: 'subpath-sub',
        preferred_username: 'subpath_user',
        email: 'subpath@example.com'
      });

      const loginReq = createMockReq();
      const {res: loginRes} = createMockRes();
      await OIDCAuthService.login(loginReq, loginRes);

      const cbReq = createMockReq({
        session: loginReq.session,
        query: {code: 'mock-code-subpath', state: loginReq.session.oidc.state}
      });
      const {res: cbRes, getRedirectUrl} = createMockRes();

      await OIDCAuthService.callback(cbReq, cbRes);

      expect(getRedirectUrl()).to.equal('/gallery/');
    });

    it('should respect custom usernameClaim and emailClaim configuration', async () => {
      Config.Users.oidc.usernameClaim = 'nickname';
      Config.Users.oidc.emailClaim = 'work_email';
      Config.Users.oidc.allowedDomains = ['custom.org'];
      Config.Users.oidc.autoCreateUser = true;

      mockOidc.setClaims({
        sub: 'custom-sub',
        nickname: 'nicky',
        work_email: 'nicky@custom.org'
      });

      const loginReq = createMockReq();
      const {res: loginRes} = createMockRes();
      await OIDCAuthService.login(loginReq, loginRes);

      const cbReq = createMockReq({
        session: loginReq.session,
        query: {code: 'mock-code-custom', state: loginReq.session.oidc.state}
      });
      const {res: cbRes} = createMockRes();

      await OIDCAuthService.callback(cbReq, cbRes);

      expect(cbReq.session.context.user.name).to.equal('nicky');
    });
  });
});
