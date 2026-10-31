/* eslint-disable no-unused-expressions,@typescript-eslint/no-unused-expressions */
import {expect} from 'chai';
import {OIDCAuthService} from '../../../../../src/backend/middlewares/user/OIDCAuthService';
import {ObjectManagers} from '../../../../../src/backend/model/ObjectManagers';
import {Config} from '../../../../../src/common/config/private/Config';
import {ErrorCodes} from '../../../../../src/common/entities/Error';
import {Issuer} from 'openid-client';
import {UserDTO, UserRoles} from '../../../../../src/common/entities/UserDTO';
import {TestHelper} from '../../../../TestHelper';


describe('OIDCAuthService', () => {
  before(TestHelper.resetConfig);

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

    it('should ignore userinfo of a different subject', async () => {
      const tokenSet = createTokenSet({sub: '123'});
      const client = createClient(tokenSet, {sub: '456', preferred_username: 'mallory'});

      const claims = await OIDCAuthService.getClaims(client as any, tokenSet, ['preferred_username', 'email']);

      expect(claims).to.deep.equal({sub: '123'});
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

  describe('getUserFromAuthenticationResponse', () => {
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
        allowedDomains: Config.Users.oidc.allowedDomains,
        strictSecurity: Config.Users.oidc.strictSecurity,
        strictLinkMaxRole: Config.Users.oidc.strictLinkMaxRole
      };
      Config.Users.oidc.usernameClaim = 'preferred_username';
      Config.Users.oidc.emailClaim = 'email';
      Config.Users.oidc.autoCreateUser = false;
      Config.Users.oidc.allowedDomains = [];
      Config.Users.oidc.strictSecurity = false;
      Config.Users.oidc.strictLinkMaxRole = UserRoles.User;
      foundUserNames = [];
      (ObjectManagers as any).instance = {
        UserManager: {
          findOne: async (filter: { name: string }) => {
            foundUserNames.push(filter.name);
            return {id: 1, name: filter.name};
          }
        }
      };
    });

    afterEach(() => {
      (ObjectManagers as any).instance = origInstance;
      (OIDCAuthService as any).clientPromise = origClientPromise;
      Object.assign(Config.Users.oidc, origOidc);
    });

    const getUser = async (client: any) => {
      (OIDCAuthService as any).clientPromise = Promise.resolve(client);
      const req: any = {
        session: {oidc: {state: 'state', verifier: 'verifier'}},
        query: {code: 'code', state: 'state'}
      };
      const user = await OIDCAuthService.getUserFromAuthenticationResponse(req);
      return {req, user};
    };

    it('should log in with ID token claims', async () => {
      const tokenSet = createTokenSet({preferred_username: 'alice', email: 'alice@example.com'});
      const client = createClient(tokenSet);

      const {req, user} = await getUser(client);

      expect(foundUserNames).to.deep.equal(['alice']);
      expect(user.name).to.equal('alice');
      expect(req.session.oidc).to.be.undefined;
      expect(client.userinfoCalls).to.be.empty;
    });

    it('should log in with userinfo claims', async () => {
      const tokenSet = createTokenSet({sub: '123'});
      const client = createClient(tokenSet, {sub: '123', preferred_username: 'alice', email: 'alice@example.com'});

      const {req, user} = await getUser(client);

      expect(foundUserNames).to.deep.equal(['alice']);
      expect(user.name).to.equal('alice');
    });

    it('should fail if neither ID token nor userinfo has username or email', async () => {
      const tokenSet = createTokenSet({sub: '123'});
      const client = createClient(tokenSet, {sub: '123'});

      let error: any = null;
      try {
        await getUser(client);
      } catch (err) {
        error = err;
      }
      expect(error).to.not.be.null;
      expect(error.code).to.equal(ErrorCodes.CREDENTIAL_NOT_FOUND);
      expect(foundUserNames).to.be.empty;
    });

    const expectLoginError = async (client: any): Promise<any> => {
      let error: any = null;
      try {
        await getUser(client);
      } catch (err) {
        error = err;
      }
      expect(error).to.not.be.null;
      expect(error.code).to.equal(ErrorCodes.CREDENTIAL_NOT_FOUND);
      return error;
    };

    it('should use the email local part as fallback name', async () => {
      const tokenSet = createTokenSet({sub: '123', email: 'alice@example.com'});

      const {user} = await getUser(createClient(tokenSet, new Error('no userinfo')));

      expect(user.name).to.equal('alice');
    });

    it('should reject a missing email if allowed domains are set', async () => {
      Config.Users.oidc.allowedDomains = ['example.com'];
      const tokenSet = createTokenSet({sub: '123', preferred_username: 'alice'});

      await expectLoginError(createClient(tokenSet, new Error('no userinfo')));
      expect(foundUserNames).to.be.empty;
    });

    describe('strict security', () => {
      const ISS = 'https://idp.example.com';
      let users: UserDTO[];

      beforeEach(() => {
        Config.Users.oidc.strictSecurity = true;
        users = [
          {id: 1, name: 'admin', role: UserRoles.Admin},
          {id: 2, name: 'alice', role: UserRoles.User},
          {id: 3, name: 'bob', role: UserRoles.User, oidcSubject: ISS + '|bob-sub'}
        ];
        (ObjectManagers as any).instance = {
          UserManager: {
            findOne: async (filter: Partial<UserDTO>) =>
              users.find(u => Object.keys(filter).every((k: keyof UserDTO) => u[k] === filter[k])) || null,
            setOidcSubject: async (id: number, oidcSubject: string) => {
              const u = users.find(e => e.id === id);
              u.oidcSubject = oidcSubject;
              return u;
            },
            createUser: async (user: UserDTO) => {
              const u = {...user, id: users.length + 1};
              users.push(u);
              return u;
            }
          }
        };
      });

      const login = (claims: Record<string, unknown>) =>
        getUser(createClient(createTokenSet({iss: ISS, ...claims}), new Error('no userinfo')));

      it('should link an unlinked user on first login and use the link later', async () => {
        const {user} = await login({sub: 'alice-sub', preferred_username: 'alice'});
        expect(user.id).to.equal(2);
        expect(users[1].oidcSubject).to.equal(ISS + '|alice-sub');

        // renamed at the provider, still the same account
        const {user: user2} = await login({sub: 'alice-sub', preferred_username: 'alice2'});
        expect(user2.id).to.equal(2);
      });

      it('should reject a different account with the name of a linked user', async () => {
        await expectLoginError(createClient(createTokenSet({iss: ISS, sub: 'mallory', preferred_username: 'bob'})));
        expect(users[2].oidcSubject).to.equal(ISS + '|bob-sub');
      });

      it('should not link a user above the max link role', async () => {
        await expectLoginError(createClient(createTokenSet({iss: ISS, sub: 'mallory', preferred_username: 'admin'})));
        expect(users[0].oidcSubject).to.be.undefined;
      });

      it('should link an admin if the max link role allows it', async () => {
        Config.Users.oidc.strictLinkMaxRole = UserRoles.Admin;
        const {user} = await login({sub: 'admin-sub', preferred_username: 'admin'});
        expect(user.id).to.equal(1);
        expect(users[0].oidcSubject).to.equal(ISS + '|admin-sub');
      });

      it('should reject a token without subject', async () => {
        await expectLoginError(createClient(createTokenSet({iss: ISS, preferred_username: 'alice'})));
        expect(users[1].oidcSubject).to.be.undefined;
      });

      it('should use the full email as fallback name only if verified', async () => {
        users.push({id: 4, name: 'carol', role: UserRoles.User});
        users.push({id: 5, name: 'carol@example.com', role: UserRoles.User});

        await expectLoginError(createClient(createTokenSet({iss: ISS, sub: 'c', email: 'carol@example.com'}), new Error('-')));

        const {user} = await login({sub: 'c', email: 'carol@example.com', email_verified: true});
        expect(user.id).to.equal(5);
      });

      it('should link auto-created users', async () => {
        Config.Users.oidc.autoCreateUser = true;
        const {user} = await login({sub: 'dave-sub', preferred_username: 'dave'});
        expect(user.name).to.equal('dave');
        expect(user.oidcSubject).to.equal(ISS + '|dave-sub');
      });
    });
  });
});
