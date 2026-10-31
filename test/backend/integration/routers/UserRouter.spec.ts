import {Config} from '../../../../src/common/config/private/Config';
import {Server} from '../../../../src/backend/server';
import {LoginCredential} from '../../../../src/common/entities/LoginCredential';
import {UserDTO, UserRoles} from '../../../../src/common/entities/UserDTO';
import * as path from 'path';
import * as fs from 'fs';
import {SQLConnection} from '../../../../src/backend/model/database/SQLConnection';
import {ObjectManagers} from '../../../../src/backend/model/ObjectManagers';
import {QueryParams} from '../../../../src/common/QueryParams';
import {Utils} from '../../../../src/common/Utils';
import {SuperAgentStatic} from 'superagent';
import {RouteTestingHelper} from './RouteTestingHelper';
import {ErrorCodes} from '../../../../src/common/entities/Error';
import {DatabaseType} from '../../../../src/common/config/private/PrivateConfig';
import {ProjectPath} from '../../../../src/backend/ProjectPath';
import * as chai from "chai";
import {default as chaiHttp, request} from "chai-http";
import {DBTestHelper} from '../../DBTestHelper';

process.env.NODE_ENV = 'test';
const should = chai.should();
chai.use(chaiHttp);

describe('UserRouter', () => {
  const sqlHelper = new DBTestHelper(DatabaseType.sqlite);

  const testUser: UserDTO = {
    id: 1,
    name: 'test',
    password: 'test',
    projectionKey: DBTestHelper.defaultSession.user.projectionKey,
    role: UserRoles.User
  };
  const {password, ...expectedUser} = testUser;
  let server: Server;
  const setUp = async () => {
    await sqlHelper.initDB()

    server = new Server(false);
    await server.onStarted.wait();
    await ObjectManagers.getInstance().UserManager.createUser(Utils.clone(testUser));
    await SQLConnection.close();
  };
  const tearDown = async () => {
    await sqlHelper.clearDB()
  };



  const login = async (srv: Server): Promise<any> => {
    const csrf = await RouteTestingHelper.getCsrf(srv.Server);
    const result = await (request.execute(srv.Server) as SuperAgentStatic)
      .post(Config.Server.apiPath + '/user/login')
      .set('Cookie', csrf.cookies)
      .set('X-XSRF-TOKEN', csrf.token)
      .send({
        loginCredential: {
          password: testUser.password,
          username: testUser.name,
          rememberMe: false
        } as LoginCredential
      });

    RouteTestingHelper.shouldBeValidUIUser(result, expectedUser);
    return result;
  };


  describe('/POST user/login', () => {
    beforeEach(setUp);
    afterEach(tearDown);
    it('it should login', async () => {
      Config.Users.authenticationRequired = true;
      await login(server);

    });
    it('it should reject requests without a CSRF token', async () => {
      const result = await (request.execute(server.Server) as SuperAgentStatic)
        .post(Config.Server.apiPath + '/user/login');

      result.should.have.status(403);
    });
    it('it skip login', async () => {
      Config.Users.authenticationRequired = true;
      const csrf = await RouteTestingHelper.getCsrf(server.Server);
      Config.Users.authenticationRequired = false;
      const result = await request.execute(server.Server)
        .post(Config.Server.apiPath + '/user/login')
        .set('Cookie', csrf.cookies)
        .set('X-XSRF-TOKEN', csrf.token);

      result.should.have.status(404);
    });


  });


  describe('/GET user/me', () => {
    beforeEach(setUp);
    afterEach(tearDown);
    it('it should GET the authenticated user', async () => {
      Config.Users.authenticationRequired = true;

      const loginRes = await login(server);

      const result = await request.execute(server.Server)
        .get(Config.Server.apiPath + '/user/me')
        .set('Cookie', loginRes.res.headers['set-cookie']);

      RouteTestingHelper.shouldBeValidUIUser(result, expectedUser);
    });

    it('it should not authenticate', async () => {
      Config.Users.authenticationRequired = true;

      const result = await request.execute(server.Server)
        .get(Config.Server.apiPath + '/user/me');

      result.should.have.status(401);
    });

    it('it should authenticate as user with sharing key', async () => {
      Config.Users.authenticationRequired = true;
      Config.Sharing.enabled = true;
      Config.Sharing.passwordRequired = true;

      const sharingKey = (await RouteTestingHelper.createSharing(testUser, 'pass')).sharingKey;


      const loginRes = await login(server);
      const q: Record<string, string> = {};
      q[QueryParams.gallery.sharingKey_query] = sharingKey;
      const result = await request.execute(server.Server)
        .get(Config.Server.apiPath + '/user/me?' + QueryParams.gallery.sharingKey_query + '=' + sharingKey)
        .set('Cookie', loginRes.res.headers['set-cookie']);

      // should return with logged in user, not limited sharing one
      RouteTestingHelper.shouldBeValidUIUser(result, expectedUser);
    });


    it('it should authenticate with sharing key', async () => {
      Config.Users.authenticationRequired = true;
      Config.Sharing.enabled = true;
      Config.Sharing.passwordRequired = false;
      const sharing = (await RouteTestingHelper.createSharing(testUser));


      const q: Record<string, string> = {};
      q[QueryParams.gallery.sharingKey_query] = sharing.sharingKey;
      const result = await request.execute(server.Server)
        .get(Config.Server.apiPath + '/user/me?' + QueryParams.gallery.sharingKey_query + '=' + sharing.sharingKey);

      RouteTestingHelper.shouldBeValidUIUser(result, RouteTestingHelper.getExpectedSharingUserForUI(sharing));
    });

    it('it should not authenticate with sharing key without password', async () => {
      Config.Users.authenticationRequired = true;
      Config.Sharing.enabled = true;
      Config.Sharing.passwordRequired = true;
      const sharing = (await RouteTestingHelper.createSharing(testUser, 'pass_secret'));


      const q: Record<string, string> = {};
      q[QueryParams.gallery.sharingKey_query] = sharing.sharingKey;
      const result = await request.execute(server.Server)
        .get(Config.Server.apiPath + '/user/me?' + QueryParams.gallery.sharingKey_query + '=' + sharing.sharingKey);

      result.should.have.status(401);
      result.body.should.be.a('object');
      result.body.error.should.be.a('object');
      should.equal(result.body.error.code, ErrorCodes.NOT_AUTHENTICATED_SHARING);
    });

    it('it should authenticate as guest', async () => {
      Config.Users.authenticationRequired = false;

      const result = await request.execute(server.Server)
        .get(Config.Server.apiPath + '/user/me');

      const expectedGuestUser = {
        name: UserRoles[Config.Users.unAuthenticatedUserRole],
        projectionKey: DBTestHelper.defaultSession.user.projectionKey,
        role: Config.Users.unAuthenticatedUserRole
      } as UserDTO;


      RouteTestingHelper.shouldBeValidUIUser(result, expectedGuestUser);
    });
  });

  describe('/POST user/logout', () => {
    beforeEach(setUp);
    afterEach(tearDown);

    it('it should log out the user', async () => {
      Config.Users.authenticationRequired = true;
      const agent = request.agent(server.Server);
      const csrfRes = await agent.get(Config.Server.apiPath + '/user/me');
      const csrfToken = RouteTestingHelper.getCsrfToken(csrfRes.headers['set-cookie']);
      const loginRes = await agent.post(Config.Server.apiPath + '/user/login')
        .set('X-XSRF-TOKEN', csrfToken)
        .send({loginCredential: {password: testUser.password, username: testUser.name, rememberMe: false} as LoginCredential});
      RouteTestingHelper.shouldBeValidUIUser(loginRes, expectedUser);

      const res = await agent.post(Config.Server.apiPath + '/user/logout')
        .set('X-XSRF-TOKEN', csrfToken);
      res.should.have.status(200);

      const me = await agent.get(Config.Server.apiPath + '/user/me');
      me.should.have.status(401);
      agent.close();
    });

    it('it should log out the sharing user', async () => {
      Config.Users.authenticationRequired = true;
      Config.Sharing.enabled = true;
      Config.Sharing.passwordRequired = false;
      const sharing = (await RouteTestingHelper.createSharing(testUser, 'pass_secret'));
      const agent = request.agent(server.Server);

      const csrfRes = await agent.get(Config.Server.apiPath + '/user/me');
      const csrfToken = RouteTestingHelper.getCsrfToken(csrfRes.headers['set-cookie']);
      const loginRes = await agent.post(Config.Server.apiPath + '/share/login?' + QueryParams.gallery.sharingKey_query + '=' + sharing.sharingKey)
        .set('X-XSRF-TOKEN', csrfToken)
        .send({password: 'pass_secret'});
      RouteTestingHelper.shouldBeValidUIUser(loginRes, RouteTestingHelper.getExpectedSharingUserForUI(sharing));

      const res = await agent.post(Config.Server.apiPath + '/user/logout')
        .set('X-XSRF-TOKEN', csrfToken);
      res.should.have.status(200);

      // password protected sharing needs a new login
      const me = await agent.get(Config.Server.apiPath + '/user/me?' + QueryParams.gallery.sharingKey_query + '=' + sharing.sharingKey);
      me.should.have.status(401);
      should.equal(me.body.error.code, ErrorCodes.NOT_AUTHENTICATED_SHARING);
      agent.close();
    });
  });
});
