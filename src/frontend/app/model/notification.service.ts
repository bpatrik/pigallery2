import { Injectable, inject } from '@angular/core';
import {ToastService, ToastSummary, ToastType} from '../ui/toast/toast.service';
import {NetworkService} from './network/network.service';
import {AuthenticationService} from './network/authentication.service';
import {NotificationDTO, NotificationType,} from '../../../common/entities/NotificationDTO';
import {UserDTO, UserRoles} from '../../../common/entities/UserDTO';

export interface CountedNotificationDTO extends NotificationDTO {
  count: number;
}

@Injectable({providedIn: 'root'})
export class NotificationService {
  private static readonly TOAST_GROUP = 'notifications';
  private toastService = inject(ToastService);
  private networkService = inject(NetworkService);
  private authService = inject(AuthenticationService);

  countedNotifications: CountedNotificationDTO[] = [];
  numberOfNotifications = 0;
  lastUser: UserDTO = null;

  constructor() {
    // More than 3 notifications at once (e.g. server errors at login) would cover the page
    this.toastService.registerGroup(NotificationService.TOAST_GROUP, {
      collapseAfter: 3,
      visibleWhenCollapsed: 3,
      summary: (toasts, hidden, expanded): ToastSummary => ({
        type: 'info',
        color: 'secondary',
        title: expanded ? $localize`Show fewer notifications` : $localize`More notifications: ${hidden.length}:count:`,
        closable: true
      })
    });
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

  /**
   * Makes notification details readable:
   * strings are shown without JSON quoting/escaping, one sentence per line,
   * objects are pretty-printed.
   */
  static formatDetails(details: unknown): string {
    if (typeof details !== 'string') {
      return JSON.stringify(details, null, 2);
    }
    return details
      .replace(/^Error: /, '')
      .replace(/([.!?])\s+(?=[A-Z])/g, '$1\n');
  }

  async getServerNotifications(): Promise<void> {
    try {
      this.groupNotifications(
          (await this.networkService.getJson<NotificationDTO[]>(
              '/notifications'
          )) || []
      );
      // The message is the title, the details go below it, like on the admin page
      this.countedNotifications.forEach((noti) => {
        const title = '(' + noti.count + ') ' + noti.message;
        const details = noti.details ? NotificationService.formatDetails(noti.details) : null;
        switch (noti.type) {
          case NotificationType.error:
            this.error(details, title);
            break;
          case NotificationType.warning:
            this.warning(details, title);
            break;
          case NotificationType.info:
            this.info(details, title);
            break;
        }
      });
    } catch (e) {
      console.error(e);
    }
  }

  success(text: string, title: string = null): void {
    this.show('success', text, title);
  }

  error(text: string, title?: string): void {
    this.show('error', text, title);
  }

  warning(text: string, title?: string): void {
    this.show('warning', text, title);
  }

  info(text: string, title: string = null): void {
    this.show('info', text, title);
  }

  private show(type: ToastType, text: string, title: string): void {
    this.toastService.open({type, text, title, timeout: ToastService.TIMEOUT, group: NotificationService.TOAST_GROUP});
  }
}
