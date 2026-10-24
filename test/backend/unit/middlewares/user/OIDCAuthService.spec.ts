/* eslint-disable no-unused-expressions,@typescript-eslint/no-unused-expressions */
import {expect} from 'chai';
import {OIDCAuthService} from '../../../../../src/backend/middlewares/user/OIDCAuthService';
import {ObjectManagers} from '../../../../../src/backend/model/ObjectManagers';
import {Config} from '../../../../../src/common/config/private/Config';
import {ErrorCodes} from '../../../../../src/common/entities/Error';
import {Issuer} from 'openid-client';


describe('OIDCAuthService', () => {

  const createTokenSet = (claims: Record<string, unknown>, accessToken: string | null = 'access-token'): any => ({
    access_token: accessToken,
    claims: () => claims
  });

  const createClient = (tokenSet: any, userinfo: Record<string, unknown> | Error = {}) => {
    const client = {
      userinfoCalls: [] as string[],
      callback: async () => tokenSet,
      userinfo: async (accessToken: string) => {
        client.userinfoCalls.push(accessToken);
        if (userinfo instanceof Error) {
          throw userinfo;
        }
        return userinfo;
      }
    };
    return client;
  };

  let origUrlBase: string;
  beforeEach(() => {
    origUrlBase = Config.Server.urlBase;
  });
  afterEach(() => {
    Config.Server.urlBase = origUrlBase;
  });

  describe('selectIdTokenAlg', () => {
    it('should default to RS256 if the provider does not advertise algorithms', () => {
      expect(OIDCAuthService.selectIdTokenAlg(undefined)).to.equal('RS256');
      expect(OIDCAuthService.selectIdTokenAlg([])).to.equal('RS256');
    });

    it('should prefer RS256 if supported', () => {
      expect(OIDCAuthService.selectIdTokenAlg(['PS256', 'RS256'])).to.equal('RS256');
    });

    it('should use the first advertised algorithm if RS256 is not supported', () => {
      expect(OIDCAuthService.selectIdTokenAlg(['PS256'])).to.equal('PS256');
      expect(OIDCAuthService.selectIdTokenAlg(['ES256', 'PS256'])).to.equal('ES256');
      expect(OIDCAuthService.selectIdTokenAlg(['HS256'])).to.equal('HS256');
    });
  });

  describe('getClient', () => {
    let origDiscover: typeof Issuer.discover;
    let origClientPromise: Promise<any>;
    let origOidc: any;

    beforeEach(() => {
      origDiscover = Issuer.discover;
      origClientPromise = (OIDCAuthService as any).clientPromise;
      (OIDCAuthService as any).clientPromise = null;
      origOidc = {
        enabled: Config.Users.oidc.enabled,
        issuerUrl: Config.Users.oidc.issuerUrl,
        clientId: Config.Users.oidc.clientId,
        clientSecret: Config.Users.oidc.clientSecret,
        redirectUri: Config.Users.oidc.redirectUri
      };
      Config.Users.oidc.enabled = true;
      Config.Users.oidc.issuerUrl = 'https://idp.example.com';
      Config.Users.oidc.clientId = 'client';
      Config.Users.oidc.clientSecret = 'secret';
      Config.Users.oidc.redirectUri = 'https://example.com/pgapi/auth/oidc/callback';
    });

    afterEach(() => {
      Issuer.discover = origDiscover;
      (OIDCAuthService as any).clientPromise = origClientPromise;
      Object.assign(Config.Users.oidc, origOidc);
    });

    const getClientWithAlgs = async (algs?: string[]): Promise<any> => {
      Issuer.discover = (async () => new Issuer({
        issuer: 'https://idp.example.com',
        authorization_endpoint: 'https://idp.example.com/auth',
        token_endpoint: 'https://idp.example.com/token',
        jwks_uri: 'https://idp.example.com/jwks',
        id_token_signing_alg_values_supported: algs
      })) as any;
      return (OIDCAuthService as any).getClient();
    };

    it('should use the algorithm advertised by the provider', async () => {
      const client = await getClientWithAlgs(['PS256']);
      expect(client.metadata.id_token_signed_response_alg).to.equal('PS256');
    });

    it('should keep RS256 if the provider supports it', async () => {
      const client = await getClientWithAlgs(['RS256', 'PS256']);
      expect(client.metadata.id_token_signed_response_alg).to.equal('RS256');
    });

    it('should keep RS256 if the provider does not advertise algorithms', async () => {
      const client = await getClientWithAlgs(undefined);
      expect(client.metadata.id_token_signed_response_alg).to.equal('RS256');
    });
  });

  describe('getAppRootUrl', () => {
    it('should return / without urlBase', () => {
      Config.Server.urlBase = '';
      expect(OIDCAuthService.getAppRootUrl()).to.equal('/');
      Config.Server.urlBase = '/';
      expect(OIDCAuthService.getAppRootUrl()).to.equal('/');
    });

    it('should respect urlBase', () => {
      for (const base of ['/galerie', 'galerie', '/galerie/', 'galerie/']) {
        Config.Server.urlBase = base;
        expect(OIDCAuthService.getAppRootUrl()).to.equal('/galerie/', base);
      }
      Config.Server.urlBase = '/my/galerie';
      expect(OIDCAuthService.getAppRootUrl()).to.equal('/my/galerie/');
    });
  });

  describe('getClaims', () => {
    it('should not call userinfo if the ID token has all required claims', async () => {
      const tokenSet = createTokenSet({preferred_username: 'alice', email: 'alice@example.com'});
      const client = createClient(tokenSet, {preferred_username: 'other'});

      const claims = await OIDCAuthService.getClaims(client as any, tokenSet, ['preferred_username', 'email']);

      expect(claims).to.deep.equal({preferred_username: 'alice', email: 'alice@example.com'});
      expect(client.userinfoCalls).to.be.empty;
    });

    it('should fill missing claims from userinfo', async () => {
      const tokenSet = createTokenSet({sub: '123'});
      const client = createClient(tokenSet, {sub: '123', preferred_username: 'alice', email: 'alice@example.com'});

      const claims = await OIDCAuthService.getClaims(client as any, tokenSet, ['preferred_username', 'email']);

      expect(claims).to.deep.equal({sub: '123', preferred_username: 'alice', email: 'alice@example.com'});
      expect(client.userinfoCalls).to.deep.equal(['access-token']);
    });

    it('should not override ID token claims with userinfo', async () => {
      const tokenSet = createTokenSet({preferred_username: 'alice'});
      const client = createClient(tokenSet, {preferred_username: 'mallory', email: 'alice@example.com'});

      const claims = await OIDCAuthService.getClaims(client as any, tokenSet, ['preferred_username', 'email']);

      expect(claims.preferred_username).to.equal('alice');
      expect(claims.email).to.equal('alice@example.com');
    });

    it('should fall back to ID token claims if userinfo fails', async () => {
      const tokenSet = createTokenSet({preferred_username: 'alice'});
      const client = createClient(tokenSet, new Error('userinfo not available'));

      const claims = await OIDCAuthService.getClaims(client as any, tokenSet, ['preferred_username', 'email']);

      expect(claims).to.deep.equal({preferred_username: 'alice'});
    });

    it('should not call userinfo without access token', async () => {
      const tokenSet = createTokenSet({preferred_username: 'alice'}, null);
      const client = createClient(tokenSet, {email: 'alice@example.com'});

      const claims = await OIDCAuthService.getClaims(client as any, tokenSet, ['preferred_username', 'email']);

      expect(claims).to.deep.equal({preferred_username: 'alice'});
      expect(client.userinfoCalls).to.be.empty;
    });
  });

  describe('callback', () => {
    let origInstance: ObjectManagers;
    let origClientPromise: Promise<any>;
    let origOidc: any;
    let foundUserNames: string[];

    beforeEach(() => {
      origInstance = (ObjectManagers as any).instance;
      origClientPromise = (OIDCAuthService as any).clientPromise;
      origOidc = {
        usernameClaim: Config.Users.oidc.usernameClaim,
        emailClaim: Config.Users.oidc.emailClaim,
        autoCreateUser: Config.Users.oidc.autoCreateUser,
        allowedDomains: Config.Users.oidc.allowedDomains
      };
      Config.Users.oidc.usernameClaim = 'preferred_username';
      Config.Users.oidc.emailClaim = 'email';
      Config.Users.oidc.autoCreateUser = false;
      Config.Users.oidc.allowedDomains = [];
      foundUserNames = [];
      (ObjectManagers as any).instance = {
        UserManager: {
          findOne: async (filter: { name: string }) => {
            foundUserNames.push(filter.name);
            return {id: 1, name: filter.name};
          }
        },
        SessionManager: {
          buildContext: async (user: any) => ({user})
        }
      };
    });

    afterEach(() => {
      (ObjectManagers as any).instance = origInstance;
      (OIDCAuthService as any).clientPromise = origClientPromise;
      Object.assign(Config.Users.oidc, origOidc);
    });

    const runCallback = async (client: any) => {
      (OIDCAuthService as any).clientPromise = Promise.resolve(client);
      const req: any = {
        session: {oidc: {state: 'state', verifier: 'verifier'}},
        query: {code: 'code', state: 'state'}
      };
      let redirectedTo: string = null;
      const res: any = {
        redirect: (url: string) => {
          redirectedTo = url;
        }
      };
      await OIDCAuthService.callback(req, res);
      return {req, redirectedTo};
    };

    it('should log in with ID token claims and redirect to root', async () => {
      Config.Server.urlBase = '';
      const tokenSet = createTokenSet({preferred_username: 'alice', email: 'alice@example.com'});
      const client = createClient(tokenSet);

      const {req, redirectedTo} = await runCallback(client);

      expect(foundUserNames).to.deep.equal(['alice']);
      expect(req.session.context.user.name).to.equal('alice');
      expect(req.session.oidc).to.be.undefined;
      expect(client.userinfoCalls).to.be.empty;
      expect(redirectedTo).to.equal('/');
    });

    it('should log in with userinfo claims and redirect to urlBase', async () => {
      Config.Server.urlBase = '/galerie';
      const tokenSet = createTokenSet({sub: '123'});
      const client = createClient(tokenSet, {preferred_username: 'alice', email: 'alice@example.com'});

      const {req, redirectedTo} = await runCallback(client);

      expect(foundUserNames).to.deep.equal(['alice']);
      expect(req.session.context.user.name).to.equal('alice');
      expect(redirectedTo).to.equal('/galerie/');
    });

    it('should fail if neither ID token nor userinfo has username or email', async () => {
      const tokenSet = createTokenSet({sub: '123'});
      const client = createClient(tokenSet, {sub: '123'});

      let error: any = null;
      try {
        await runCallback(client);
      } catch (err) {
        error = err;
      }
      expect(error).to.not.be.null;
      expect(error.code).to.equal(ErrorCodes.CREDENTIAL_NOT_FOUND);
      expect(foundUserNames).to.be.empty;
    });
  });
});
