import {Express} from 'express';
import {Config} from '../../common/config/private/Config';
import {AuthenticationMWs} from '../middlewares/user/AuthenticationMWs';
import {OIDCMWs} from '../middlewares/user/OIDCMWs';

export class OIDCRouter {
  private static BASE = Config.Server.apiPath + '/auth/oidc';

  public static route(app: Express): void {
    this.addLogin(app);
    this.addCallback(app);
  }

  private static addLogin(app: Express): void {
    app.get(
      OIDCRouter.BASE + '/login',
      OIDCMWs.isEnabled,
      OIDCMWs.redirectToProvider
    );
  }

  private static addCallback(app: Express): void {
    app.get(
      OIDCRouter.BASE + '/callback',
      OIDCMWs.isEnabled,
      AuthenticationMWs.oidcLogin,
      OIDCMWs.redirectToApp
    );
  }
}
