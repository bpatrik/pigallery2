import {Config} from '../../../../src/common/config/private/Config';
import {Server} from '../../../../src/backend/server';
import {LoginCredential} from '../../../../src/common/entities/LoginCredential';
import {UserDTO, UserRoles} from '../../../../src/common/entities/UserDTO';
import * as path from 'node:path';
import * as fs from 'node:fs';
import {SQLConnection} from '../../../../src/backend/model/database/SQLConnection';
import {ObjectManagers} from '../../../../src/backend/model/ObjectManagers';
import {Utils} from '../../../../src/common/Utils';
import {SuperAgentStatic} from 'superagent';
import {DatabaseType} from '../../../../src/common/config/private/PrivateConfig';
import {ProjectPath} from '../../../../src/backend/ProjectPath';
import * as chai from "chai";
import {ErrorCodes} from '../../../../src/common/entities/Error';
import {default as chaiHttp, request} from "chai-http";
import {DBTestHelper} from '../../DBTestHelper';
import {TestHelper} from '../../../TestHelper';
import {expectToFail} from '../../KnownFailures';

declare const describe: any;
declare const it: any;
declare const before: any;
declare const after: any;
declare const beforeEach: any;
declare const afterEach: any;

process.env['NODE_ENV'] = 'test';
const should = chai.should();
chai.use(chaiHttp);

describe('UploadRouter', () => {
  before(TestHelper.resetConfig);
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

    it('should keep the accented letters of the file name', async () => {
      const loginRes = await login(server);
      const res = await request.execute(server.Server)
        .post(Config.Server.apiPath + '/upload/Nyaralás')
        .set('Cookie', loginRes.res.headers['set-cookie'])
        .attach('files', Buffer.from('test image 3'), 'Árvíztűrő tükörfúrógép_ő.jpg')
        .attach('files', Buffer.from('test image 4'), 'plain-ascii_name.jpg');

      res.should.have.status(200);
      should.equal(res.body.error, null);
      res.body.result.should.be.an('array').with.lengthOf(0);
      fs.readdirSync(path.join(testDir, 'Nyaralás')).sort()
        .should.deep.equal(['plain-ascii_name.jpg', 'Árvíztűrő tükörfúrógép_ő.jpg'].sort());
    });

    it('should report a file error with the accented file name', async () => {
      const loginRes = await login(server);
      const res = await request.execute(server.Server)
        .post(Config.Server.apiPath + '/upload/')
        .set('Cookie', loginRes.res.headers['set-cookie'])
        .attach('files', Buffer.from('test exe'), 'Hévíz_tó.exe');

      res.should.have.status(200);
      res.body.result.should.be.an('array').with.lengthOf(1);
      // the client matches the errors to its files by this name
      res.body.result[0].filename.should.equal('Hévíz_tó.exe');
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

    it('should reject a file whose name already exists and keep the existing file', async () => {
      const loginRes = await login(server);
      const upload = (content: string) => request.execute(server.Server)
        .post(Config.Server.apiPath + '/upload/clash')
        .set('Cookie', loginRes.res.headers['set-cookie'])
        .attach('files', Buffer.from(content), 'Tihany.jpg')
        .attach('files', Buffer.from('other'), content === 'original' ? 'first.jpg' : 'second.jpg');

      (await upload('original')).body.result.should.have.lengthOf(0);
      const res = await upload('replacement');

      res.should.have.status(200);
      res.body.result.should.be.an('array').with.lengthOf(1);
      res.body.result[0].filename.should.equal('Tihany.jpg');
      res.body.result[0].error.should.contain('already exists');
      fs.readFileSync(path.join(testDir, 'clash', 'Tihany.jpg')).toString().should.equal('original');
      // the other file of the same upload is saved
      fs.existsSync(path.join(testDir, 'clash', 'second.jpg')).should.be.true;
    });

    it('should not let a user below the minimum upload role upload', async () => {
      Config.Upload.minimumRole = UserRoles.Admin;
      await ObjectManagers.getInstance().UserManager.createUser({name: 'uploader', password: 'pass', role: UserRoles.User} as UserDTO);
      const loginRes = await (request.execute(server.Server) as SuperAgentStatic)
        .post(Config.Server.apiPath + '/user/login')
        .send({loginCredential: {username: 'uploader', password: 'pass', rememberMe: false} as LoginCredential});
      const res = await request.execute(server.Server)
        .post(Config.Server.apiPath + '/upload/')
        .set('Cookie', loginRes.headers['set-cookie'] as unknown as string[])
        .attach('files', Buffer.from('test image'), 'not_allowed.jpg');

      res.body.error.code.should.equal(ErrorCodes.NOT_AUTHORISED);
      fs.existsSync(path.join(testDir, 'not_allowed.jpg')).should.be.false;
      // NOT_AUTHORISED goes out as 401 (AuthenticationMWs.authorise, see #1305)
      await expectToFail('#1315', () => res.should.have.status(403), /status code 403 but got 401/);
    });

    it('should reject a file above the size limit with the limit in the message and save the others', async () => {
      (Config.Upload as unknown as Record<string, unknown>)['maxFileSizeMB'] = 1;
      const loginRes = await login(server);
      // there is no upload size limit yet (Upload.maxFileSizeMB)
      const check = async (): Promise<void> => {
        const res = await request.execute(server.Server)
          .post(Config.Server.apiPath + '/upload/size_limit')
          .set('Cookie', loginRes.res.headers['set-cookie'])
          .attach('files', Buffer.alloc(1024 * 1024 + 1), 'too_large.jpg')
          .attach('files', Buffer.from('small'), 'small.jpg');

        res.should.have.status(200);
        res.body.result.should.be.an('array').with.lengthOf(1);
        res.body.result[0].filename.should.equal('too_large.jpg');
        res.body.result[0].error.should.contain('1 MB');
        fs.existsSync(path.join(testDir, 'size_limit', 'too_large.jpg')).should.be.false;
        fs.existsSync(path.join(testDir, 'size_limit', 'small.jpg')).should.be.true;
      };
      try {
        await expectToFail('#1314', check, /expected \[\] to have a length of 1 but got \+?0/);
      } finally {
        delete (Config.Upload as unknown as Record<string, unknown>)['maxFileSizeMB'];
      }
    });

    it('should return 401 if not authenticated', async () => {
      const res = await request.execute(server.Server)
        .post(Config.Server.apiPath + '/upload/')
        .attach('files', Buffer.from('test'), 'test.jpg');

      res.should.have.status(401);
    });
  });
});
