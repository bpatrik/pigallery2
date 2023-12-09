import {Injectable} from '@angular/core';
import {ToastrService} from 'ngx-toastr';
import {NetworkService} from './network/network.service';
import {AuthenticationService} from './network/authentication.service';
import {NotificationDTO, NotificationType,} from '../../../common/entities/NotificationDTO';
import {UserDTO, UserRoles} from '../../../common/entities/UserDTO';

export interface CountedNotificationDTO extends NotificationDTO {
  count: number;
}

@Injectable()
export class NotificationService {
  options = {
    positionClass: 'toast-top-center',
    animate: 'flyLeft',
  };
  countedNotifications: CountedNotificationDTO[] = [];
  numberOfNotifications = 0;
  lastUser: UserDTO = null;

  constructor(
      private toastr: ToastrService,
      private networkService: NetworkService,
      private authService: AuthenticationService
  ) {
    this.authService.user.subscribe(() => {
      if (
          this.authService.isAuthenticated() &&
          (!this.lastUser ||
              this.lastUser.id !== this.authService.user.value.id) &&
          this.authService.user.value.role >= UserRoles.Guest
      ) {
        this.getServerNotifications();
      }
      this.lastUser = this.authService.user.value;
    });
  }

  get Toastr(): ToastrService {
    return this.toastr;
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
    this.toastr.success(text, title, this.options);
  }

  error(text: string, title?: string): void {
    this.toastr.error(text, title, this.options);
  }

  warning(text: string, title?: string): void {
    this.toastr.warning(text, title, this.options);
  }

  info(text: string, title: string = null): void {
    this.toastr.info(text, title, this.options);
  }
}
