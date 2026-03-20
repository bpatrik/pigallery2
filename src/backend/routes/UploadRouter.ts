import {AuthenticationMWs} from '../middlewares/user/AuthenticationMWs';
import {UserRoles} from '../../common/entities/UserDTO';
import {RenderingMWs} from '../middlewares/RenderingMWs';
import * as express from 'express';
import {ServerTimingMWs} from '../middlewares/ServerTimingMWs';
import {Config} from '../../common/config/private/Config';
import {UploadMWs} from '../middlewares/UploadMWs';
import {VersionMWs} from '../middlewares/VersionMWs';

export class UploadRouter {
  public static route(app: express.Express): void {
    this.addUpload(app);
  }

  private static addUpload(app: express.Express): void {
    app.post(
      [Config.Server.apiPath + '/upload/:directory(*)', Config.Server.apiPath + '/upload/', Config.Server.apiPath + '/upload//'],
      AuthenticationMWs.authenticate,
      AuthenticationMWs.authorise(Config.Upload.minimumRole),
      AuthenticationMWs.normalizePathParam('directory'),
      VersionMWs.injectGalleryVersion,

      UploadMWs.upload,

      ServerTimingMWs.addServerTiming,
      RenderingMWs.renderResult
    );
  }

}
