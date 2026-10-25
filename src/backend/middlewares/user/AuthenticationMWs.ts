import {NextFunction, Request, Response} from 'express';
import {ErrorCodes, ErrorDTO} from '../../../common/entities/Error';
import {UserRoles,} from '../../../common/entities/UserDTO';
import {ObjectManagers} from '../../model/ObjectManagers';
import {Config} from '../../../common/config/private/Config';
import {PasswordHelper} from '../../model/PasswordHelper';
import {Utils} from '../../../common/Utils';
import {QueryParams} from '../../../common/QueryParams';
import * as path from 'path';
import {Logger} from '../../Logger';
import {SessionUser, SessionContext} from '../../model/SessionContext';
import {Brackets} from 'typeorm';
import {DirectoryAccess, DirectoryAccessTypes} from '../../model/DirectoryAccess';

const LOG_TAG = 'AuthenticationMWs';

export class AuthenticationMWs {

  public static async tryAuthenticate(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    if (Config.Users.authenticationRequired === false) {
      const user = ObjectManagers.getInstance().UserManager.getUnAuthenticatedUser();
      req.session.context = await ObjectManagers.getInstance().SessionManager.buildContext(user);
      return next();
    }
    try {
      // the page rendering uses the session user too
      await AuthenticationMWs.restoreSession(req);
      const user = await AuthenticationMWs.getSharingUser(req);
      if (user) {
        await AuthenticationMWs.startSession(req, user);
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
      const user = ObjectManagers.getInstance().UserManager.getUnAuthenticatedUser();
      req.session.context = await ObjectManagers.getInstance().SessionManager.buildContext(user);
      return next();
    }

    try {
      // if already authenticated, do not try to use sharing authentication
      if (await AuthenticationMWs.restoreSession(req)) {
        return next();
      }
    } catch (err) {
      res.status(500);
      return next(new ErrorDTO(ErrorCodes.INTERNAL, null, err));
    }

    let user;
    try {
      user = await AuthenticationMWs.getSharingUser(req);
    } catch (err) {
    }

    // no sharing user yet (eg.: its password protected)
    if (!user) {
      res.status(401);
      return next(
        new ErrorDTO(ErrorCodes.NOT_AUTHENTICATED_SHARING, 'Not authenticated sharing')
      );
    }


    try {
      await AuthenticationMWs.startSession(req, user);
    } catch (err) {
      res.status(500);
      return next(new ErrorDTO(ErrorCodes.INTERNAL, null, err));
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
      const p = path.normalize(req.params[paramName] || path.sep);
      // normalize() resolves inner '..' segments, only a leading one can escape the base folder
      if (p === '..' || p.startsWith('..' + path.sep)) {
        return next(new ErrorDTO(ErrorCodes.INPUT_ERROR, 'Invalid path'));
      }
      req.params[paramName] = p;
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
          res.sendStatus(404); // same as not existing
          return;
        }

        return next();
      } catch (e) {
        // On error, fail closed to be safe
        Logger.warn(LOG_TAG, 'authoriseMetaFiles error:', e);
        res.sendStatus(404); // same as not existing
        return;
      }
    };
  }

  /**
   * Authorises the directory against the directory allow and block lists of the session (see DirectoryAccess).
   * Not available directories get the same error as not existing ones, so it can't be used to find out if a directory exists.
   * It sets req.directoryAccess for the next middlewares.
   */
  public static authoriseDirectory(
    paramName: string
  ): (req: Request, res: Response, next: NextFunction) => Promise<void> {
    return async function authoriseDirectory(
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> {
      try {
        const dirRelPath: string = req.params[paramName] || path.sep;
        const access = req.session.context?.directoryAccess
          ? await req.session.context.directoryAccess.getAccess(dirRelPath)
          : DirectoryAccessTypes.none;
        if (access === DirectoryAccessTypes.none) {
          return AuthenticationMWs.directoryNotFound(res, next);
        }
        req.directoryAccess = access;
        return next();
      } catch (e) {
        // On error, fail closed to be safe
        Logger.warn(LOG_TAG, 'authoriseDirectory error:', e);
        return AuthenticationMWs.directoryNotFound(res, next);
      }
    };
  }

  /**
   * The response for not existing and not available directories. They need to be the same.
   */
  public static directoryNotFound(res: Response, next: NextFunction): void {
    res.status(404);
    return next(new ErrorDTO(ErrorCodes.DIRECTORY_NOT_FOUND, 'Directory not found'));
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
          res.sendStatus(404); // same as a not existing media, so it can't be used to probe paths
          return;
        }


        return next();
      } catch (e) {
        // On error, fail closed to be safe
        Logger.warn(LOG_TAG, 'authoriseMedia error:', e);
        res.sendStatus(404); // same as a not existing media, so it can't be used to probe paths
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
        res.status(401);
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

      await AuthenticationMWs.startSession(req, ObjectManagers.getInstance().SessionManager.createSharingUser(sharing));
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
      typeof req.body.loginCredential.username !== 'string' ||
      typeof req.body.loginCredential.password !== 'string' ||
      req.body.loginCredential.username.length === 0 ||
      req.body.loginCredential.password.length === 0
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
      const user = await ObjectManagers.getInstance().UserManager.findOne({
        name: req.body.loginCredential.username,
        password: req.body.loginCredential.password,
      });
      await AuthenticationMWs.startSession(req, user, req.body.loginCredential.rememberMe);
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

  /**
   * Logs in the user (or sharing guest) for this session.
   * Only "remember me" sessions survive closing the browser.
   */
  public static async startSession(req: Request, user: SessionUser, rememberMe = false): Promise<void> {
    const sm = ObjectManagers.getInstance().SessionManager;
    const sessionUser = Utils.clone(user);
    delete sessionUser.password;
    req.session.context = await sm.buildContext(sessionUser);
    req.session.stamp = await sm.getSessionStamp(sessionUser);
    req.session.rememberMe = rememberMe;
    AuthenticationMWs.extendSession(req);
  }

  /**
   * The session is stored in the cookie. It ends if it timed out or its user or sharing got deleted or changed
   * (see SessionManager.getSessionStamp).
   * Returns false if there is no session (anymore).
   */
  private static async restoreSession(req: Request): Promise<boolean> {
    const context = req.session.context;
    if (typeof context === 'undefined') {
      return false;
    }
    if (!context?.user || !(req.session.expires > Date.now()) || !req.session.stamp ||
      req.session.stamp !== await ObjectManagers.getInstance().SessionManager.getSessionStamp(context.user)) {
      delete req.session.context;
      delete req.session.stamp;
      delete req.session.rememberMe;
      return false;
    }
    // fix context. projectionQuery gets lost in the session between calls
    // Brackets do not survive serialization, so rebuild the context if they are not real Brackets anymore (fail closed)
    if (AuthenticationMWs.isContextBroken(context)) {
      req.session.context = await ObjectManagers.getInstance().SessionManager.buildContext(context.user);
    }
    AuthenticationMWs.extendSession(req);
    return true;
  }

  /**
   * Sessions expire after Server.sessionTimeout of inactivity.
   */
  private static extendSession(req: Request): void {
    req.session.expires = Date.now() + Config.Server.sessionTimeout;
    if (req.session.rememberMe) {
      req.sessionOptions.expires = new Date(req.session.expires);
    }
  }

  /**
   * Returns true if the prebuilt queries of the context got lost (e.g.: during session serialization)
   */
  private static isContextBroken(context: SessionContext): boolean {
    if (!context.user.projectionKey) {
      return false; // context was never built
    }
    // Rebuild also if there is no projection, so config changes (e.g.: new allow/block lists) are applied
    if (!(context.projectionQuery instanceof Brackets)) {
      return true;
    }
    // its methods and SQL filters are lost too
    return !(context.directoryAccess instanceof DirectoryAccess);
  }

  private static getSharingKey(req: Request) {
    return (req.query[QueryParams.gallery.sharingKey_query] as string) ||
      (req.params[QueryParams.gallery.sharingKey_params] as string);
  }

  private static async getSharingUser(req: Request): Promise<SessionUser> {
    if (
      Config.Sharing.enabled === false || !(typeof this.getSharingKey(req) === 'string' && this.getSharingKey(req) !== '')
    ) {
      return null;
    }

    const sharingKey: string = this.getSharingKey(req);
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

    return ObjectManagers.getInstance().SessionManager.createSharingUser(sharing);

  }
}
