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
      await ObjectManagers.getInstance().UserManager.deleteUser(
          parseInt(req.params.id, 10)
      );
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
      await ObjectManagers.getInstance().UserManager.changeRole(
          parseInt(req.params.id, 10),
          req.body.newRole
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
