import {AuthenticationMWs} from '../../middlewares/user/AuthenticationMWs';
import {UserRoles} from '../../../common/entities/UserDTO';
import {RenderingMWs} from '../../middlewares/RenderingMWs';
import {Express} from 'express';
import {SettingsMWs} from '../../middlewares/admin/SettingsMWs';
import {Config} from '../../../common/config/private/Config';

export class SettingsRouter {
  public static route(app: Express): void {
    this.addSettings(app);
  }

  private static addSettings(app: Express): void {
    app.get(
        Config.Server.apiPath + '/settings',
        AuthenticationMWs.authenticate,
        AuthenticationMWs.authorise(UserRoles.Admin),
        RenderingMWs.renderConfig
    );

    app.put(
        Config.Server.apiPath + '/settings',
        AuthenticationMWs.authenticate,
        AuthenticationMWs.authorise(UserRoles.Admin),
        SettingsMWs.updateSettings,
        RenderingMWs.renderOK
    );

  }
}
