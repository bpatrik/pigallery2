import {NextFunction, Request, Response} from 'express';
import {UserRoles} from '../../common/entities/UserDTO';
import {NotificationManager} from '../model/NotifocationManager';

export class NotificationMWs {
  public static list(req: Request, res: Response, next: NextFunction): void {
    if (req.session['user'].role >= UserRoles.Admin) {
      req.resultPipe = NotificationManager.notifications;
    } else if (NotificationManager.notifications.length > 0) {
      req.resultPipe = NotificationManager.HasNotification;
    } else {
      req.resultPipe = [];
    }

    return next();
  }
}
