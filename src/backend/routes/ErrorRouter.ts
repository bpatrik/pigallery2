import {RenderingMWs} from '../middlewares/RenderingMWs';
import {ErrorCodes, ErrorDTO} from '../../common/entities/Error';
import {Logger} from '../Logger';
import {Express, NextFunction, Request, Response} from 'express';
import {Config} from '../../common/config/private/Config';

export class ErrorRouter {
  public static route(app: Express): void {
    this.addApiNotFound(app);
    this.addApiErrorHandler(app);
    this.addGenericHandler(app);
  }

  // every API route is added before this, so the path is unknown
  private static addApiNotFound(app: Express): void {
    app.use(Config.Server.apiPath + '/{*rest}', RenderingMWs.notFound);
  }

  private static addApiErrorHandler(app: Express): void {
    app.use(Config.Server.apiPath + '/{*rest}', RenderingMWs.renderError);
  }

  private static addGenericHandler(app: Express): void {
    app.use(
        (err: unknown, req: Request, res: Response, next: NextFunction): void => {
          if (err instanceof Error && err.name === 'UnauthorizedError') {
            // jwt authentication error
            return next(
                new ErrorDTO(ErrorCodes.NOT_AUTHENTICATED, 'Invalid token')
            );
          }
          if (RenderingMWs.isClientHttpError(err)) {
            // not a server fault: renderError answers with its status
            return next(err);
          }

          console.log(err);

          // Flush out the stack to the console
          Logger.error('Unexpected error:');
          console.error(err);
          return next(
              new ErrorDTO(
                  ErrorCodes.INTERNAL,
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
