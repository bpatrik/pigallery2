import {Config} from '../../../../src/common/config/private/Config';
import {Server} from '../../../../src/backend/server';
import {UserDTO, UserRoles} from '../../../../src/common/entities/UserDTO';
import * as path from 'node:path';
import * as fs from 'node:fs';
import {SQLConnection} from '../../../../src/backend/model/database/SQLConnection';
import {ObjectManagers} from '../../../../src/backend/model/ObjectManagers';
import {Utils} from '../../../../src/common/Utils';
import {SuperAgentStatic} from 'superagent';
import {RouteTestingHelper} from './RouteTestingHelper';
import {QueryParams} from '../../../../src/common/QueryParams';
import {ErrorCodes} from '../../../../src/common/entities/Error';
import {DatabaseType} from '../../../../src/common/config/private/PrivateConfig';
import {ProjectPath} from '../../../../src/backend/ProjectPath';
import * as chai from "chai";
import {default as chaiHttp, request} from "chai-http";
import chaiAsPromised from 'chai-as-promised';
import {TestHelper} from '../../../TestHelper';
import {expectToFail} from '../../KnownFailures';

process.env['NODE_ENV'] = 'test';
const should = chai.should();
chai.use(chaiHttp);
chai.use(chaiAsPromised);

describe('SharingRouter', () => {
  before(TestHelper.resetConfig);

  const testUser: UserDTO = {
    id: 1,
    name: 'test',
    password: 'test',
    role: UserRoles.User
  };
  const tempDir = path.join(__dirname, '../../tmp');
  let server: Server;
  const setUp = async () => {
    await fs.promises.rm(tempDir, {recursive: true, force: true});
    Config.Users.authenticationRequired = true;
    Config.Sharing.enabled = true;
    Config.Database.type = DatabaseType.sqlite;
    Config.Database.dbFolder = tempDir;
    ProjectPath.reset();

    server = new Server(false);
    await server.onStarted.wait();

    await ObjectManagers.getInstance().init();
    await ObjectManagers.getInstance().UserManager.createUser(Utils.clone(testUser));
    await SQLConnection.close();
  };
  const tearDown = async () => {
    await ObjectManagers.reset();
    await fs.promises.rm(tempDir, {recursive: true, force: true});
  };


  const shareLogin = async (srv: Server, sharingKey: string, password?: string | null): Promise<any> => {
    return (request.execute(srv.Server) as SuperAgentStatic)
      .post(Config.Server.apiPath + '/share/login?' + QueryParams.gallery.sharingKey_query + '=' + sharingKey)
      .send({password});

  };


  describe('/GET share/:sharingKey/publicInfo', () => {

    beforeEach(setUp);
    afterEach(tearDown);

    const getPublicInfo = async (sharingKey: string): Promise<any> => {
      return (request.execute(server.Server) as SuperAgentStatic)
        .get(Config.Server.apiPath + '/share/' + sharingKey + '/publicInfo');
    };

    it('should return the public info of an existing sharing', async () => {
      Config.Sharing.passwordRequired = false;
      const sharing = await RouteTestingHelper.createSharing(testUser, 'secret_pass');
      const res = await getPublicInfo(sharing.sharingKey);

      res.should.have.status(200);
      should.equal(res.body.error, null);
      res.body.result.should.deep.equal({sharingKey: sharing.sharingKey, passwordProtected: true});
    });

    it('should return 404 for a not existing sharing', async () => {
      const res = await getPublicInfo('doesnotexist');

      res.should.have.status(404);
      res.body.error.code.should.equal(ErrorCodes.SHARING_NOT_FOUND);
      should.equal(res.body.result, null);
    });
  });

  describe('expired sharing', () => {

    beforeEach(setUp);
    afterEach(tearDown);

    const expired = () => Date.now() - 1000;

    // an expired sharing looks like a not existing one (#1307)
    it('should not give the public info of an expired sharing', async () => {
      Config.Sharing.passwordRequired = false;
      const sharing = await RouteTestingHelper.createSharing(testUser, null, expired());
      // publicInfo does not check the expiry yet
      await expectToFail('#1307', async () => {
        const res = await (request.execute(server.Server) as SuperAgentStatic)
          .get(Config.Server.apiPath + '/share/' + sharing.sharingKey + '/publicInfo');

        res.should.have.status(404);
        res.body.error.should.be.a('object');
        should.equal(res.body.result, null);
      }, /status code 404/);
    });

    it('should not login to an expired sharing', async () => {
      Config.Sharing.passwordRequired = false;
      const sharing = await RouteTestingHelper.createSharing(testUser, 'secret_pass', expired());
      const res = await shareLogin(server, sharing.sharingKey, 'secret_pass');

      res.should.have.status(401);
      should.equal(res.body.error.code, ErrorCodes.CREDENTIAL_NOT_FOUND);
      should.not.exist(res.headers['set-cookie']);
    });

    it('should not let a guest in with the key of an expired sharing without password', async () => {
      Config.Sharing.passwordRequired = false;
      const sharing = await RouteTestingHelper.createSharing(testUser, null, expired());
      const res = await (request.execute(server.Server) as SuperAgentStatic)
        .get(Config.Server.apiPath + '/gallery/content/?' + QueryParams.gallery.sharingKey_query + '=' + sharing.sharingKey);

      res.should.have.status(401);
      should.equal(res.body.error.code, ErrorCodes.NOT_AUTHENTICATED_SHARING);
    });
  });

  describe('/DELETE share/:sharingKey', () => {

    beforeEach(setUp);
    afterEach(tearDown);

    it('should end the session of a guest of the deleted sharing', async () => {
      Config.Sharing.passwordRequired = false;
      const sharing = await RouteTestingHelper.createSharing(testUser, 'secret_pass', Date.now() + 100000);
      const guest = request.agent(server.Server);
      const owner = request.agent(server.Server);
      try {
        const login = await guest.post(Config.Server.apiPath + '/share/login?' + QueryParams.gallery.sharingKey_query + '=' + sharing.sharingKey)
          .send({password: 'secret_pass'});
        login.should.have.status(200);
        (await guest.get(Config.Server.apiPath + '/user/me')).should.have.status(200);

        (await owner.post(Config.Server.apiPath + '/user/login')
          .send({loginCredential: {username: testUser.name, password: testUser.password, rememberMe: false}})).should.have.status(200);
        const del = await owner.delete(Config.Server.apiPath + '/share/' + sharing.sharingKey);
        del.should.have.status(200);
        should.equal(del.body.error, null);

        // the next request of the guest is rejected, its session is gone
        const me = await guest.get(Config.Server.apiPath + '/user/me');
        me.should.have.status(401);
        const content = await guest.get(Config.Server.apiPath + '/gallery/content/');
        content.should.have.status(401);
      } finally {
        guest.close();
        owner.close();
      }
    });
  });

  describe('/POST share/login', () => {

    beforeEach(setUp);
    afterEach(tearDown);

    it('should login with passworded share when password required', async () => {
      Config.Sharing.passwordRequired = true;
      const sharing = await RouteTestingHelper.createSharing(testUser, 'secret_pass');
      const res = await shareLogin(server, sharing.sharingKey, sharing.password);
      RouteTestingHelper.shouldBeValidUIUser(res, RouteTestingHelper.getExpectedSharingUserForUI(sharing));
    });

    it('should login with passworded share when password not required', async () => {
      Config.Sharing.passwordRequired = false;
      const sharing = await RouteTestingHelper.createSharing(testUser, 'secret_pass');
      const res = await shareLogin(server, sharing.sharingKey, sharing.password);
      RouteTestingHelper.shouldBeValidUIUser(res, RouteTestingHelper.getExpectedSharingUserForUI(sharing));
    });


    it('should login without passworded share when password not required', async () => {
      Config.Sharing.passwordRequired = false;
      const sharing = await RouteTestingHelper.createSharing(testUser );
      const res = await shareLogin(server, sharing.sharingKey, sharing.password);
      RouteTestingHelper.shouldBeValidUIUser(res, RouteTestingHelper.getExpectedSharingUserForUI(sharing));
    });



    it('should not login with passworded share without password', async () => {
      Config.Sharing.passwordRequired = true;
      const sharing = await RouteTestingHelper.createSharing(testUser, 'secret_pass');
      const result = await shareLogin(server, sharing.sharingKey);

      result.should.have.status(401);
      result.body.should.be.a('object');
      result.body.error.should.be.a('object');
      should.equal(result.body.error.code, ErrorCodes.CREDENTIAL_NOT_FOUND);
    });


    it('should not login to share without password  when password required', async () => {
      Config.Sharing.passwordRequired = false;
      const sharing = await RouteTestingHelper.createSharing(testUser);
      Config.Sharing.passwordRequired = true;
      const result = await shareLogin(server, sharing.sharingKey);

      result.should.have.status(401);
      result.body.should.be.a('object');
      result.body.error.should.be.a('object');
      should.equal(result.body.error.code, ErrorCodes.CREDENTIAL_NOT_FOUND);
    });




  });


});
