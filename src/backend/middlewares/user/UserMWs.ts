import {NextFunction, Request, Response} from 'express';
import {ErrorCodes, ErrorDTO} from '../../../common/entities/Error';
import {ObjectManagers} from '../../model/ObjectManagers';
import {Utils} from '../../../common/Utils';
import {Config} from '../../../common/config/private/Config';

export class UserMWs {
  public static async createUser(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    if (Config.Users.authenticationRequired === false) {
      return next(new ErrorDTO(ErrorCodes.USER_MANAGEMENT_DISABLED));
    }
    if (
      typeof req.body === 'undefined' ||
      typeof req.body.newUser === 'undefined'
    ) {
      return next();
    }

    try {
      await ObjectManagers.getInstance().UserManager.createUser(
        req.body.newUser
      );
      return next();
    } catch (err) {
      return next(new ErrorDTO(ErrorCodes.USER_CREATION_ERROR, null, err));
    }
  }

  public static async deleteUser(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    if (Config.Users.authenticationRequired === false) {
      return next(new ErrorDTO(ErrorCodes.USER_MANAGEMENT_DISABLED));
    }
    if (
      typeof req.params === 'undefined' ||
      typeof req.params.id === 'undefined'
    ) {
      return next();
    }

    try {
      const deleted = await ObjectManagers.getInstance().UserManager.deleteUser(
        parseInt(req.params.id, 10)
      );
      // If current session user was deleted, clear the session context
      if (req.session?.context?.user?.id === deleted.id) {
        delete req.session.context;
      }
      return next();
    } catch (err) {
      return next(new ErrorDTO(ErrorCodes.GENERAL_ERROR, null, err));
    }
  }

  public static async changeRole(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    if (Config.Users.authenticationRequired === false) {
      return next(new ErrorDTO(ErrorCodes.USER_MANAGEMENT_DISABLED));
    }
    if (
      typeof req.params === 'undefined' ||
      typeof req.params.id === 'undefined' ||
      typeof req.body === 'undefined' ||
      typeof req.body.newRole === 'undefined'
    ) {
      return next();
    }

    try {
      const updatedUser = await ObjectManagers.getInstance().UserManager.changeRole(
        parseInt(req.params.id, 10),
        req.body.newRole
      );
      // If the current session user was changed, recreate the session context
      if (req.session?.context?.user?.id === updatedUser.id) {
        const newUser: any = Utils.clone(updatedUser);
        // Do not keep password in session
        if (newUser && typeof newUser.password !== 'undefined') {
          newUser.password = '';
        }
        // Preserve usedSharingKey if any
        if (req.session.context.user && (req.session.context.user as any).usedSharingKey) {
          newUser.usedSharingKey = (req.session.context.user as any).usedSharingKey;
        }
        req.session.context = await ObjectManagers.getInstance().SessionManager.buildContext(newUser);
      }
      return next();
    } catch (err) {
      return next(new ErrorDTO(ErrorCodes.GENERAL_ERROR, null, err));
    }
  }

  public static async updateSettings(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    if (Config.Users.authenticationRequired === false) {
      return next(new ErrorDTO(ErrorCodes.USER_MANAGEMENT_DISABLED));
    }
    if (
      typeof req.params === 'undefined' ||
      typeof req.params.id === 'undefined' ||
      typeof req.body === 'undefined' ||
      typeof req.body.settings === 'undefined'
    ) {
      return next();
    }

    try {
      const updatedUser = await ObjectManagers.getInstance().UserManager.updateSettings(
        parseInt(req.params.id, 10),
        req.body.settings
      );
      // If the current session user was changed, recreate the session context
      if (req.session?.context?.user?.id === updatedUser.id) {
        const user = Utils.clone(
          await ObjectManagers.getInstance().UserManager.findOne({
            id: updatedUser.id
          })
        );
        req.session.context = await ObjectManagers.getInstance().SessionManager.buildContext(user);
        //clean up after a change
        await ObjectManagers.getInstance().ProjectedCacheManager.cleanupNonExistingProjections();
      }
      return next();
    } catch (err) {
      return next(new ErrorDTO(ErrorCodes.GENERAL_ERROR, 'Can\'t update user settings', err));
    }
  }

  public static async unlinkOidc(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    if (Config.Users.authenticationRequired === false) {
      return next(new ErrorDTO(ErrorCodes.USER_MANAGEMENT_DISABLED));
    }
    if (
      typeof req.params === 'undefined' ||
      typeof req.params.id === 'undefined'
    ) {
      return next();
    }

    try {
      await ObjectManagers.getInstance().UserManager.setOidcSubject(
        parseInt(req.params.id, 10),
        null
      );
      return next();
    } catch (err) {
      return next(new ErrorDTO(ErrorCodes.GENERAL_ERROR, null, err));
    }
  }

  public static async listUsers(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    if (Config.Users.authenticationRequired === false) {
      return next(new ErrorDTO(ErrorCodes.USER_MANAGEMENT_DISABLED));
    }

    try {
      let result = await ObjectManagers.getInstance().UserManager.find({});
      result = Utils.clone(result);
      for (const item of result) {
        item.password = '';
      }
      req.resultPipe = result;
      next();
    } catch (err) {
      return next(new ErrorDTO(ErrorCodes.GENERAL_ERROR, null, err));
    }
  }
}
