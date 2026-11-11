// Admin notifications (#1315): the server warns the admins, e.g. that the default admin password is still in use.
import {Config} from '../../../../src/common/config/private/Config';
import {Server} from '../../../../src/backend/server';
import {UserDTO, UserRoles} from '../../../../src/common/entities/UserDTO';
import {ObjectManagers} from '../../../../src/backend/model/ObjectManagers';
import {NotificationManager} from '../../../../src/backend/model/NotifocationManager';
import {NotificationDTO, NotificationType} from '../../../../src/common/entities/NotificationDTO';
import {DatabaseType} from '../../../../src/common/config/private/PrivateConfig';
import {CookieNames} from '../../../../src/common/CookieNames';
import {SuperAgentStatic} from 'superagent';
import {expect} from 'chai';
import * as chai from 'chai';
import {default as chaiHttp, request} from 'chai-http';
import {DBTestHelper} from '../../DBTestHelper';
import {TestHelper} from '../../../TestHelper';

process.env['NODE_ENV'] = 'test';
chai.use(chaiHttp);

describe('NotificationRouter (#1315)', () => {
  before(TestHelper.resetConfig);
  const sqlHelper = new DBTestHelper(DatabaseType.sqlite);
  const normalUser = {name: 'normal_user', password: 'password', role: UserRoles.User};
  const DEFAULT_ADMIN_WARNING = 'Using default admin user!';
  let server: Server;

  const setUp = async (suppressDefUserWarn: boolean): Promise<void> => {
    NotificationManager.notifications = [];
    Config.Users.authenticationRequired = true;
    Config.Users.suppressDefUserWarn = suppressDefUserWarn;
    // the DB init creates the default admin (admin/admin) and warns about it
    await sqlHelper.initDB();
    server = new Server(false);
    await server.onStarted.wait();
    await ObjectManagers.getInstance().UserManager.createUser({...normalUser} as UserDTO);
  };

  afterEach(async () => {
    await sqlHelper.clearDB();
    NotificationManager.notifications = [];
  });

  const login = async (username: string, password: string): Promise<string> => {
    const res = await (request.execute(server.Server) as SuperAgentStatic)
      .post(Config.Server.apiPath + '/user/login')
      .send({loginCredential: {username, password, rememberMe: false}});
    expect(res.status, 'login of ' + username).to.equal(200);
    const cookies = res.headers['set-cookie'] as unknown as string[];
    return cookies.filter(c => c.startsWith(CookieNames.session)).map(c => c.split(';')[0]).join('; ');
  };

  const notificationsOf = async (username: string, password: string): Promise<NotificationDTO[]> => {
    const cookie = await login(username, password);
    const res = await (request.execute(server.Server) as SuperAgentStatic)
      .get(Config.Server.apiPath + '/notifications')
      .set('Cookie', cookie);
    expect(res.status).to.equal(200);
    expect(res.body.error).to.equal(null);
    return res.body.result;
  };

  it('should warn the admin that the default admin password is in use', async () => {
    await setUp(false);
    const warning = (await notificationsOf('admin', 'admin')).find(n => n.message === DEFAULT_ADMIN_WARNING);
    expect(warning, 'the default admin warning').to.not.be.undefined;
    expect(warning!.type).to.equal(NotificationType.error);
    expect(String(warning!.details)).to.contain('password');
  });

  it('should only tell a normal user that there are notifications for the admins', async () => {
    await setUp(false);
    const notifications = await notificationsOf(normalUser.name, normalUser.password);
    expect(notifications).to.deep.equal(NotificationManager.HasNotification);
    expect(JSON.stringify(notifications)).to.not.contain(DEFAULT_ADMIN_WARNING);
  });

  it('should not warn about the default admin with Users.suppressDefUserWarn', async () => {
    await setUp(true);
    const notifications = await notificationsOf('admin', 'admin');
    expect(JSON.stringify(notifications)).to.not.contain(DEFAULT_ADMIN_WARNING);
  });
});
