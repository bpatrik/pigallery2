export enum NotificationType {
  error = 1,
  warning = 2,
  info = 3,
}

export interface NotificationDTO {
  type: NotificationType;
  message: string;
  details?: unknown;
  request?: {
    method: string;
    url: string;
    statusCode?: number;
  };
}
