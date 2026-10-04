import {Express} from 'express';
import {Config} from '../../common/config/private/Config';
import {UserRoles} from '../../common/entities/UserDTO';
import {AuthenticationMWs} from '../middlewares/user/AuthenticationMWs';
import {RenderingMWs} from '../middlewares/RenderingMWs';
import {ServerTimingMWs} from '../middlewares/ServerTimingMWs';
import {TimelineMWs} from '../middlewares/TimelineMWs';
import {VersionMWs} from '../middlewares/VersionMWs';

export class TimelineRouter {
  public static route(app: Express): void {
    app.get(
      Config.Server.apiPath + '/timeline/media',
      AuthenticationMWs.authenticate,
      AuthenticationMWs.authorise(UserRoles.LimitedGuest),
      TimelineMWs.checkAvailable,
      VersionMWs.injectGalleryVersion,
      TimelineMWs.listMedia,
      ServerTimingMWs.addServerTiming,
      RenderingMWs.renderResult
    );
    app.get(
      Config.Server.apiPath + '/timeline/summary',
      AuthenticationMWs.authenticate,
      AuthenticationMWs.authorise(UserRoles.LimitedGuest),
      TimelineMWs.checkAvailable,
      VersionMWs.injectGalleryVersion,
      TimelineMWs.getSummary,
      ServerTimingMWs.addServerTiming,
      RenderingMWs.renderResult
    );
  }
}