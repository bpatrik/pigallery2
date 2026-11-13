import {Config} from '../../../common/config/private/Config';
import {Request} from 'express';
import {randomBytes} from 'node:crypto';
import * as oidc from 'openid-client';
import {UserDTO} from '../../../common/entities/UserDTO';
import {ErrorCodes, ErrorDTO} from '../../../common/entities/Error';
import {ObjectManagers} from '../../model/ObjectManagers';
import {Logger} from '../../Logger';

const LOG_TAG = '[OIDCAuthService]';

// claims are JSON values; the ones used here are strings (numbers are accepted too)
const claimStr = (v: unknown): string =>
  typeof v === 'string' ? v : (typeof v === 'number' ? String(v) : '');

export class OIDCAuthService {
  private static configurationPromise: Promise<oidc.Configuration> | null = null;

  /**
   * Step 1 of the OIDC authorization code flow: the URL of the authentication request at the provider.
   * The provider sends the authentication response back to Users.oidc.redirectUri.
   */
  public static async getAuthenticationRequestUrl(req: Request): Promise<string> {
    const configuration = await this.getConfiguration();
    const state = oidc.randomState();
    const verifier = oidc.randomPKCECodeVerifier();
    const challenge = await oidc.calculatePKCECodeChallenge(verifier);
    req.session.oidc = {
      state,
      verifier
    };
    return oidc.buildAuthorizationUrl(configuration, {
      redirect_uri: Config.Users.oidc.redirectUri,
      scope: Config.Users.oidc.scopes.join(' '),
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256'
    }).href;
  }

