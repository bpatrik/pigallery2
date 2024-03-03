import {AuthenticationMWs} from '../../middlewares/user/AuthenticationMWs';
import {UserRoles} from '../../../common/entities/UserDTO';
import {RenderingMWs} from '../../middlewares/RenderingMWs';
import {AdminMWs} from '../../middlewares/admin/AdminMWs';
import {Express} from 'express';
import {Config} from '../../../common/config/private/Config';

export class AdminRouter {
  public static route(app: Express): void {
    this.addGetStatistic(app);
    this.addGetDuplicates(app);
    this.addJobs(app);
    this.addMessengers(app);
  }

  private static addGetStatistic(app: Express): void {
    app.get(
        Config.Server.apiPath + '/admin/statistic',
        AuthenticationMWs.authenticate,
        AuthenticationMWs.authorise(UserRoles.Admin),
        AdminMWs.loadStatistic,
        RenderingMWs.renderResult
    );
  }

  private static addGetDuplicates(app: Express): void {
    app.get(
        Config.Server.apiPath + '/admin/duplicates',
        AuthenticationMWs.authenticate,
        AuthenticationMWs.authorise(UserRoles.Admin),
        AdminMWs.getDuplicates,
        RenderingMWs.renderResult
    );
  }

  private static addMessengers(app: Express): void {
    app.get(
      Config.Server.apiPath + '/admin/messengers/available',
      AuthenticationMWs.authenticate,
      AuthenticationMWs.authorise(UserRoles.Admin),
      AdminMWs.getAvailableMessengers,
      RenderingMWs.renderResult
    );
  }
  private static addJobs(app: Express): void {
    app.get(
        Config.Server.apiPath + '/admin/jobs/available',
        AuthenticationMWs.authenticate,
        AuthenticationMWs.authorise(UserRoles.Admin),
        AdminMWs.getAvailableJobs,
        RenderingMWs.renderResult
    );
    app.get(
        Config.Server.apiPath + '/admin/jobs/scheduled/progress',
        AuthenticationMWs.authenticate,
        AuthenticationMWs.authorise(UserRoles.Admin),
        AdminMWs.getJobProgresses,
        RenderingMWs.renderResult
    );
    app.post(
        Config.Server.apiPath + '/admin/jobs/scheduled/:id/start',
        AuthenticationMWs.authenticate,
        AuthenticationMWs.authorise(UserRoles.Admin),
        AdminMWs.startJob,
        RenderingMWs.renderResult
    );
    app.post(
        Config.Server.apiPath + '/admin/jobs/scheduled/:id/stop',
        AuthenticationMWs.authenticate,
        AuthenticationMWs.authorise(UserRoles.Admin),
        AdminMWs.stopJob,
        RenderingMWs.renderResult
    );
  }
}
