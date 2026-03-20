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
import {DatabaseType} from '../../../../src/common/config/private/PrivateConfig';
import {ProjectPath} from '../../../../src/backend/ProjectPath';
import * as chai from "chai";
import {default as chaiHttp, request} from "chai-http";
import {DBTestHelper} from '../../DBTestHelper';

declare const describe: any;
declare const it: any;
declare const before: any;
declare const after: any;
declare const beforeEach: any;
declare const afterEach: any;

process.env.NODE_ENV = 'test';
const should = chai.should();
chai.use(chaiHttp);

describe('UploadRouter', () => {
  const sqlHelper = new DBTestHelper(DatabaseType.sqlite);
  const testDir = path.join(__dirname, 'tmp_upload');

  const adminUser: UserDTO = {
    id: 1,
    name: 'admin',
    password: 'admin',
    role: UserRoles.Admin
  };

  let server: Server;

  before(async () => {
    Config.Upload.enabled = true;
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, {recursive: true});
    }
    Config.Media.folder = testDir;
    ProjectPath.reset();
  });

  after(async () => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, {recursive: true, force: true});
    }
  });

  const setUp = async () => {
    Config.Upload.enabled = true;
    await sqlHelper.initDB();
    server = new Server(false);
    await server.onStarted.wait();
    await ObjectManagers.getInstance().init();
    Config.Upload.enabled = true; // Set it again after init
    await ObjectManagers.getInstance().UserManager.createUser(Utils.clone(adminUser));
    await SQLConnection.close();
  };

  const tearDown = async () => {
    await sqlHelper.clearDB();
  };

  const login = async (srv: Server): Promise<any> => {
    return await (request.execute(srv.Server) as SuperAgentStatic)
      .post(Config.Server.apiPath + '/user/login')
      .send({
        loginCredential: {
          password: adminUser.password,
          username: adminUser.name,
          rememberMe: false
        } as LoginCredential
      });
  };

  describe('/POST upload', () => {
    beforeEach(setUp);
    afterEach(tearDown);

    it('should upload a file', async () => {
      const loginRes = await login(server);
      const res = await request.execute(server.Server)
        .post(Config.Server.apiPath + '/upload/')
        .set('Cookie', loginRes.res.headers['set-cookie'])
        .attach('files', Buffer.from('test image'), 'test.jpg');

      if (res.body.error) {
        console.error(res.body.error);
      }
      res.should.have.status(200);
      should.equal(res.body.error, null);
      res.body.should.have.property('result');
      res.body.result.should.be.an('array').with.lengthOf(0); // No errors

      const savedPath = path.join(testDir, 'test.jpg');
      fs.existsSync(savedPath).should.be.true;
    });

    it('should upload a file to a sub-directory', async () => {
      const loginRes = await login(server);
      const res = await request.execute(server.Server)
        .post(Config.Server.apiPath + '/upload/sub_dir')
        .set('Cookie', loginRes.res.headers['set-cookie'])
        .attach('files', Buffer.from('test image 2'), 'test2.jpg');

      res.should.have.status(200);
      should.equal(res.body.error, null);
      const savedPath = path.join(testDir, 'sub_dir', 'test2.jpg');
      fs.existsSync(savedPath).should.be.true;
    });

    it('should return error for unsupported file', async () => {
      const loginRes = await login(server);
      const res = await request.execute(server.Server)
        .post(Config.Server.apiPath + '/upload/')
        .set('Cookie', loginRes.res.headers['set-cookie'])
        .attach('files', Buffer.from('test exe'), 'test.exe');

      res.should.have.status(200); // Middleware returns success, but result contains errors
      should.equal(res.body.error, null);
      res.body.result.should.be.an('array').with.lengthOf(1);
      res.body.result[0].should.have.property('error').which.contains('Unsupported file format');
    });

    it('should return 401 if not authenticated', async () => {
      const res = await request.execute(server.Server)
        .post(Config.Server.apiPath + '/upload/')
        .attach('files', Buffer.from('test'), 'test.jpg');

      res.should.have.status(401);
    });
  });
});
