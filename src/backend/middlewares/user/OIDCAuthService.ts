import {Config} from '../../../common/config/private/Config';
import {Request, Response} from 'express';
import {Client, generators, Issuer, TokenSet} from 'openid-client';
import {UserDTO} from '../../../common/entities/UserDTO';
import {ErrorCodes, ErrorDTO} from '../../../common/entities/Error';
import {ObjectManagers} from '../../model/ObjectManagers';
import {Logger} from '../../Logger';

const LOG_TAG = '[OIDCAuthService]';

export class OIDCAuthService {
  private static clientPromise: Promise<Client> | null = null;

  public static async login(req: Request, res: Response): Promise<void> {
    const client = await this.getClient();
    const state = generators.state();
    const verifier = generators.codeVerifier();
    const challenge = generators.codeChallenge(verifier);
    req.session.oidc = {
      state,
      verifier
    } as any;
    const authUrl = client.authorizationUrl({
      scope: Config.Users.oidc.scopes.join(' '),
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256'
    });
    res.redirect(authUrl);
  }

  public static async callback(req: Request, res: Response): Promise<void> {
    const storedOidc = req.session.oidc;
    const params = req.query; // code, state
    if (!storedOidc?.state || params.state !== storedOidc?.state) {
      throw new ErrorDTO(ErrorCodes.GENERAL_ERROR, 'Invalid OIDC state');
    }
    const client = await this.getClient();
    const tokenSet: TokenSet = await client.callback(
      Config.Users.oidc.redirectUri,
      params,
      {
        state: storedOidc?.state,
        code_verifier: storedOidc?.verifier
      }
    );
    const usernameClaim = Config.Users.oidc.usernameClaim || 'preferred_username';
    const emailClaim = Config.Users.oidc.emailClaim || 'email';
    const claims = await this.getClaims(client, tokenSet, [usernameClaim, emailClaim]);
    const preferredUserName = claims[usernameClaim] || '';
    const email = claims[emailClaim] || '';

    const matchedName = (preferredUserName || (email ? String(email).split('@')[0] : '')).toString();
    if (!matchedName) {
      throw new ErrorDTO(ErrorCodes.CREDENTIAL_NOT_FOUND, 'OIDC: missing username/email');
    }

    // domain allow-list if configured
    if (Config.Users.oidc.allowedDomains && Config.Users.oidc.allowedDomains.length > 0 && email) {
      const domain = String(email).split('@')[1] || '';
      const allowed = Config.Users.oidc.allowedDomains.some(d => d.toLowerCase() === domain.toLowerCase());
      if (!allowed) {
        throw new ErrorDTO(ErrorCodes.CREDENTIAL_NOT_FOUND, `Email domain not allowed: ${domain}`);
      }
    }

    // try find user by name
    let user = await ObjectManagers.getInstance().UserManager.findOne({name: matchedName});
    if (!user && Config.Users.oidc.autoCreateUser) {
      const rnd = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
      const newUser: UserDTO = {name: matchedName, password: rnd, role: Config.Users.oidc.autoCreateUserRole} as any;
      user = await ObjectManagers.getInstance().UserManager.createUser(newUser);
    }
    if (!user) {
      throw new ErrorDTO(ErrorCodes.CREDENTIAL_NOT_FOUND, 'User not found');
    }

    req.session.context = await ObjectManagers.getInstance().SessionManager.buildContext(user);
    req.session.rememberMe = true;
    // cleanup
    delete (req.session as any).oidc;
    res.redirect(this.getAppRootUrl());
  }

  /**
   * Root of the app, respecting Server.urlBase (e.g.: '/' or '/myGallery/').
   */
  public static getAppRootUrl(): string {
    const base = (Config.Server.urlBase || '').replace(/^\/+|\/+$/g, '');
    return base ? `/${base}/` : '/';
  }

  /**
   * Prefers RS256 (openid-client default) if the provider supports it,
   * otherwise the first algorithm the provider advertises (e.g.: PS256, ES256).
   */
  public static selectIdTokenAlg(supported?: string[]): string {
    if (!supported || supported.length === 0 || supported.includes('RS256')) {
      return 'RS256';
    }
    return supported[0];
  }

  /**
   * Returns the ID token claims. Some providers only return
   * some claims (e.g.: preferred_username, email) from the userinfo endpoint,
   * so if any of the required ones is missing, they are filled from there.
   * ID token claims always take precedence.
   */
  public static async getClaims(client: Client, tokenSet: TokenSet, requiredClaims: string[]): Promise<Record<string, unknown>> {
    const claims: Record<string, unknown> = {...tokenSet.claims()};
    if (requiredClaims.every(c => !!claims[c]) || !tokenSet.access_token) {
      return claims;
    }
    try {
      const userinfo = await client.userinfo(tokenSet.access_token);
      for (const key of Object.keys(userinfo)) {
        if (!claims[key]) {
          claims[key] = userinfo[key];
        }
      }
    } catch (err) {
      Logger.warn(LOG_TAG, 'Failed to fetch OIDC userinfo: ' + (err?.message || err));
    }
    return claims;
  }

  private static async getClient(): Promise<Client> {
    if (this.clientPromise) {
      return this.clientPromise;
    }
    if (!Config.Users.oidc.enabled) {
      throw new Error('OIDC is not enabled');
    }
    const issuerUrl = Config.Users.oidc.issuerUrl;
    if (!issuerUrl) {
      throw new Error('OIDC issuerUrl is not configured');
    }
    this.clientPromise = (async () => {
      const issuer = await Issuer.discover(issuerUrl);
      return new issuer.Client({
        client_id: Config.Users.oidc.clientId,
        client_secret: Config.Users.oidc.clientSecret,
        redirect_uris: [Config.Users.oidc.redirectUri],
        response_types: ['code'],
        id_token_signed_response_alg: this.selectIdTokenAlg(issuer.metadata.id_token_signing_alg_values_supported as string[])
      });
    })();
    return this.clientPromise;
  }
}
