import {RenderingMWs} from '../middlewares/RenderingMWs';
import {ErrorCodes, ErrorDTO} from '../../common/entities/Error';
import {Logger} from '../Logger';
import {Express, NextFunction, Request, Response} from 'express';
import {Config} from '../../common/config/private/Config';

export class ErrorRouter {
  public static route(app: Express): void {
    this.addApiErrorHandler(app);
    this.addGenericHandler(app);
  }

  private static addApiErrorHandler(app: Express): void {
    app.use(Config.Server.apiPath + '/*', RenderingMWs.renderError);
  }

  private static addGenericHandler(app: Express): void {
    app.use(
        (err: any, req: Request, res: Response, next: NextFunction): any => {
          if (err.name === 'UnauthorizedError') {
            // jwt authentication error
            res.status(401);
            return next(
                new ErrorDTO(ErrorCodes.NOT_AUTHENTICATED, 'Invalid token')
            );
          }
          if (err.name === 'ForbiddenError' && err.code === 'EBADCSRFTOKEN') {
            // jwt authentication error
            res.status(401);
            return next(
                new ErrorDTO(
                    ErrorCodes.NOT_AUTHENTICATED,
                    'Invalid CSRF token',
                    err,
                    req
                )
            );
          }

          console.log(err);

          // Flush out the stack to the console
          Logger.error('Unexpected error:');
          console.error(err);
          return next(
              new ErrorDTO(
                  ErrorCodes.SERVER_ERROR,
                  'Unknown server side error',
                  err,
                  req
              )
          );
        },
        RenderingMWs.renderError
    );
  }
}
