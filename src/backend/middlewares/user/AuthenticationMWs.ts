import {NextFunction, Request, Response} from 'express';
import {ErrorCodes, ErrorDTO} from '../../../common/entities/Error';
import {UserDTO, UserRoles,} from '../../../common/entities/UserDTO';
import {ObjectManagers} from '../../model/ObjectManagers';
import {Config} from '../../../common/config/private/Config';
import {PasswordHelper} from '../../model/PasswordHelper';
import {Utils} from '../../../common/Utils';
import {QueryParams} from '../../../common/QueryParams';
import * as path from 'path';
import {Logger} from '../../Logger';
import {ContextUser} from '../../model/SessionContext';

const LOG_TAG = 'AuthenticationMWs';

export class AuthenticationMWs {

  public static async tryAuthenticate(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    if (Config.Users.authenticationRequired === false) {
      const user =  ObjectManagers.getInstance().UserManager.getUnAuthenticatedUser();
      req.session.context = await ObjectManagers.getInstance().SessionManager.buildContext(user);
      return next();
    }
    try {
      const user = await AuthenticationMWs.getSharingUser(req);
      if (user) {
        req.session.context = await ObjectManagers.getInstance().SessionManager.buildContext(user);
        return next();
      }
      // eslint-disable-next-line no-empty
    } catch (err) {
    }

    return next();
  }

  public static async authenticate(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    if (Config.Users.authenticationRequired === false) {
      const user =  ObjectManagers.getInstance().UserManager.getUnAuthenticatedUser();
      req.session.context = await ObjectManagers.getInstance().SessionManager.buildContext(user);
      return next();
    }

    // if already authenticated, do not try to use sharing authentication
    if (typeof req.session.context !== 'undefined') {
      // fix context. projectionQuery gets lost in the session between calls
      if (req.session?.context && req.session.context?.user?.projectionKey && (!req.session.context?.projectionQuery || Object.keys(req.session.context?.projectionQuery || {}).length === 0)) {
          req.session.context = await ObjectManagers.getInstance().SessionManager.buildContext(req.session.context.user);
      }
      // auto extend session if rememberMe is set
      if (req.session.rememberMe) {
        req.sessionOptions.expires = new Date(
          Date.now() + Config.Server.sessionTimeout
        );
        req.session.expires = req.sessionOptions.expires.getTime();
      }
      return next();
    }

    try {
      const user = await AuthenticationMWs.getSharingUser(req);
      if (user) {
        req.session.context = await ObjectManagers.getInstance().SessionManager.buildContext(user);
        return next();
      }
    } catch (err) {
      return next(new ErrorDTO(ErrorCodes.CREDENTIAL_NOT_FOUND, null, err));
    }
    if (typeof req.session.context === 'undefined') {
      res.status(401);
      return next(
        new ErrorDTO(ErrorCodes.NOT_AUTHENTICATED, 'Not authenticated')
      );
    }
    return next();
  }

  public static normalizePathParam(
    paramName: string
  ): (req: Request, res: Response, next: NextFunction) => void {
    return function normalizePathParam(
      req: Request,
      res: Response,
      next: NextFunction
    ): void {
      req.params[paramName] = path
        .normalize(req.params[paramName] || path.sep)
        // eslint-disable-next-line no-useless-escape
        .replace(/^(\.\.[\/\\])+/, '');
      return next();
    };
  }


