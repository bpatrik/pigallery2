import {Express} from 'express';
import { ServerTimingMWs } from '../../middlewares/ServerTimingMWs';
import { AuthenticationMWs } from '../../middlewares/user/AuthenticationMWs';
import {ExtensionManager} from '../../model/extension/ExtensionManager';
import {RenderingMWs} from '../../middlewares/RenderingMWs';
import {UserRoles} from '../../../common/entities/UserDTO';
import {ExtensionMWs} from '../../middlewares/admin/ExtensionMWs';

export class ExtensionRouter {
  public static route(app: Express): void {
    this.addExtensionList(app);
    this.addExtensionInstall(app);
  }

  private static addExtensionList(app: Express): void {
    app.get(
      [ExtensionManager.EXTENSION_API_PATH+'/list'],
      AuthenticationMWs.authenticate,
      AuthenticationMWs.authorise(UserRoles.Admin),
      ServerTimingMWs.addServerTiming,
      ExtensionMWs.getExtensionList,
      RenderingMWs.renderResult
    );
  }

  private static addExtensionInstall(app: Express): void {
    app.post(
      [ExtensionManager.EXTENSION_API_PATH+'/install'],
      AuthenticationMWs.authenticate,
      AuthenticationMWs.authorise(UserRoles.Admin),
      ServerTimingMWs.addServerTiming,
      ExtensionMWs.installExtension,
      RenderingMWs.renderResult
    );
  }

}
