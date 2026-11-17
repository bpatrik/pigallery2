import {Config} from '../../../../src/common/config/private/Config';
import {Server} from '../../../../src/backend/server';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as chai from 'chai';
import {expect} from 'chai';
import {default as chaiHttp, request} from 'chai-http';
import {DBTestHelper} from '../../DBTestHelper';
import {TestHelper} from '../../../TestHelper';
import {ProjectPath} from '../../../../src/backend/ProjectPath';
import {ObjectManagers} from '../../../../src/backend/model/ObjectManagers';
import {UserDTO, UserRoles} from '../../../../src/common/entities/UserDTO';
import {ErrorCodes} from '../../../../src/common/entities/Error';
import {Utils} from '../../../../src/common/Utils';
import {SearchQueryTypes, TextSearch} from '../../../../src/common/entities/SearchQueryDTO';
import {SQLConnection} from '../../../../src/backend/model/database/SQLConnection';
import {AlbumBaseEntity} from '../../../../src/backend/model/database/enitites/album/AlbumBaseEntity';

process.env['NODE_ENV'] = 'test';
chai.should();
chai.use(chaiHttp);

// to help WebStorm to handle the test cases
declare let describe: any;
declare const it: any;

/**
 * Who may create and delete albums (Album.writeAccessMinRole, #557).
 */
const tmpDescribe = describe;
describe = DBTestHelper.describe();

describe('AlbumRouter', (sqlHelper: DBTestHelper) => {
  before(TestHelper.resetConfig);
  describe = tmpDescribe;

  type TestUser = Omit<UserDTO, 'id'>;
  const user: TestUser = {name: 'User', password: 'user', role: UserRoles.User};
  const admin: TestUser = {name: 'admin-test', password: 'admin-test', role: UserRoles.Admin};
  const guest: TestUser = {name: 'Guest', password: 'guest', role: UserRoles.Guest};

  const query: TextSearch = {value: 'árvíz', type: SearchQueryTypes.any_text};

  let server: Server;
  let agents: Record<string, ReturnType<typeof request.agent>> = {};

  // the route reads Album.writeAccessMinRole when it is registered, so it is set before the server starts
  const setUp = async (writeAccessMinRole: UserRoles, readAccessMinRole = UserRoles.User): Promise<void> => {
    await sqlHelper.initDB();
    const galleryFolder = path.join(TestHelper.TMP_DIR, 'album-gallery');
    fs.mkdirSync(galleryFolder, {recursive: true});
    fs.copyFileSync(path.join(__dirname, '../../assets/wild-1-small.jpg'), path.join(galleryFolder, 'photo.jpg'));
    Config.Users.authenticationRequired = true;
    Config.Album.readAccessMinRole = readAccessMinRole;
    Config.Album.writeAccessMinRole = writeAccessMinRole;
    Config.Media.folder = galleryFolder;
    Config.Media.tempFolder = path.join(TestHelper.TMP_DIR, 'album-temp');
    ProjectPath.reset();
    server = new Server(false);
    await server.onStarted.wait();

    const om = ObjectManagers.getInstance();
    await om.IndexingManager.indexDirectory('.', true);
    agents = {};
    for (const u of [user, admin, guest]) {
      await om.UserManager.createUser(Utils.clone(u) as UserDTO);
      const agent = request.agent(server.Server);
      const res = await agent.post(Config.Server.apiPath + '/user/login')
        .send({loginCredential: {username: u.name, password: u.password, rememberMe: false}});
      res.should.have.status(200);
      agents[u.name] = agent;
    }
  };

  const tearDown = async (): Promise<void> => {
    Object.values(agents).forEach(a => a.close());
    await sqlHelper.clearDB();
    TestHelper.resetConfig();
  };

  const api = (p: string): string => Config.Server.apiPath + p;
  const as = (u: TestUser) => agents[u.name];

  const save = (u: TestUser, name: string, searchQuery: unknown): Promise<any> =>
    as(u).put(api('/albums/saved-searches')).send({name, searchQuery});

  const albumNames = async (): Promise<string[]> =>
    (await (await SQLConnection.getConnection()).getRepository(AlbumBaseEntity).find()).map(a => a.name).sort();

  const shouldBeRefused = (res: any, what: string): void => {
    expect(res.body.error?.code, what).to.equal(ErrorCodes.NOT_AUTHORISED);
    expect(res.status, what).to.be.oneOf([401, 403]);
  };

  describe('with the default (Admin) write right', () => {
    beforeEach(() => setUp(Config.Album.writeAccessMinRole));
    afterEach(tearDown);

    it('should be Admin by default', () => {
      expect(Config.Album.writeAccessMinRole).to.equal(UserRoles.Admin);
    });

    it('should let only an Admin create and delete albums', async () => {
      shouldBeRefused(await save(user, 'By user', query), 'user');
      (await save(admin, 'By admin', query)).should.have.status(200);
      expect(await albumNames()).to.deep.equal(['By admin']);

      shouldBeRefused(await as(user).delete(api('/albums/1')), 'user');
      expect(await albumNames()).to.deep.equal(['By admin']);
      (await as(admin).delete(api('/albums/1'))).should.have.status(200);
      expect(await albumNames()).to.deep.equal([]);
    });
  });

  describe('with Admin read right', () => {
    beforeEach(() => setUp(UserRoles.Admin, UserRoles.Admin));
    afterEach(tearDown);

    it('should list the albums only to an Admin', async () => {
      shouldBeRefused(await as(user).get(api('/albums')), 'user');
      const res = await as(admin).get(api('/albums'));
      res.should.have.status(200);
      expect(res.body.error).to.equal(null);
    });
  });

  describe('with User write right', () => {
    beforeEach(() => setUp(UserRoles.User));
    afterEach(tearDown);

    it('should let a User create and delete albums, but not a Guest', async () => {
      shouldBeRefused(await save(guest, 'By guest', query), 'guest');
      (await save(user, 'Tükörfúrógép', query)).should.have.status(200);
      expect(await albumNames()).to.deep.equal(['Tükörfúrógép']);

      shouldBeRefused(await as(guest).delete(api('/albums/1')), 'guest');
      (await as(user).delete(api('/albums/1'))).should.have.status(200);
      expect(await albumNames()).to.deep.equal([]);
    });

    it('should not save an album with an invalid search query', async () => {
      for (const bad of [{type: 999}, {type: SearchQueryTypes.any_text}, null, 'text']) {
        const res = await save(user, 'Broken', bad);
        expect(res.body.error?.code, JSON.stringify(bad)).to.equal(ErrorCodes.INPUT_ERROR);
      }
      expect((await save(user, '', query)).body.error?.code).to.equal(ErrorCodes.INPUT_ERROR);
      expect(await albumNames()).to.deep.equal([]);
    });
  });
});
