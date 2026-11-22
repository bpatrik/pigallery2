import {NextFunction, Request, Response} from 'express';
import {AuthorizationResponseError} from 'openid-client';
import {Config} from '../../../common/config/private/Config';
import {ErrorCodes, ErrorDTO} from '../../../common/entities/Error';
import {Logger} from '../../Logger';
import {NotificationManager} from '../../model/NotifocationManager';
import {OIDCAuthService} from './OIDCAuthService';

const LOG_TAG = '[OIDCMWs]';

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

  /**
   * The callback is opened by the browser, not by the app: show the error on the login page, not as JSON (#1422).
   * The reason stays in the server log; the login page only tells whether the access was denied.
   */
  public static redirectToLoginOnError(err: unknown, req: Request, res: Response, _next: NextFunction): void {
    const denied = (err instanceof AuthorizationResponseError && err.error === 'access_denied') ||
      (err instanceof ErrorDTO && err.code === ErrorCodes.CREDENTIAL_NOT_FOUND);
    if (err instanceof AuthorizationResponseError || err instanceof ErrorDTO) {
      Logger.warn(LOG_TAG, 'OIDC login failed:', err.message,
        err instanceof AuthorizationResponseError ? err.error + ' ' + (err.error_description ?? '') : '');
    } else {
      Logger.error(LOG_TAG, 'OIDC login failed', err);
      NotificationManager.error('OIDC login failed', err, req);
    }
    res.redirect(Config.Server.getAppUrl('/login') + '?oidcError=' + (denied ? 'denied' : 'failed'));
  }
}
