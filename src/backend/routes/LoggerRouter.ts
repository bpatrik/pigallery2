import {Express, NextFunction, Request, Response} from 'express';
import {LoggerFunction, Logger} from '../Logger';
import {Config} from '../../common/config/private/Config';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      _startTime?: number;
      logged?: boolean;
    }
  }
}

/**
 * Adds logging to express
 */
export class LoggerRouter {
  public static log(loggerFn: LoggerFunction, req: Request, res: Response): void {
    if (req.logged === true) {
      return;
    }
    req.logged = true;
    const end = res.end;
    res.end = ((...args: Parameters<typeof end>) => {
      res.end = end;
      res.end(...args);
      loggerFn(
          req.method,
          req.url,
          res.statusCode,
          Date.now() - (req._startTime ?? NaN) + 'ms'
      );
      return res;
    }) as typeof end;
  }

  public static route(app: Express): void {
    /* Save start time for all requests */
    app.use((req: Request, res: Response, next: NextFunction): void => {
      req._startTime = Date.now();
      return next();
    });

    app.get(Config.Server.apiPath + '{*rest}', (req: Request, res: Response, next: NextFunction): void => {
      LoggerRouter.log(Logger.verbose, req, res);
      return next();
    });

    app.get(
        '/node_modules{*rest}',
        (req: Request, res: Response, next: NextFunction): void => {
          LoggerRouter.log(Logger.silly, req, res);
          return next();
        }
    );

    app.use((req: Request, res: Response, next: NextFunction): void => {
      LoggerRouter.log(Logger.debug, req, res);
      return next();
    });
  }
}