  public static authoriseMetaFiles(
    paramName: string
  ): (req: Request, res: Response, next: NextFunction) => Promise<void> {
    return async function authoriseMetaFiles(
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> {
      try {
        const p: string = req.params[paramName];

        if (!await ObjectManagers.getInstance().GalleryManager.authoriseMetaFile(req.session.context, p)) {
          res.sendStatus(403);
          return;
        }

        return next();
      } catch (e) {
        // On error, fail closed to be safe
        Logger.warn(LOG_TAG, 'authoriseMedia error:', e);
        res.sendStatus(403);
        return;
      }
    };
  }

  public static authoriseMedia(
    paramName: string
  ): (req: Request, res: Response, next: NextFunction) => Promise<void> {
    return async function authoriseMedia(
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> {
      try {
        const mediaRelPath: string = req.params[paramName];

        if (!await ObjectManagers.getInstance().GalleryManager.authoriseMedia(req.session.context, mediaRelPath)) {
          res.sendStatus(403);
          return;
        }


        return next();
      } catch (e) {
        // On error, fail closed to be safe
        Logger.warn(LOG_TAG, 'authoriseMedia error:', e);
        res.sendStatus(403);
        return;
      }
    };
  }

  public static authorise(
    role: UserRoles
  ): (req: Request, res: Response, next: NextFunction) => void {
    return function authorise(
      req: Request,
      res: Response,
      next: NextFunction
    ): void {
      if (req.session.context?.user.role < role) {
        return next(new ErrorDTO(ErrorCodes.NOT_AUTHORISED));
      }
      return next();
    };
  }

  public static async shareLogin(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    if (Config.Sharing.enabled === false) {
      return next();
    }
    // not enough parameter
    if (
      !req.query[QueryParams.gallery.sharingKey_query] &&
      !req.params[QueryParams.gallery.sharingKey_params]
    ) {
      return next(
        new ErrorDTO(ErrorCodes.INPUT_ERROR, 'no sharing key provided')
      );
    }

    try {
      const password = (req.body ? req.body.password : null) || null;
      const sharingKey: string =
        (req.query[QueryParams.gallery.sharingKey_query] as string) ||
        (req.params[QueryParams.gallery.sharingKey_params] as string);
      const sharing = await ObjectManagers.getInstance().SharingManager.findOne(sharingKey);

      if (
        !sharing ||
        sharing.expires < Date.now() ||
        ((Config.Sharing.passwordRequired === true ||
            sharing.password) &&
          !PasswordHelper.comparePassword(password, sharing.password))
      ) {
        Logger.warn(LOG_TAG, 'Failed login from IP `' + req.ip + '` with sharing:' + sharing.sharingKey + ', bad password');
        res.status(401);
        return next(new ErrorDTO(ErrorCodes.CREDENTIAL_NOT_FOUND));
      }

      const user = {
        name: 'Guest',
        role: UserRoles.LimitedGuest,
        usedSharingKey: sharing.sharingKey,
        overrideAllowBlockList: true,
        allowQuery: ObjectManagers.getInstance().SessionManager.buildAllowListForSharing(sharing)
      } as ContextUser;
      req.session.context = await ObjectManagers.getInstance().SessionManager.buildContext(user);
      return next();
    } catch (err) {
      return next(new ErrorDTO(ErrorCodes.GENERAL_ERROR, null, err));
    }
  }

  public static inverseAuthenticate(
    req: Request,
    res: Response,
    next: NextFunction
  ): void {
    if (typeof req.session.context?.user !== 'undefined') {
      return next(new ErrorDTO(ErrorCodes.ALREADY_AUTHENTICATED));
    }
    return next();
  }

  public static async login(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void | Response> {
    if (Config.Users.authenticationRequired === false) {
      return res.sendStatus(404);
    }

    // not enough parameters
    if (
      typeof req.body === 'undefined' ||
      typeof req.body.loginCredential === 'undefined' ||
      typeof req.body.loginCredential.username === 'undefined' ||
      typeof req.body.loginCredential.password === 'undefined'
    ) {
      Logger.warn(LOG_TAG, 'Failed login from IP `' + req.ip + '` no user or password provided');
      return next(
        new ErrorDTO(
          ErrorCodes.INPUT_ERROR,
          'not all parameters are included for loginCredential'
        )
      );
    }
    try {
      // let's find the user
      const user = Utils.clone(
        await ObjectManagers.getInstance().UserManager.findOne({
          name: req.body.loginCredential.username,
          password: req.body.loginCredential.password,
        })
      );
      delete user.password;
      req.session.context = await ObjectManagers.getInstance().SessionManager.buildContext(user);
      req.session.rememberMe = req.body.loginCredential.rememberMe;
      if (req.session.rememberMe) {
        req.sessionOptions.expires = new Date(
          Date.now() + Config.Server.sessionTimeout
        );
        req.session.expires = req.sessionOptions.expires.getTime();
      }
      return next();
    } catch (err) {
      Logger.warn(LOG_TAG, 'Failed login from IP `' + req.ip + '` for user:' + req.body.loginCredential.username
          + ', bad password');
      return next(
        new ErrorDTO(
          ErrorCodes.CREDENTIAL_NOT_FOUND,
          'credentials not found during login',
          err
        )
      );
    }
  }

  public static logout(req: Request, res: Response, next: NextFunction): void {
    delete req.session.context;
    return next();
  }

  private static async getSharingUser(req: Request): Promise<ContextUser> {
    if (
      Config.Sharing.enabled === true &&
      (!!req.query[QueryParams.gallery.sharingKey_query] ||
        !!req.params[QueryParams.gallery.sharingKey_params])
    ) {
      const sharingKey: string =
        (req.query[QueryParams.gallery.sharingKey_query] as string) ||
        (req.params[QueryParams.gallery.sharingKey_params] as string);
      const sharing = await ObjectManagers.getInstance().SharingManager.findOne(sharingKey);
      if (!sharing || sharing.expires < Date.now()) {
        return null;
      }

      // no 'free login' if passwords are required, or it is set
      if (
        Config.Sharing.passwordRequired === true ||
        sharing.password
      ) {
        return null;
      }

      return {
        name: 'Guest',
        role: UserRoles.LimitedGuest,
        usedSharingKey: sharing.sharingKey,
        overrideAllowBlockList: true,
        allowQuery: ObjectManagers.getInstance().SessionManager.buildAllowListForSharing(sharing)
      } as ContextUser;
    }
    return null;
  }
}
