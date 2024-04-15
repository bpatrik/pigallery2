import {NextFunction, Request, Response} from 'express';
import {ErrorCodes, ErrorDTO} from '../../common/entities/Error';
import {Message} from '../../common/entities/Message';
import {PrivateConfigClass} from '../../common/config/private/PrivateConfigClass';
import {UserDTO, UserRoles} from '../../common/entities/UserDTO';
import {NotificationManager} from '../model/NotifocationManager';
import {Logger} from '../Logger';
import {SharingDTO} from '../../common/entities/SharingDTO';
import {Utils} from '../../common/Utils';
import {LoggerRouter} from '../routes/LoggerRouter';
import {TAGS} from '../../common/config/public/ClientConfig';
import {ExtensionConfigWrapper} from '../model/extension/ExtensionConfigWrapper';

const forcedDebug = process.env['NODE_ENV'] === 'debug';

export class RenderingMWs {
  public static renderResult(
    req: Request,
    res: Response,
    next: NextFunction
  ): void {
    if (typeof req.resultPipe === 'undefined') {
      return next();
    }

    return RenderingMWs.renderMessage(res, req.resultPipe);
  }

  public static renderSessionUser(
    req: Request,
    res: Response,
    next: NextFunction
  ): void {
    if (!req.session['user']) {
      return next(new ErrorDTO(ErrorCodes.GENERAL_ERROR, 'User not exists'));
    }

    const user = {
      id: req.session['user'].id,
      name: req.session['user'].name,
      csrfToken: req.session['user'].csrfToken || req.csrfToken(),
      role: req.session['user'].role,
      usedSharingKey: req.session['user'].usedSharingKey,
      permissions: req.session['user'].permissions,
    } as UserDTO;

    if (!user.csrfToken && req.csrfToken) {
      user.csrfToken = req.csrfToken();
    }

    RenderingMWs.renderMessage(res, user);
  }

  public static renderSharing(
    req: Request,
    res: Response,
    next: NextFunction
  ): void {
    if (!req.resultPipe) {
      return next();
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const {password, creator, ...sharing} = req.resultPipe as SharingDTO;
    RenderingMWs.renderMessage(res, sharing);
  }

  public static renderSharingList(
    req: Request,
    res: Response,
    next: NextFunction
  ): void {
    if (!req.resultPipe) {
      return next();
    }

    const shares = Utils.clone(req.resultPipe as SharingDTO[]);
    shares.forEach((s): void => {
      delete s.password;
      delete s.creator.password;
    });
    return RenderingMWs.renderMessage(res, shares);
  }

  public static renderFile(
    req: Request,
    res: Response,
    next: NextFunction
  ): void {
    if (!req.resultPipe) {
      return next();
    }
    return res.sendFile(req.resultPipe as string, {
      maxAge: 31536000,
      dotfiles: 'allow',
    });
  }

  public static renderOK(
    req: Request,
    res: Response
  ): void {
    const message = new Message<string>(null, 'ok');
    res.json(message);
  }

  public static async renderConfig(
    req: Request,
    res: Response
  ): Promise<void> {
    const originalConf = await ExtensionConfigWrapper.original();
    // These are sensitive information, do not send to the client side
    originalConf.Server.sessionSecret = null;
    const originalConfJSON = JSON.parse(JSON.stringify(originalConf.toJSON({
      attachState: true,
      attachVolatile: true,
      skipTags: {secret: true} as TAGS
    }) as PrivateConfigClass));

    const message = new Message<PrivateConfigClass>(
      null,
      originalConfJSON
    );
    res.json(message);
  }

  public static renderError(
    err: Error,
    req: Request,
    res: Response,
    next: NextFunction
  ): void {
    if (err instanceof ErrorDTO) {
      if (err.details) {
        const logFn = Logger.logLevelForError(err.code)
        LoggerRouter.log(logFn, req, res);
        // use separate rendering for detailsStr
        const d = err.detailsStr;
        delete err.detailsStr;
        logFn(err);
        err.detailsStr = d;
        delete err.details; // do not send back error object to the client side

        // hide error details for non developers
        if (
          !(
            forcedDebug ||
            (req.session &&
              req.session['user'] &&
              req.session['user'].role >= UserRoles.Developer)
          )
        ) {
          delete err.detailsStr;
        }
      }
      const message = new Message<null>(err, null);
      res.json(message);
      return;
    }
    NotificationManager.error('Unknown server error', err, req);
    return next(err);
  }

  protected static renderMessage<T>(res: Response, content: T): void {
    const message = new Message<T>(null, content);
    res.json(message);
  }
}
