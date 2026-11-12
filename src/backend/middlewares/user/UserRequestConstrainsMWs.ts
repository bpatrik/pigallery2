import {NextFunction, Request, Response} from 'express';
import {MoreThanOrEqual} from 'typeorm';
import {ErrorCodes, ErrorDTO} from '../../../common/entities/Error';
import {UserRoles} from '../../../common/entities/UserDTO';
import {ObjectManagers} from '../../model/ObjectManagers';
import {RequestParams} from '../RequestParams';
import {RequestSession} from '../RequestSession';

export class UserRequestConstrainsMWs {
  public static forceSelfRequest(
      req: Request,
      res: Response,
      next: NextFunction
  ): void {
    if (
        typeof req.params === 'undefined' ||
        typeof RequestParams.get(req, 'id') === 'undefined'
    ) {
      return next();
    }
    if (RequestSession.getContext(req).user.id !== parseInt(RequestParams.getRequired(req, 'id'), 10)) {
      return next(new ErrorDTO(ErrorCodes.NOT_AUTHORISED));
    }

    return next();
  }

  public static notSelfRequest(
      req: Request,
      res: Response,
      next: NextFunction
  ): void {
    if (
        typeof req.params === 'undefined' ||
        typeof RequestParams.get(req, 'id') === 'undefined'
    ) {
      return next();
    }

    if (RequestSession.getContext(req).user.id === parseInt(RequestParams.getRequired(req, 'id'), 10)) {
      return next(new ErrorDTO(ErrorCodes.NOT_AUTHORISED));
    }

    return next();
  }

  public static async notSelfRequestOr2Admins(
      req: Request,
      res: Response,
      next: NextFunction
  ): Promise<void> {
    if (
        typeof req.params === 'undefined' ||
        typeof RequestParams.get(req, 'id') === 'undefined'
    ) {
      return next();
    }

    if (RequestSession.getContext(req).user.id !== parseInt(RequestParams.getRequired(req, 'id'), 10)) {
      return next();
    }

    // TODO: fix it!
    try {
      const result = await ObjectManagers.getInstance().UserManager.find({
        role: MoreThanOrEqual(UserRoles.Admin),
      });
      if (result.length <= 1) {
        return next(new ErrorDTO(ErrorCodes.GENERAL_ERROR));
      }
      return next();
    } catch {
      return next(new ErrorDTO(ErrorCodes.GENERAL_ERROR));
    }
  }
}
