import {expect} from 'chai';
import * as crypto from 'node:crypto';
import {OIDCAuthService} from '../../../../../src/backend/middlewares/user/OIDCAuthService';
import {ObjectManagers} from '../../../../../src/backend/model/ObjectManagers';
import {Config} from '../../../../../src/common/config/private/Config';
import {ErrorCodes, ErrorDTO} from '../../../../../src/common/entities/Error';
import {UserDTO, UserRoles} from '../../../../../src/common/entities/UserDTO';
import {TestHelper} from '../../../../TestHelper';

/**
 * A fake OIDC provider behind globalThis.fetch, so the tests go through the real openid-client.
 */
class FakeProvider {
  private static readonly keys = crypto.generateKeyPairSync('rsa', {modulusLength: 2048});

  algs: string[] | undefined = ['RS256'];
  tokenAlg = 'RS256';
  idTokenClaims: Record<string, unknown> = {};
  userinfo: Record<string, unknown> | null = null;
  discoveryIssuer: string;
  endpointBase: string;
  requests: { url: URL, init?: RequestInit }[] = [];
  failDiscovery = false;
  private codeChallenge = '';

  constructor(public issuer: string) {
    this.discoveryIssuer = issuer;
    this.endpointBase = issuer.replace(/\/$/, '');
  }

  setAuthorizationUrl(url: string): void {
    this.codeChallenge = new URL(url).searchParams.get('code_challenge') || '';
  }

  requestsTo(path: string): { url: URL, init?: RequestInit }[] {
    return this.requests.filter(r => r.url.pathname.endsWith(path));
  }

  readonly fetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = new URL(input instanceof Request ? input.url : input);
    this.requests.push({url, init});
    if (url.pathname.endsWith('/.well-known/openid-configuration')) {
      if (this.failDiscovery) {
        return new Response('down', {status: 503});
      }
      return Response.json({
        issuer: this.discoveryIssuer,
        authorization_endpoint: this.endpointBase + '/auth',
        token_endpoint: this.endpointBase + '/token',
        userinfo_endpoint: this.endpointBase + '/userinfo',
        jwks_uri: this.endpointBase + '/jwks',
        id_token_signing_alg_values_supported: this.algs
      });
    }
    if (url.pathname.endsWith('/token')) {
      const body = new URLSearchParams(init?.body as string);
      const challenge = crypto.createHash('sha256').update(body.get('code_verifier') || '').digest('base64url');
      if (body.get('code') !== 'code' || challenge !== this.codeChallenge) {
        return Response.json({error: 'invalid_grant'}, {status: 400});
      }
      return Response.json({
        access_token: 'access-token',
        token_type: 'Bearer',
        expires_in: 300,
        id_token: this.signIdToken()
      });
    }
    if (url.pathname.endsWith('/userinfo')) {
      if (!this.userinfo) {
        return new Response('not available', {status: 500});
      }
      return Response.json(this.userinfo);
    }
    if (url.pathname.endsWith('/jwks')) {
      return Response.json({keys: [{...FakeProvider.keys.publicKey.export({format: 'jwk'}), kid: 'k1', use: 'sig'}]});
    }
    return new Response('not found', {status: 404});
  };

  private signIdToken(): string {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: this.issuer,
      aud: Config.Users.oidc.clientId,
      iat: now,
      exp: now + 300,
      ...this.idTokenClaims
    };
    const encode = (o: unknown): string => Buffer.from(JSON.stringify(o)).toString('base64url');
    const data = encode({alg: this.tokenAlg, typ: 'JWT', kid: 'k1'}) + '.' + encode(payload);
    const key = this.tokenAlg === 'PS256' ?
      {key: FakeProvider.keys.privateKey, padding: crypto.constants.RSA_PKCS1_PSS_PADDING, saltLength: 32} :
      FakeProvider.keys.privateKey;
    return data + '.' + crypto.sign('sha256', Buffer.from(data), key).toString('base64url');
  }
}

