import {Config} from '../../../../src/common/config/private/Config';
import {Server} from '../../../../src/backend/server';
import {LoginCredential} from '../../../../src/common/entities/LoginCredential';
import {UserDTO, UserRoles} from '../../../../src/common/entities/UserDTO';
import * as path from 'path';
import * as fs from 'fs';
import {SQLConnection} from '../../../../src/backend/model/database/SQLConnection';
import {ObjectManagers} from '../../../../src/backend/model/ObjectManagers';
import {Utils} from '../../../../src/common/Utils';
import {SuperAgentStatic} from 'superagent';
import {RouteTestingHelper} from './RouteTestingHelper';
import {QueryParams} from '../../../../src/common/QueryParams';
import {ErrorCodes} from '../../../../src/common/entities/Error';
import {DatabaseType} from '../../../../src/common/config/private/PrivateConfig';
import {ProjectPath} from '../../../../src/backend/ProjectPath';


process.env.NODE_ENV = 'test';
const chai: any = require('chai');
const chaiHttp = require('chai-http');
const should = chai.should();
chai.use(chaiHttp);

describe('SharingRouter', () => {

  const testUser: UserDTO = {
    id: 1,
    name: 'test',
    password: 'test',
    role: UserRoles.User,
    permissions: null
  };
  const {password: pass, ...expectedUser} = testUser;
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

  const shouldBeValidUser = (result: any, user: any) => {

    result.should.have.status(200);
    result.body.should.be.a('object');
    should.equal(result.body.error, null);
    result.body.result.csrfToken.should.be.a('string');
    const {csrfToken, ...u} = result.body.result;
    u.should.deep.equal(user);
  };

  const shareLogin = async (srv: Server, sharingKey: string, password?: string): Promise<any> => {
    return (chai.request(srv.Server) as SuperAgentStatic)
      .post(Config.Server.apiPath + '/share/login?' + QueryParams.gallery.sharingKey_query + '=' + sharingKey)
      .send({password});

  };


  describe('/POST share/login', () => {

    beforeEach(setUp);
    afterEach(tearDown);

    it('should login with passworded share when password required', async () => {
      Config.Sharing.passwordRequired = true;
      const sharing = await RouteTestingHelper.createSharing(testUser, 'secret_pass');
      const res = await shareLogin(server, sharing.sharingKey, sharing.password);
      shouldBeValidUser(res, RouteTestingHelper.getExpectedSharingUser(sharing));
    });

    it('should login with passworded share when password not required', async () => {
      Config.Sharing.passwordRequired = false;
      const sharing = await RouteTestingHelper.createSharing(testUser, 'secret_pass');
      const res = await shareLogin(server, sharing.sharingKey, sharing.password);
      shouldBeValidUser(res, RouteTestingHelper.getExpectedSharingUser(sharing));
    });


    it('should login without passworded share when password not required', async () => {
      Config.Sharing.passwordRequired = false;
      const sharing = await RouteTestingHelper.createSharing(testUser );
      const res = await shareLogin(server, sharing.sharingKey, sharing.password);
      shouldBeValidUser(res, RouteTestingHelper.getExpectedSharingUser(sharing));
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
