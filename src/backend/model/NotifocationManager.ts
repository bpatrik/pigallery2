import {NotificationDTO, NotificationType,} from '../../common/entities/NotificationDTO';
import {Request} from 'express';

export class NotificationManager {
  public static notifications: NotificationDTO[] = [];
  public static HasNotification: NotificationDTO[] = [
    {
      type: NotificationType.info,
      message:
          'There are unhandled server notification. Login as Administrator to handle them.',
    },
  ];

  public static error(message: string, details?: unknown, req?: Request): void {
    const noti: NotificationDTO = {
      type: NotificationType.error,
      message,
      details,
    };
    if (req) {
      noti.request = {
        method: req.method,
        url: req.url,
        statusCode: req.statusCode,
      };
    }
    NotificationManager.notifications.push(noti);
  }

  public static warning(message: string, details?: unknown, req?: Request): void {
    const noti: NotificationDTO = {
      type: NotificationType.warning,
      message,
      details,
    };
    if (req) {
      noti.request = {
        method: req.method,
        url: req.url,
        statusCode: req.statusCode,
      };
    }
    NotificationManager.notifications.push(noti);
  }
}
