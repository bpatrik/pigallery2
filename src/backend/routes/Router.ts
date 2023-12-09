import {Express} from 'express';
import {PublicRouter} from './PublicRouter';
import {UserRouter} from './UserRouter';
import {GalleryRouter} from './GalleryRouter';
import {PersonRouter} from './PersonRouter';
import {SharingRouter} from './SharingRouter';
import {AdminRouter} from './admin/AdminRouter';
import {SettingsRouter} from './admin/SettingsRouter';
import {NotificationRouter} from './NotificationRouter';
import {ErrorRouter} from './ErrorRouter';
import {AlbumRouter} from './AlbumRouter';

export class Router {
  public static route(app: Express): void {
    PublicRouter.route(app);

    AdminRouter.route(app);
    AlbumRouter.route(app);
    GalleryRouter.route(app);
    NotificationRouter.route(app);
    PersonRouter.route(app);
    SettingsRouter.route(app);
    SharingRouter.route(app);
    UserRouter.route(app);

    ErrorRouter.route(app);
  }
}
