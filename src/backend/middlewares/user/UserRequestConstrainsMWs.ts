import {NextFunction, Request, Response} from 'express';
import {ErrorCodes, ErrorDTO} from '../../../common/entities/Error';
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
}
