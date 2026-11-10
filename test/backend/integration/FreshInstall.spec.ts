// CUJ 4 (#1254): a fresh install with an empty DB becomes a usable gallery,
// and a new DataStructureVersion rebuilds the DB but keeps the users.
import {Config} from '../../../src/common/config/private/Config';
import {Server} from '../../../src/backend/server';
import * as path from 'node:path';
import * as chai from 'chai';
import {expect} from 'chai';
import {default as chaiHttp, request} from 'chai-http';
import {SuperAgentStatic} from 'superagent';
import {DBTestHelper} from '../DBTestHelper';
import {TestHelper} from '../../TestHelper';
import {ProjectPath} from '../../../src/backend/ProjectPath';
import {SQLConnection} from '../../../src/backend/model/database/SQLConnection';
import {ObjectManagers} from '../../../src/backend/model/ObjectManagers';
import {VersionEntity} from '../../../src/backend/model/database/enitites/VersionEntity';
import {DirectoryEntity} from '../../../src/backend/model/database/enitites/DirectoryEntity';
import {UserEntity} from '../../../src/backend/model/database/enitites/UserEntity';
import {DataStructureVersion} from '../../../src/common/DataStructureVersion';
import {UserDTO, UserRoles} from '../../../src/common/entities/UserDTO';
import {CookieNames} from '../../../src/common/CookieNames';
import {SearchQueryTypes, TextSearch, TextSearchQueryMatchTypes} from '../../../src/common/entities/SearchQueryDTO';

process.env['NODE_ENV'] = 'test';
chai.use(chaiHttp);

// to help WebStorm to handle the test cases
declare let describe: any;
declare const it: any;
const tmpDescribe = describe;
describe = DBTestHelper.describe();

describe('Fresh install', (sqlHelper: DBTestHelper) => {
  before(TestHelper.resetConfig);
  describe = tmpDescribe;

  let server: Server;

  beforeEach(async () => {
    await sqlHelper.initDB();
    Config.Users.authenticationRequired = true;
    Config.Users.suppressDefUserWarn = true;
    Config.Media.folder = path.join(__dirname, '../assets');
    Config.Media.tempFolder = TestHelper.TMP_DIR;
    ProjectPath.reset();
  });

  afterEach(async () => {
    await sqlHelper.clearDB();
  });

  const startServer = async (): Promise<void> => {
    server = new Server(false);
    await server.onStarted.wait();
  };

  /**
   * Logs in and returns the session cookie.
   */
  const login = async (username: string, password: string): Promise<string> => {
    const res = await (request.execute(server.Server) as SuperAgentStatic)
      .post(Config.Server.apiPath + '/user/login')
      .send({loginCredential: {username, password, rememberMe: false}});
    expect(res.status, 'login of ' + username).to.equal(200);
    const cookies = res.headers['set-cookie'] as unknown as string[];
    return cookies.filter(c => c.startsWith(CookieNames.session)).map(c => c.split(';')[0]).join('; ');
  };

  /**
   * The first listing of a folder answers with the disk scan and saves it to the DB in the background.
   * Waits for that save, so the DB (search, counts) has the folder.
   */
  const waitForIndexSave = async (): Promise<void> => {
    const im = ObjectManagers.getInstance().IndexingManager;
    while (im.IsSavingInProgress) {
      await im.SavingReady;
    }
  };

  it('should log in with the default admin, list the folder and search it', async () => {
    await startServer();
    // nothing indexed yet
    const connection = await SQLConnection.getConnection();
    expect(await connection.getRepository(DirectoryEntity).count()).to.equal(0);

    const cookie = await login('admin', 'admin');

    // the first visit lists the folder from the disk and indexes it
    const content = await (request.execute(server.Server) as SuperAgentStatic)
      .get(Config.Server.apiPath + '/gallery/content/')
      .set('Cookie', cookie);
    expect(content.status).to.equal(200);
    expect(content.body.error).to.equal(null);
    expect(JSON.stringify(content.body.result.directory)).to.include('test image öüóőúéáű-.,.jpg');
    expect(content.body.result.directory.directories.length).to.be.greaterThan(0);
    await waitForIndexSave();

    // the indexed photos can be searched
    const query = {type: SearchQueryTypes.file_name, value: 'öüóőúéáű', matchType: TextSearchQueryMatchTypes.like} as TextSearch;
    const search = await (request.execute(server.Server) as SuperAgentStatic)
      .get(Config.Server.apiPath + '/search/' + encodeURIComponent(JSON.stringify(query)))
      .set('Cookie', cookie);
    expect(search.status).to.equal(200);
    expect(search.body.error).to.equal(null);
    expect(JSON.stringify(search.body.result)).to.include('test image öüóőúéáű-.,.jpg');
  });

  it('should rebuild the DB on a new DataStructureVersion and keep the users and their passwords', async () => {
    await startServer();
    await ObjectManagers.getInstance().UserManager.createUser({name: 'kept user', password: 'kept pass', role: UserRoles.User} as UserDTO);
    let cookie = await login('admin', 'admin');
    await (request.execute(server.Server) as SuperAgentStatic)
      .get(Config.Server.apiPath + '/gallery/content/')
      .set('Cookie', cookie);
    await waitForIndexSave();
    let connection = await SQLConnection.getConnection();
    expect(await connection.getRepository(DirectoryEntity).count(), 'indexed before the upgrade').to.be.greaterThan(0);

    // as if the DB was written by an older version of the app
    const version = (await connection.getRepository(VersionEntity).find())[0];
    version.version = DataStructureVersion - 1;
    await connection.getRepository(VersionEntity).save(version);
    await SQLConnection.close();

    // the next start rebuilds it
    connection = await SQLConnection.getConnection();
    expect((await connection.getRepository(VersionEntity).find())[0].version).to.equal(DataStructureVersion);
    expect(await connection.getRepository(DirectoryEntity).count(), 'the index is dropped').to.equal(0);
    const users = (await connection.getRepository(UserEntity).find()).map(u => u.name).sort();
    expect(users).to.deep.equal(['admin', 'kept user']);

    // the kept user can still log in, and the gallery is indexed again
    await startServer();
    cookie = await login('kept user', 'kept pass');
    const content = await (request.execute(server.Server) as SuperAgentStatic)
      .get(Config.Server.apiPath + '/gallery/content/')
      .set('Cookie', cookie);
    expect(content.status).to.equal(200);
    expect(content.body.result.directory.media.length).to.be.greaterThan(0);
  });
});
