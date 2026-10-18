import {AuthenticationMWs} from '../middlewares/user/AuthenticationMWs';
import {UserRoles} from '../../common/entities/UserDTO';
import {RenderingMWs} from '../middlewares/RenderingMWs';
import {SharingMWs} from '../middlewares/SharingMWs';
import {GalleryMWs} from '../middlewares/GalleryMWs';
import * as express from 'express';
import {QueryParams} from '../../common/QueryParams';
import {ServerTimingMWs} from '../middlewares/ServerTimingMWs';
import {Config} from '../../common/config/private/Config';

export class SharingRouter {
  public static route(app: express.Express): void {
    this.addShareLogin(app);
    this.addGetSharing(app);
    this.addGetSharingPublicInfo(app);
    this.addCreateSharing(app);
    this.addUpdateSharing(app);
    this.addListSharing(app);
    this.addListSharingForDir(app);
    this.addDeleteSharing(app);
  }

  private static addShareLogin(app: express.Express): void {
    app.post(
      Config.Server.apiPath + '/share/login',
      AuthenticationMWs.inverseAuthenticate,
      AuthenticationMWs.shareLogin,
      ServerTimingMWs.addServerTiming,
      RenderingMWs.renderSessionUser
    );
  }

  /**
   * Used to check the key validity
   * @param app
   * @private
   */
  private static addGetSharingPublicInfo(app: express.Express): void {
    app.get(
      Config.Server.apiPath + '/share/:' + QueryParams.gallery.sharingKey_params + '/publicInfo',
      // it's a public path
      SharingMWs.getSharingPublicInfo,
      ServerTimingMWs.addServerTiming,
      RenderingMWs.renderResult
    );
  }

  private static addGetSharing(app: express.Express): void {
    app.get(
      Config.Server.apiPath + '/share/:' + QueryParams.gallery.sharingKey_params,
      AuthenticationMWs.authenticate,
      AuthenticationMWs.authorise(UserRoles.LimitedGuest),
      SharingMWs.getSharing,
      ServerTimingMWs.addServerTiming,
      RenderingMWs.renderSharing
    );
  }

  private static addCreateSharing(app: express.Express): void {
    app.post(
      [Config.Server.apiPath + '/share/:directory(*)', Config.Server.apiPath + '/share/', Config.Server.apiPath + '/share//'],
      AuthenticationMWs.authenticate,
      AuthenticationMWs.authorise(UserRoles.User),
      SharingMWs.createSharing,
      ServerTimingMWs.addServerTiming,
      RenderingMWs.renderSharing
    );
  }

  private static addUpdateSharing(app: express.Express): void {
    app.put(
      [Config.Server.apiPath + '/share/:directory(*)', Config.Server.apiPath + '/share/', Config.Server.apiPath + '/share//'],
      AuthenticationMWs.authenticate,
      AuthenticationMWs.authorise(UserRoles.User),
      SharingMWs.updateSharing,
      ServerTimingMWs.addServerTiming,
      RenderingMWs.renderSharing
    );
  }

  private static addDeleteSharing(app: express.Express): void {
    app.delete(
      [Config.Server.apiPath + '/share/:' + QueryParams.gallery.sharingKey_params],
      AuthenticationMWs.authenticate,
      AuthenticationMWs.authorise(UserRoles.User),
      SharingMWs.deleteSharing,
      ServerTimingMWs.addServerTiming,
      RenderingMWs.renderResult
    );
  }

  private static addListSharing(app: express.Express): void {
    app.get(
      [Config.Server.apiPath + '/share/listAll'],
      AuthenticationMWs.authenticate,
      AuthenticationMWs.authorise(UserRoles.Admin),
      SharingMWs.listSharing,
      ServerTimingMWs.addServerTiming,
      RenderingMWs.renderSharingList
    );
  }

  private static addListSharingForDir(app: express.Express): void {
    app.get(
      [Config.Server.apiPath + '/share/list/:searchQueryDTO'],
      AuthenticationMWs.authenticate,
      AuthenticationMWs.authorise(UserRoles.User),
      GalleryMWs.parseSearchQuery,
      SharingMWs.listSharingForQuery,
      ServerTimingMWs.addServerTiming,
      RenderingMWs.renderSharingList
    );
  }
}
