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
import {DirectorySearch, SearchQueryTypes, TextSearchQueryMatchTypes} from '../../../../src/common/entities/SearchQueryDTO';

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
    for (const dir of ['sub_dir', 'Árvíztűrő tükörfúrógép', 'clash', 'size_limit', 'no_upload_conf', 'family', 'private']) {
      fs.mkdirSync(path.join(testDir, dir), {recursive: true});
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
    Config.Upload.maxFileSizeMB = 500;
    Config.Upload.minimumRole = UserRoles.Admin;
    Config.Upload.enforcedDirectoryConfig = false;
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
      // accents in the folder and file names on purpose
      const loginRes = await login(server);
      const res = await request.execute(server.Server)
        .post(Config.Server.apiPath + '/upload/Árvíztűrő tükörfúrógép')
        .set('Cookie', loginRes.res.headers['set-cookie'])
        .attach('files', Buffer.from('test image 3'), 'Árvíztűrő tükörfúrógép_ő.jpg')
        .attach('files', Buffer.from('test image 4'), 'plain-ascii_name.jpg');

      res.should.have.status(200);
      should.equal(res.body.error, null);
      res.body.result.should.be.an('array').with.lengthOf(0);
      fs.readdirSync(path.join(testDir, 'Árvíztűrő tükörfúrógép')).sort()
        .should.deep.equal(['plain-ascii_name.jpg', 'Árvíztűrő tükörfúrógép_ő.jpg'].sort());
    });

    it('should report a file error with the accented file name', async () => {
      const loginRes = await login(server);
      const res = await request.execute(server.Server)
        .post(Config.Server.apiPath + '/upload/')
        .set('Cookie', loginRes.res.headers['set-cookie'])
        .attach('files', Buffer.from('test exe'), 'árvíztűrő_ő.exe');

      res.should.have.status(200);
      res.body.result.should.be.an('array').with.lengthOf(1);
      // the client matches the errors to its files by this name
      res.body.result[0].filename.should.equal('árvíztűrő_ő.exe');
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
        .attach('files', Buffer.from(content), 'photo.jpg')
        .attach('files', Buffer.from('other'), content === 'original' ? 'first.jpg' : 'second.jpg');

      (await upload('original')).body.result.should.have.lengthOf(0);
      const res = await upload('replacement');

      res.should.have.status(200);
      res.body.result.should.be.an('array').with.lengthOf(1);
      res.body.result[0].filename.should.equal('photo.jpg');
      res.body.result[0].error.should.contain('already exists');
      fs.readFileSync(path.join(testDir, 'clash', 'photo.jpg')).toString().should.equal('original');
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
      res.should.have.status(403);
    });

    it('should reject a file above the size limit with the limit in the message and save the others', async () => {
      Config.Upload.maxFileSizeMB = 1;
      const loginRes = await login(server);
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
      fs.readFileSync(path.join(testDir, 'size_limit', 'small.jpg')).toString().should.equal('small');
      // the files are written to the temp folder first (not held in RAM): nothing is left there
      fs.readdirSync(path.join(ProjectPath.TempFolder, 'upload')).should.deep.equal([]);
    });

    it('should refuse a folder where uploading is not enabled', async () => {
      Config.Upload.enforcedDirectoryConfig = true;
      const loginRes = await login(server);
      const res = await request.execute(server.Server)
        .post(Config.Server.apiPath + '/upload/no_upload_conf')
        .set('Cookie', loginRes.res.headers['set-cookie'])
        .attach('files', Buffer.from('test image'), 'refused.jpg');

      res.should.have.status(403);
      res.body.error.code.should.equal(ErrorCodes.PERMISSION_DENIED);
      fs.existsSync(path.join(testDir, 'no_upload_conf', 'refused.jpg')).should.be.false;
      fs.readdirSync(path.join(ProjectPath.TempFolder, 'upload')).should.deep.equal([]);
    });

    it('should not create a missing folder', async () => {
      const loginRes = await login(server);
      const res = await request.execute(server.Server)
        .post(Config.Server.apiPath + '/upload/missing/sub')
        .set('Cookie', loginRes.res.headers['set-cookie'])
        .attach('files', Buffer.from('test image'), 'nowhere.jpg');

      res.body.error.code.should.equal(ErrorCodes.DIRECTORY_NOT_FOUND);
      fs.existsSync(path.join(testDir, 'missing')).should.be.false;
      fs.readdirSync(path.join(ProjectPath.TempFolder, 'upload')).should.deep.equal([]);
    });

    it('should not tell the path on the disk if a file already exists', async () => {
      const loginRes = await login(server);
      const upload = () => request.execute(server.Server)
        .post(Config.Server.apiPath + '/upload/sub_dir')
        .set('Cookie', loginRes.res.headers['set-cookie'])
        .attach('files', Buffer.from('test image'), 'twice.jpg');

      await upload();
      const res = await upload();

      res.body.result[0].error.should.contain('already exists');
      res.body.result[0].error.should.not.contain(testDir);
    });

    it('should return 401 if not authenticated', async () => {
      const res = await request.execute(server.Server)
        .post(Config.Server.apiPath + '/upload/')
        .attach('files', Buffer.from('test'), 'test.jpg');

      res.should.have.status(401);
    });
  });

  describe('/POST upload with directory access', () => {
    // can only open the family folder, so the root is only a parent (navigable, content hidden)
    const familyUser = {
      name: 'family', password: 'family', role: UserRoles.User,
      overrideAllowBlockList: true,
      allowDirectoryList: [{type: SearchQueryTypes.directory, value: 'family', matchType: TextSearchQueryMatchTypes.exact_match} as DirectorySearch]
    } as UserDTO;

    beforeEach(async () => {
      Config.Upload.minimumRole = UserRoles.User; // read when the routes are set up
      await setUp();
      await ObjectManagers.getInstance().UserManager.createUser(Utils.clone(familyUser));
    });
    afterEach(tearDown);

    const uploadAsFamily = async (dir: string, filename: string): Promise<any> => {
      const loginRes = await (request.execute(server.Server) as SuperAgentStatic)
        .post(Config.Server.apiPath + '/user/login')
        .send({loginCredential: {username: familyUser.name, password: familyUser.password, rememberMe: false} as LoginCredential});
      return request.execute(server.Server)
        .post(Config.Server.apiPath + '/upload/' + dir)
        .set('Cookie', loginRes.headers['set-cookie'] as unknown as string[])
        .attach('files', Buffer.from('test image'), filename);
    };

    it('should upload to an available folder', async () => {
      const res = await uploadAsFamily('family', 'allowed.jpg');

      res.should.have.status(200);
      should.equal(res.body.error, null);
      fs.existsSync(path.join(testDir, 'family', 'allowed.jpg')).should.be.true;
    });

    it('should answer a hidden folder as not existing', async () => {
      const res = await uploadAsFamily('private', 'hidden.jpg');

      res.body.error.code.should.equal(ErrorCodes.DIRECTORY_NOT_FOUND);
      fs.existsSync(path.join(testDir, 'private', 'hidden.jpg')).should.be.false;
    });

    it('should not upload to a folder that can only be navigated', async () => {
      const res = await uploadAsFamily('', 'parent.jpg');

      res.body.error.code.should.equal(ErrorCodes.DIRECTORY_NOT_FOUND);
      fs.existsSync(path.join(testDir, 'parent.jpg')).should.be.false;
    });
  });
});
