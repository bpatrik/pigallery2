import {Config} from '../../../common/config/private/Config';
import {Request, Response} from 'express';
import * as client from 'openid-client';
import {UserDTO, UserRoles} from '../../../common/entities/UserDTO';
import {ErrorCodes, ErrorDTO} from '../../../common/entities/Error';
import {ObjectManagers} from '../../model/ObjectManagers';

export class OIDCAuthService {
  private static configPromise: Promise<client.Configuration> | null = null;

  public static reset(): void {
    this.configPromise = null;
  }

  public static async login(req: Request, res: Response): Promise<void> {
    const config = await this.getConfig();
    const state = client.randomState();
    const verifier = client.randomPKCECodeVerifier();
    const challenge = await client.calculatePKCECodeChallenge(verifier);
    req.session.oidc = {
      state,
      verifier
    } as any;
    const authUrl = client.buildAuthorizationUrl(config, {
      redirect_uri: Config.Users.oidc.redirectUri,
      scope: Config.Users.oidc.scopes.join(' '),
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256'
    });
    res.redirect(authUrl.href);
  }

  public static async callback(req: Request, res: Response): Promise<void> {
    const storedOidc = req.session.oidc;
    const params = req.query; // code, state
    if (!storedOidc?.state || params.state !== storedOidc?.state) {
      throw new ErrorDTO(ErrorCodes.GENERAL_ERROR, 'Invalid OIDC state');
    }
    const config = await this.getConfig();

    const currentUrl = new URL(Config.Users.oidc.redirectUri);
    for (const [key, value] of Object.entries(req.query)) {
      if (typeof value === 'string') {
        currentUrl.searchParams.set(key, value);
      } else if (Array.isArray(value)) {
        for (const v of value) {
          if (typeof v === 'string') {
            currentUrl.searchParams.append(key, v);
          }
        }
      }
    }

    const tokens = await client.authorizationCodeGrant(
      config,
      currentUrl,
      {
        pkceCodeVerifier: storedOidc?.verifier,
        expectedState: storedOidc?.state
      }
    );
    const claims = (tokens.claims?.() || {}) as Record<string, any>;
    const usernameClaim = Config.Users.oidc.usernameClaim || 'preferred_username';
    const emailClaim = Config.Users.oidc.emailClaim || 'email';
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
      const newUser: UserDTO = {name: matchedName, password: rnd, role: UserRoles.Guest} as any;
      user = await ObjectManagers.getInstance().UserManager.createUser(newUser);
    }
    if (!user) {
      throw new ErrorDTO(ErrorCodes.CREDENTIAL_NOT_FOUND, 'User not found');
    }

    req.session.context = await ObjectManagers.getInstance().SessionManager.buildContext(user);
    req.session.rememberMe = true;
    // cleanup
    delete (req.session as any).oidc;
    // redirect to root or previously stored path
    const redirectUrl = Config.Server.urlBase
      ? ('/' + Config.Server.urlBase.replace(/^\/+|\/+$/g, '') + '/')
      : '/';
    res.redirect(redirectUrl);
  }

  private static async getConfig(): Promise<client.Configuration> {
    if (this.configPromise) {
      return this.configPromise;
    }
    if (!Config.Users.oidc.enabled) {
      throw new Error('OIDC is not enabled');
    }
    const issuerUrl = Config.Users.oidc.issuerUrl;
    if (!issuerUrl) {
      throw new Error('OIDC issuerUrl is not configured');
    }
    this.configPromise = (async () => {
      const serverUrl = new URL(issuerUrl);
      const execute = serverUrl.protocol === 'http:' ? [client.allowInsecureRequests] : undefined;
      const clientSecret = Config.Users.oidc.clientSecret;
      const clientAuth = clientSecret
        ? client.ClientSecretPost(clientSecret)
        : client.None();

      return await client.discovery(
        serverUrl,
        Config.Users.oidc.clientId,
        clientSecret ? {client_secret: clientSecret} : undefined,
        clientAuth,
        execute ? {execute} : undefined
      );
    })();
    return this.configPromise;
  }
}