  /**
   * Step 2 of the OIDC authorization code flow: validates the authentication response,
   * exchanges its code for the tokens and returns with the user of their claims.
   */
  public static async getUserFromAuthenticationResponse(req: Request): Promise<UserDTO> {
    const storedOidc = req.session.oidc;
    const params = req.query; // code, state
    if (!storedOidc?.state || params['state'] !== storedOidc?.state) {
      throw new ErrorDTO(ErrorCodes.GENERAL_ERROR, 'Invalid OIDC state');
    }
    const configuration = await this.getConfiguration();
    // The provider knows the redirect URI, not the URL of this request (e.g.: behind a reverse proxy).
    const callbackUrl = new URL(Config.Users.oidc.redirectUri);
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'string') {
        callbackUrl.searchParams.set(key, value);
      }
    }
    const tokens = await oidc.authorizationCodeGrant(configuration, callbackUrl, {
      expectedState: storedOidc.state,
      pkceCodeVerifier: storedOidc.verifier
    });
    const strict = Config.Users.oidc.strictSecurity;
    const usernameClaim = Config.Users.oidc.usernameClaim || 'preferred_username';
    const emailClaim = Config.Users.oidc.emailClaim || 'email';
    const claims = await this.getClaims(configuration, tokens, [usernameClaim, emailClaim]);
    const preferredUserName = claimStr(claims[usernameClaim]);
    const email = claimStr(claims[emailClaim]);

    let emailName = '';
    if (email) {
      if (!strict) {
        emailName = email.split('@')[0];
      } else if (claims['email_verified'] === true) {
        emailName = email;
      }
    }
    const matchedName = preferredUserName || emailName;
    if (!matchedName) {
      throw new ErrorDTO(ErrorCodes.CREDENTIAL_NOT_FOUND, 'OIDC: missing username/email');
    }

    // domain allow-list if configured
    if (Config.Users.oidc.allowedDomains && Config.Users.oidc.allowedDomains.length > 0) {
      const domain = email.split('@')[1] || '';
      const allowed = Config.Users.oidc.allowedDomains.some(d => d.toLowerCase() === domain.toLowerCase());
      if (!allowed) {
        throw new ErrorDTO(ErrorCodes.CREDENTIAL_NOT_FOUND, `Email domain not allowed: ${domain}`);
      }
    }

    const user = strict ?
      await this.findStrictUser(claims, matchedName) :
      await this.findUser(matchedName);

    // cleanup
    delete req.session.oidc;
    return user;
  }

  private static async findUser(name: string): Promise<UserDTO> {
    let user: UserDTO | null = await ObjectManagers.getInstance().UserManager.findOne({name});
    if (!user && Config.Users.oidc.autoCreateUser) {
      user = await this.createUser(name);
    }
    if (!user) {
      throw new ErrorDTO(ErrorCodes.CREDENTIAL_NOT_FOUND, 'User not found');
    }
    return user;
  }

  /**
   * Strict security: the app user is bound to the provider account (issuer + subject).
   * Name matching is only used to link a not yet linked user with a limited role.
   */
  private static async findStrictUser(claims: Record<string, unknown>, name: string): Promise<UserDTO> {
    const iss = claims['iss'];
    const sub = claims['sub'];
    // the spec requires both to be strings; anything else must not map to a shared subject
    if (typeof iss !== 'string' || typeof sub !== 'string' || !iss || !sub) {
      throw new ErrorDTO(ErrorCodes.CREDENTIAL_NOT_FOUND, 'OIDC: missing sub/iss claim');
    }
    const subject = iss + '|' + sub;
    const userManager = ObjectManagers.getInstance().UserManager;

    let user: UserDTO | null = await userManager.findOne({oidcSubject: subject});
    if (user) {
      return user;
    }
    user = await userManager.findOne({name});
    if (!user) {
      if (!Config.Users.oidc.autoCreateUser) {
        throw new ErrorDTO(ErrorCodes.CREDENTIAL_NOT_FOUND, 'User not found');
      }
      return this.createUser(name, subject);
    }
    if (user.oidcSubject) {
      Logger.warn(LOG_TAG, `User "${name}" is linked to a different OIDC account, refusing login`);
      throw new ErrorDTO(ErrorCodes.CREDENTIAL_NOT_FOUND, 'User is linked to a different OIDC account');
    }
    if (user.role > Config.Users.oidc.strictLinkMaxRole) {
      Logger.warn(LOG_TAG, `User "${name}" has a higher role than "Max role for linking", refusing to link`);
      throw new ErrorDTO(ErrorCodes.CREDENTIAL_NOT_FOUND, 'User role is too high for OIDC linking');
    }
    Logger.info(LOG_TAG, `Linking user "${name}" to OIDC account`);
    return userManager.setOidcSubject(user.id, subject);
  }

  private static createUser(name: string, oidcSubject?: string): Promise<UserDTO> {
    // nobody knows this password, but it still has to be unguessable: it works on the login page too
    const rnd = randomBytes(32).toString('base64url');
    const newUser: UserDTO = {name, password: rnd, role: Config.Users.oidc.autoCreateUserRole, oidcSubject} as UserDTO;
    return ObjectManagers.getInstance().UserManager.createUser(newUser);
  }

  /**
   * Returns the ID token claims. Some providers only return
   * some claims (e.g.: preferred_username, email) from the userinfo endpoint,
   * so if any of the required ones is missing, they are filled from there.
   * ID token claims always take precedence.
   */
  private static async getClaims(configuration: oidc.Configuration,
                                 tokens: oidc.TokenEndpointResponse & oidc.TokenEndpointResponseHelpers,
                                 requiredClaims: string[]): Promise<Record<string, unknown>> {
    const idToken = tokens.claims();
    if (!idToken) {
      throw new ErrorDTO(ErrorCodes.CREDENTIAL_NOT_FOUND, 'OIDC: missing ID token');
    }
    const claims: Record<string, unknown> = {...idToken};
    if (requiredClaims.every(c => !!claims[c])) {
      return claims;
    }
    try {
      // fails if userinfo belongs to a different subject than the ID token (the spec requires them to match)
      const userinfo = await oidc.fetchUserInfo(configuration, tokens.access_token, idToken.sub);
      for (const key of Object.keys(userinfo)) {
        if (!claims[key]) {
          claims[key] = userinfo[key];
        }
      }
    } catch (err) {
      Logger.warn(LOG_TAG, 'Failed to fetch OIDC userinfo, using the ID token claims only: ' +
        (err instanceof Error ? err.message : String(err)));
    }
    return claims;
  }

  /**
   * The provider's discovery document URL. Like with openid-client 5, the issuer URL setting
   * may also be the discovery document URL itself.
   * The discovery document doesn't have to repeat the issuer URL setting character by character
   * (e.g.: a missing trailing slash). The ID tokens are still checked against the issuer it names.
   */
  private static getDiscoveryUrl(issuerUrl: string): URL {
    const url = new URL(issuerUrl);
    if (!url.pathname.includes('/.well-known/')) {
      url.pathname = url.pathname.replace(/\/?$/, '/.well-known/openid-configuration');
    }
    return url;
  }

  private static discover(issuerUrl: string): Promise<oidc.Configuration> {
    const discoveryUrl = this.getDiscoveryUrl(issuerUrl);
    const execute: ((configuration: oidc.Configuration) => void)[] = [];
    if (discoveryUrl.protocol === 'http:') {
      // for local test setups: the provider can't be authenticated over http, and the tokens can be read on the way
      Logger.warn(LOG_TAG, 'OIDC issuer URL is not https, allowing insecure requests to the provider');
      execute.push(oidc.allowInsecureRequests);
    }
    const secret = Config.Users.oidc.clientSecret;
    return oidc.discovery(
      discoveryUrl,
      Config.Users.oidc.clientId,
      undefined,
      secret ? oidc.ClientSecretBasic(secret) : oidc.None(),
      {execute}
    );
  }

  private static getConfiguration(): Promise<oidc.Configuration> {
    if (!this.configurationPromise) {
      if (!Config.Users.oidc.enabled) {
        throw new Error('OIDC is not enabled');
      }
      const issuerUrl = Config.Users.oidc.issuerUrl;
      if (!issuerUrl) {
        throw new Error('OIDC issuerUrl is not configured');
      }
      // a failed discovery (e.g.: the provider is down) is not kept, the next login tries again
      this.configurationPromise = this.discover(issuerUrl).catch((err: unknown) => {
        this.configurationPromise = null;
        throw err;
      });
    }
    return this.configurationPromise;
  }
}
