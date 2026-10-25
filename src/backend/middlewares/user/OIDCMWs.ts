import {NextFunction, Request, Response} from 'express';
import {Config} from '../../../common/config/private/Config';
import {OIDCAuthService} from './OIDCAuthService';

export class OIDCMWs {

  public static isEnabled(req: Request, res: Response, next: NextFunction): void {
    if (!Config.Users.oidc.enabled) {
      res.status(404).end();
      return;
    }
    return next();
  }

  /**
   * Sends the authentication request to the OIDC provider.
   * Its response arrives at the redirectUri (see AuthenticationMWs.oidcLogin).
   */
  public static async redirectToProvider(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.redirect(await OIDCAuthService.getAuthenticationRequestUrl(req));
    } catch (err) {
      return next(err);
    }
  }

  public static redirectToApp(req: Request, res: Response): void {
    res.redirect(Config.Server.getAppUrl());
  }
}
