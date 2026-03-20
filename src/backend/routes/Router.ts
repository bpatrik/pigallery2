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
import {ExtensionRouter} from './admin/ExtensionRouter';
import {VersionMWs} from '../middlewares/VersionMWs';
import {OIDCRouter} from './OIDCRouter';
import {UploadRouter} from './UploadRouter';

export class Router {
  public static route(app: Express): void {
    app.use(VersionMWs.injectAppVersion);
    PublicRouter.route(app);

    AdminRouter.route(app);
    ExtensionRouter.route(app);
    OIDCRouter.route(app);
    AlbumRouter.route(app);
    GalleryRouter.route(app);
    NotificationRouter.route(app);
    PersonRouter.route(app);
    SettingsRouter.route(app);
    SharingRouter.route(app);
    UserRouter.route(app);
    UploadRouter.route(app);

    ErrorRouter.route(app);
  }
}
