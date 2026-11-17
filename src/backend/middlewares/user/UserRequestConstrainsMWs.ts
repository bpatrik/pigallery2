import {NextFunction, Request, Response} from 'express';
import {ErrorCodes, ErrorDTO} from '../../../common/entities/Error';
import {RequestParams} from '../RequestParams';
import {RequestSession} from '../RequestSession';
import {ObjectManagers} from '../../model/ObjectManagers';
import {Utils} from '../../../common/Utils';

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

  /**
   * Nobody can change or delete a user with a role above their own (e.g. an Admin can't touch a Developer).
   */
  public static async notAboveOwnRole(
      req: Request,
      res: Response,
      next: NextFunction
  ): Promise<void> {
    const id = parseInt(RequestParams.get(req, 'id') ?? '', 10);
    if (!Utils.isUInt32(id)) {
      return next();
    }
    try {
      const user = await ObjectManagers.getInstance().UserManager.findOne({id});
      if (user && Number(user.role) > Number(RequestSession.getContext(req).user.role)) {
        return next(new ErrorDTO(ErrorCodes.NOT_AUTHORISED));
      }
      return next();
    } catch (err) {
      return next(new ErrorDTO(ErrorCodes.GENERAL_ERROR, null, err));
    }
  }
}
