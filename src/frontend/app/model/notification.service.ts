import { Injectable, inject } from '@angular/core';
import {ToastService} from '../ui/toast/toast.service';
import {NetworkService} from './network/network.service';
import {AuthenticationService} from './network/authentication.service';
import {NotificationDTO, NotificationType,} from '../../../common/entities/NotificationDTO';
import {UserDTO, UserRoles} from '../../../common/entities/UserDTO';

export interface CountedNotificationDTO extends NotificationDTO {
  count: number;
}

@Injectable({providedIn: 'root'})
export class NotificationService {
  private toastService = inject(ToastService);
  private networkService = inject(NetworkService);
  private authService = inject(AuthenticationService);

  countedNotifications: CountedNotificationDTO[] = [];
  numberOfNotifications = 0;
  lastUser: UserDTO = null;

  constructor() {
    this.authService.user.subscribe(() => {
      if (
          this.authService.isAuthenticated() &&
          (!this.lastUser ||
              this.lastUser.id !== this.authService.user.value.id) &&
          this.authService.user.value.role >= UserRoles.User
      ) {
        this.getServerNotifications();
      }
      this.lastUser = this.authService.user.value;
    });
  }

  groupNotifications(notifications: NotificationDTO[]): void {
    const groups: {
      [key: string]: { notification: NotificationDTO; count: number };
    } = {};
    notifications.forEach((n) => {
      let key = n.message;
      if (n.details) {
        key += JSON.stringify(n.details);
      }
      groups[key] = groups[key] || {notification: n, count: 0};
      groups[key].count++;
    });
    this.numberOfNotifications = notifications.length;
    this.countedNotifications = [];
    for (const key of Object.keys(groups)) {
      (groups[key].notification as CountedNotificationDTO).count =
          groups[key].count;
      this.countedNotifications.push(
          groups[key].notification as CountedNotificationDTO
      );
    }
  }

  async getServerNotifications(): Promise<void> {
    try {
      this.groupNotifications(
          (await this.networkService.getJson<NotificationDTO[]>(
              '/notifications'
          )) || []
      );
      this.countedNotifications.forEach((noti) => {
        let msg = '(' + noti.count + ') ' + noti.message;
        if (noti.details) {
          msg += ' Details: ' + JSON.stringify(noti.details);
        }
        switch (noti.type) {
          case NotificationType.error:
            this.error(msg, $localize`Server error`);
            break;
          case NotificationType.warning:
            this.warning(msg, $localize`Server error`);
            break;
          case NotificationType.info:
            this.info(msg, $localize`Server info`);
            break;
        }
      });
    } catch (e) {
      console.error(e);
    }
  }

  success(text: string, title: string = null): void {
    this.toastService.show('success', text, title);
  }

  error(text: string, title?: string): void {
    this.toastService.show('error', text, title);
  }

  warning(text: string, title?: string): void {
    this.toastService.show('warning', text, title);
  }

  info(text: string, title: string = null): void {
    this.toastService.show('info', text, title);
  }
}
