import {AuthenticationMWs} from '../middlewares/user/AuthenticationMWs';
import {Express} from 'express';
import {RenderingMWs} from '../middlewares/RenderingMWs';
import {UserRoles} from '../../common/entities/UserDTO';
import {VersionMWs} from '../middlewares/VersionMWs';
import {AlbumMWs} from '../middlewares/AlbumMWs';
import {ServerTimingMWs} from '../middlewares/ServerTimingMWs';
import {Config} from '../../common/config/private/Config';

export class AlbumRouter {
  public static route(app: Express): void {
    this.addListAlbums(app);
    this.addAddSavedSearch(app);
    this.addDeleteAlbum(app);
  }

  private static addListAlbums(app: Express): void {
    app.get(
        [Config.Server.apiPath + '/albums'],
        // common part
        AuthenticationMWs.authenticate,
        AuthenticationMWs.authorise(UserRoles.User),
        VersionMWs.injectGalleryVersion,

        // specific part
        AlbumMWs.listAlbums,
        ServerTimingMWs.addServerTiming,
        RenderingMWs.renderResult
    );
  }

  private static addDeleteAlbum(app: Express): void {
    app.delete(
        [Config.Server.apiPath + '/albums/:id'],
        // common part
        AuthenticationMWs.authenticate,
        AuthenticationMWs.authorise(UserRoles.Admin),
        VersionMWs.injectGalleryVersion,

        // specific part
        AlbumMWs.deleteAlbum,
        ServerTimingMWs.addServerTiming,
        RenderingMWs.renderResult
    );
  }

  private static addAddSavedSearch(app: Express): void {
    app.put(
        [Config.Server.apiPath + '/albums/saved-searches'],
        // common part
        AuthenticationMWs.authenticate,
        AuthenticationMWs.authorise(UserRoles.Admin),
        VersionMWs.injectGalleryVersion,

        // specific part
        AlbumMWs.createSavedSearch,
        ServerTimingMWs.addServerTiming,
        RenderingMWs.renderResult
    );
  }
}