describe('OIDCAuthService', () => {
  before(TestHelper.resetConfig);

  const ISS = 'https://idp.example.com/application/o/pigallery2/';
  const REDIRECT_URI = 'https://photos.example.com/pgapi/auth/oidc/callback';
  const OIDC_KEYS = ['enabled', 'issuerUrl', 'clientId', 'clientSecret', 'redirectUri', 'scopes', 'usernameClaim',
    'emailClaim', 'autoCreateUser', 'allowedDomains', 'strictSecurity', 'strictLinkMaxRole'] as const;

  let provider: FakeProvider;
  let origFetch: typeof fetch;
  let origInstance: ObjectManagers;
  let origOidc: Record<string, unknown>;
  let users: UserDTO[];
  let foundFilters: Partial<UserDTO>[];

  beforeEach(() => {
    origFetch = globalThis.fetch;
    origInstance = (ObjectManagers as any).instance;
    origOidc = Object.fromEntries(OIDC_KEYS.map(k => [k, Config.Users.oidc[k]]));
    (OIDCAuthService as any).configurationPromise = null;

    Object.assign(Config.Users.oidc, {
      enabled: true,
      issuerUrl: ISS,
      clientId: 'client',
      clientSecret: 'secret',
      redirectUri: REDIRECT_URI,
      usernameClaim: 'preferred_username',
      emailClaim: 'email',
      autoCreateUser: false,
      allowedDomains: [],
      strictSecurity: false,
      strictLinkMaxRole: UserRoles.User
    });

    provider = new FakeProvider(ISS);
    globalThis.fetch = provider.fetch;

    foundFilters = [];
    users = [
      {id: 1, name: 'admin', role: UserRoles.Admin},
      {id: 2, name: 'alice', role: UserRoles.User},
      {id: 3, name: 'bob', role: UserRoles.User, oidcSubject: ISS + '|bob-sub'},
      {id: 4, name: 'Árvíztűrő Tükörfúrógép', role: UserRoles.User}
    ] as UserDTO[];
    (ObjectManagers as any).instance = {
      UserManager: {
        findOne: async (filter: Partial<UserDTO>) => {
          foundFilters.push(filter);
          return users.find(u => (Object.keys(filter) as (keyof UserDTO)[]).every(k => u[k] === filter[k])) || null;
        },
        setOidcSubject: async (id: number, oidcSubject: string) => {
          const u = users.find(e => e.id === id);
          u!.oidcSubject = oidcSubject;
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

  afterEach(() => {
    globalThis.fetch = origFetch;
    (ObjectManagers as any).instance = origInstance;
    (OIDCAuthService as any).configurationPromise = null;
    Object.assign(Config.Users.oidc, origOidc);
  });

  /**
   * Goes through both steps of the authorization code flow, like a browser would.
   */
  const login = async (claims: Record<string, unknown>, userinfo: Record<string, unknown> | null = null) => {
    provider.idTokenClaims = claims;
    provider.userinfo = userinfo;
    const req: any = {session: {}, query: {}};
    const authUrl = await OIDCAuthService.getAuthenticationRequestUrl(req);
    provider.setAuthorizationUrl(authUrl);
    req.query = {code: 'code', state: req.session.oidc.state};
    const user = await OIDCAuthService.getUserFromAuthenticationResponse(req);
    return {req, user, authUrl: new URL(authUrl)};
  };

  const expectLoginError = async (claims: Record<string, unknown>,
                                  userinfo: Record<string, unknown> | null = null): Promise<any> => {
    let error: any = null;
    try {
      await login(claims, userinfo);
    } catch (err) {
      error = err;
    }
    expect(error).to.not.be.null;
    return error;
  };

  describe('authorization code flow', () => {
    it('should send the authentication request with state and PKCE', async () => {
      Config.Users.oidc.scopes = ['openid', 'profile', 'email'];
      const req: any = {session: {}};

      const url = new URL(await OIDCAuthService.getAuthenticationRequestUrl(req));

      expect(url.origin + url.pathname).to.equal('https://idp.example.com/application/o/pigallery2/auth');
      expect(url.searchParams.get('client_id')).to.equal('client');
      expect(url.searchParams.get('response_type')).to.equal('code');
      expect(url.searchParams.get('redirect_uri')).to.equal(REDIRECT_URI);
      expect(url.searchParams.get('scope')).to.equal('openid profile email');
      expect(url.searchParams.get('state')).to.equal(req.session.oidc.state);
      expect(url.searchParams.get('code_challenge_method')).to.equal('S256');
      expect(url.searchParams.get('code_challenge')).to.equal(
        crypto.createHash('sha256').update(req.session.oidc.verifier).digest('base64url'));
    });

    it('should authenticate at the token endpoint with client_secret_basic and the redirect URI', async () => {
      await login({sub: 'alice-sub', preferred_username: 'alice'});

      const [token] = provider.requestsTo('/token');
      const headers = new Headers(token.init?.headers);
      expect(headers.get('authorization')).to.equal('Basic ' + Buffer.from('client:secret').toString('base64'));
      const body = new URLSearchParams(token.init?.body as string);
      expect(body.get('redirect_uri')).to.equal(REDIRECT_URI);
      expect(body.get('client_secret')).to.be.null;
    });

    it('should reject a response with a different state', async () => {
      const req: any = {session: {}, query: {}};
      await OIDCAuthService.getAuthenticationRequestUrl(req);
      req.query = {code: 'code', state: 'forged'};

      let error: any = null;
      try {
        await OIDCAuthService.getUserFromAuthenticationResponse(req);
      } catch (err) {
        error = err;
      }
      expect(error).to.be.instanceOf(ErrorDTO);
      expect(error.code).to.equal(ErrorCodes.GENERAL_ERROR);
      expect(provider.requestsTo('/token')).to.be.empty;
    });

    it('should reject an ID token of a different issuer', async () => {
      await expectLoginError({iss: 'https://evil.example.com/', sub: 'alice-sub', preferred_username: 'alice'});
      expect(foundFilters).to.be.empty;
    });

    it('should reject an ID token for a different client', async () => {
      await expectLoginError({aud: 'other-client', sub: 'alice-sub', preferred_username: 'alice'});
      expect(foundFilters).to.be.empty;
    });
  });

  describe('discovery', () => {
    it('should accept a provider that writes its issuer with a trailing slash', async () => {
      Config.Users.oidc.issuerUrl = 'https://idp.example.com/application/o/pigallery2';

      const {user} = await login({sub: 'alice-sub', preferred_username: 'alice'});

      expect(user.name).to.equal('alice');
      expect(provider.requestsTo('/.well-known/openid-configuration')[0].url.href)
        .to.equal('https://idp.example.com/application/o/pigallery2/.well-known/openid-configuration');
    });

    it('should accept the discovery document URL as issuer URL', async () => {
      Config.Users.oidc.issuerUrl = ISS + '.well-known/openid-configuration';

      const {user} = await login({sub: 'alice-sub', preferred_username: 'alice'});

      expect(user.name).to.equal('alice');
    });

    it('should discover the provider only once', async () => {
      await login({sub: 'alice-sub', preferred_username: 'alice'});
      await login({sub: 'alice-sub', preferred_username: 'alice'});

      expect(provider.requestsTo('/.well-known/openid-configuration')).to.have.length(1);
    });

    it('should try the discovery again after it failed', async () => {
      provider.failDiscovery = true;
      await expectLoginError({sub: 'alice-sub', preferred_username: 'alice'});

      provider.failDiscovery = false;
      const {user} = await login({sub: 'alice-sub', preferred_username: 'alice'});
      expect(user.name).to.equal('alice');
    });

    it('should allow an http issuer', async () => {
      const iss = 'http://localhost:9000/application/o/pigallery2/';
      Config.Users.oidc.issuerUrl = iss;
      provider = new FakeProvider(iss);
      globalThis.fetch = provider.fetch;

      const {user} = await login({sub: 'alice-sub', preferred_username: 'alice'});

      expect(user.name).to.equal('alice');
    });

    it('should not allow http endpoints of an https issuer', async () => {
      provider.endpointBase = 'http://idp.example.com/application/o/pigallery2';

      await expectLoginError({sub: 'alice-sub', preferred_username: 'alice'});
      expect(provider.requestsTo('/token')).to.be.empty;
    });
  });

  describe('signing algorithms', () => {
    it('should default to RS256 if the provider does not advertise algorithms', async () => {
      provider.algs = undefined;
      const {user} = await login({sub: 'alice-sub', preferred_username: 'alice'});
      expect(user.name).to.equal('alice');

      provider.tokenAlg = 'PS256';
      await expectLoginError({sub: 'alice-sub', preferred_username: 'alice'});
    });

    it('should accept an algorithm the provider advertises instead of RS256', async () => {
      provider.algs = ['PS256'];
      provider.tokenAlg = 'PS256';

      const {user} = await login({sub: 'alice-sub', preferred_username: 'alice'});

      expect(user.name).to.equal('alice');
    });

    it('should reject an algorithm the provider does not advertise', async () => {
      provider.algs = ['PS256'];
      provider.tokenAlg = 'RS256';

      await expectLoginError({sub: 'alice-sub', preferred_username: 'alice'});
      expect(foundFilters).to.be.empty;
    });
  });

  describe('claims', () => {
    it('should log in with ID token claims and not call userinfo', async () => {
      const {req, user} = await login({sub: 'alice-sub', preferred_username: 'alice', email: 'alice@example.com'},
        {sub: 'alice-sub', preferred_username: 'other'});

      expect(foundFilters).to.deep.equal([{name: 'alice'}]);
      expect(user.name).to.equal('alice');
      expect(req.session.oidc).to.be.undefined;
      expect(provider.requestsTo('/userinfo')).to.be.empty;
    });

    it('should fill missing claims from userinfo', async () => {
      const {user} = await login({sub: '123'}, {sub: '123', preferred_username: 'alice', email: 'alice@example.com'});

      expect(user.name).to.equal('alice');
      const [userinfo] = provider.requestsTo('/userinfo');
      expect(new Headers(userinfo.init?.headers).get('authorization')).to.equal('Bearer access-token');
    });

    it('should not override ID token claims with userinfo', async () => {
      Config.Users.oidc.allowedDomains = ['example.com'];

      const {user} = await login({sub: '123', preferred_username: 'alice'},
        {sub: '123', preferred_username: 'mallory', email: 'alice@example.com'});

      expect(user.name).to.equal('alice');
    });

    it('should ignore userinfo of a different subject', async () => {
      const error = await expectLoginError({sub: '123'}, {sub: '456', preferred_username: 'mallory'});

      expect(error.code).to.equal(ErrorCodes.CREDENTIAL_NOT_FOUND);
      expect(foundFilters).to.be.empty;
    });

    it('should fall back to ID token claims if userinfo fails', async () => {
      const {user} = await login({sub: '123', email: 'alice@example.com'});

      expect(provider.requestsTo('/userinfo')).to.have.length(1);
      expect(user.name).to.equal('alice');
    });

    it('should use a custom username claim with non-ASCII names', async () => {
      Config.Users.oidc.usernameClaim = 'name';

      const {user} = await login({sub: '123', name: 'Árvíztűrő Tükörfúrógép', preferred_username: 'alice'});

      expect(user.id).to.equal(4);
    });

    it('should fail if neither ID token nor userinfo has username or email', async () => {
      const error = await expectLoginError({sub: '123'}, {sub: '123'});

      expect(error.code).to.equal(ErrorCodes.CREDENTIAL_NOT_FOUND);
      expect(foundFilters).to.be.empty;
    });

    it('should reject a missing email if allowed domains are set', async () => {
      Config.Users.oidc.allowedDomains = ['example.com'];

      const error = await expectLoginError({sub: '123', preferred_username: 'alice'});

      expect(error.code).to.equal(ErrorCodes.CREDENTIAL_NOT_FOUND);
      expect(foundFilters).to.be.empty;
    });

    it('should reject an unknown user', async () => {
      const error = await expectLoginError({sub: '123', preferred_username: 'nobody'});

      expect(error.code).to.equal(ErrorCodes.CREDENTIAL_NOT_FOUND);
    });
  });

  describe('strict security', () => {
    beforeEach(() => {
      Config.Users.oidc.strictSecurity = true;
    });

    const expectStrictLoginError = async (claims: Record<string, unknown>): Promise<void> => {
      const error = await expectLoginError(claims);
      expect(error.code).to.equal(ErrorCodes.CREDENTIAL_NOT_FOUND);
    };

    it('should link an unlinked user on first login and use the link later', async () => {
      const {user} = await login({sub: 'alice-sub', preferred_username: 'alice'});
      expect(user.id).to.equal(2);
      expect(users[1].oidcSubject).to.equal(ISS + '|alice-sub');

      // renamed at the provider, still the same account
      const {user: user2} = await login({sub: 'alice-sub', preferred_username: 'alice2'});
      expect(user2.id).to.equal(2);
    });

    it('should reject a different account with the name of a linked user', async () => {
      await expectStrictLoginError({sub: 'mallory', preferred_username: 'bob'});
      expect(users[2].oidcSubject).to.equal(ISS + '|bob-sub');
    });

    it('should not link a user above the max link role', async () => {
      await expectStrictLoginError({sub: 'mallory', preferred_username: 'admin'});
      expect(users[0].oidcSubject).to.be.undefined;
    });

    it('should link an admin if the max link role allows it', async () => {
      Config.Users.oidc.strictLinkMaxRole = UserRoles.Admin;
      const {user} = await login({sub: 'admin-sub', preferred_username: 'admin'});
      expect(user.id).to.equal(1);
      expect(users[0].oidcSubject).to.equal(ISS + '|admin-sub');
    });

    it('should reject a token without subject', async () => {
      await expectLoginError({preferred_username: 'alice'});
      expect(users[1].oidcSubject).to.be.undefined;
    });

    it('should reject a subject that is not a string', async () => {
      for (const sub of [true, {}, ['alice-sub'], 42]) {
        await expectLoginError({sub, preferred_username: 'alice'});
        expect(users[1].oidcSubject).to.be.undefined;
      }
    });

    it('should use the full email as fallback name only if verified', async () => {
      users.push({id: 5, name: 'carol', role: UserRoles.User} as UserDTO);
      users.push({id: 6, name: 'carol@example.com', role: UserRoles.User} as UserDTO);

      await expectStrictLoginError({sub: 'c', email: 'carol@example.com'});

      const {user} = await login({sub: 'c', email: 'carol@example.com', email_verified: true});
      expect(user.id).to.equal(6);
    });

    it('should link auto-created users', async () => {
      Config.Users.oidc.autoCreateUser = true;
      const {user} = await login({sub: 'dave-sub', preferred_username: 'dave'});
      expect(user.name).to.equal('dave');
      expect(user.oidcSubject).to.equal(ISS + '|dave-sub');
    });
  });
});
