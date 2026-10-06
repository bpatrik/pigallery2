import {Express, NextFunction, Request, Response} from 'express';
import {Config} from '../../common/config/private/Config';
import {OIDCAuthService} from '../middlewares/user/OIDCAuthService';

export class OIDCRouter {
  private static get BASE(): string {
    return Config.Server.apiPath + '/auth/oidc';
  }

  public static route(app: Express): void {
    this.addLogin(app);
    this.addCallback(app);
  }

  private static addLogin(app: Express): void {
    app.get(OIDCRouter.BASE + '/login', async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!Config.Users.oidc.enabled) {
          return res.status(404).end();
        }
        await OIDCAuthService.login(req, res);
        return next();
      } catch (err) {
        return next(err);
      }
    });
  }

  private static addCallback(app: Express): void {
    app.get(OIDCRouter.BASE + '/callback', async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!Config.Users.oidc.enabled) {
          return res.status(404).end();
        }
        await OIDCAuthService.callback(req, res);
        return next();
      } catch (err) {
        return next(err);
      }
    });

  }
}
