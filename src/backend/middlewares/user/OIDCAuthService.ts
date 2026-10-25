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
    const strict = Config.Users.oidc.strictSecurity;
    const usernameClaim = Config.Users.oidc.usernameClaim || 'preferred_username';
    const emailClaim = Config.Users.oidc.emailClaim || 'email';
    const claims = await this.getClaims(client, tokenSet, [usernameClaim, emailClaim]);
    const preferredUserName = claims[usernameClaim] || '';
    const email = claims[emailClaim] || '';

    let emailName = '';
    if (email) {
      if (!strict) {
        emailName = String(email).split('@')[0];
      } else if (claims.email_verified === true) {
        emailName = String(email);
      }
    }
    const matchedName = (preferredUserName || emailName).toString();
    if (!matchedName) {
      throw new ErrorDTO(ErrorCodes.CREDENTIAL_NOT_FOUND, 'OIDC: missing username/email');
    }

    // domain allow-list if configured
    if (Config.Users.oidc.allowedDomains && Config.Users.oidc.allowedDomains.length > 0) {
      const domain = String(email).split('@')[1] || '';
      const allowed = Config.Users.oidc.allowedDomains.some(d => d.toLowerCase() === domain.toLowerCase());
      if (!allowed) {
        throw new ErrorDTO(ErrorCodes.CREDENTIAL_NOT_FOUND, `Email domain not allowed: ${domain}`);
      }
    }

    const user = strict ?
      await this.findStrictUser(claims, matchedName) :
      await this.findUser(matchedName);

    req.session.context = await ObjectManagers.getInstance().SessionManager.buildContext(user);
    req.session.rememberMe = true;
    // cleanup
    delete (req.session as any).oidc;
    res.redirect(Config.Server.getAppUrl());
  }

  private static async findUser(name: string): Promise<UserDTO> {
    let user: UserDTO = await ObjectManagers.getInstance().UserManager.findOne({name});
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
    if (!claims.sub || !claims.iss) {
      throw new ErrorDTO(ErrorCodes.CREDENTIAL_NOT_FOUND, 'OIDC: missing sub/iss claim');
    }
    const subject = claims.iss + '|' + claims.sub;
    const userManager = ObjectManagers.getInstance().UserManager;

    let user: UserDTO = await userManager.findOne({oidcSubject: subject});
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
    const rnd = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    const newUser: UserDTO = {name, password: rnd, role: Config.Users.oidc.autoCreateUserRole, oidcSubject} as UserDTO;
    return ObjectManagers.getInstance().UserManager.createUser(newUser);
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
      // the spec requires userinfo to belong to the same subject as the ID token
      if (claims.sub && userinfo.sub !== claims.sub) {
        Logger.warn(LOG_TAG, 'OIDC userinfo subject does not match the ID token, ignoring userinfo');
        return claims;
      }
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
