import {Config} from '../../../../src/common/config/private/Config';
import {Server} from '../../../../src/backend/server';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as chai from 'chai';
import {expect} from 'chai';
import {default as chaiHttp, request} from 'chai-http';
import AdmZip from 'adm-zip';
import {DBTestHelper} from '../../DBTestHelper';
import {TestHelper} from '../../../TestHelper';
import {ProjectPath} from '../../../../src/backend/ProjectPath';
import {ObjectManagers} from '../../../../src/backend/model/ObjectManagers';
import {UserRoles} from '../../../../src/common/entities/UserDTO';
import {ErrorCodes} from '../../../../src/common/entities/Error';
import {SearchQueryDTO, SearchQueryTypes, TextSearch, TextSearchQueryMatchTypes} from '../../../../src/common/entities/SearchQueryDTO';
import {ContentWrapperUtils, PackedContentWrapper} from '../../../../src/common/entities/ContentWrapper';
import {DefaultsJobs} from '../../../../src/common/entities/job/JobDTO';

process.env['NODE_ENV'] = 'test';
chai.should();
chai.use(chaiHttp);

// to help WebStorm to handle the test cases
declare let describe: any;
declare const it: any;

/**
 * Gallery without authentication (`Users.authenticationRequired = false`, #1254):
 * every visitor gets the `Users.unAuthenticatedUserRole` (default: Admin) without logging in.
 * User management is off; what else the visitor may do follows that role.
 */
const tmpDescribe = describe;
describe = DBTestHelper.describe();

describe('Gallery without authentication', (sqlHelper: DBTestHelper) => {
  before(TestHelper.resetConfig);
  describe = tmpDescribe;

  const assets = path.join(__dirname, '../../assets');
  const DIR = 'Nyílt galéria';
  const FILE = 'árvíztűrő tükör.jpg';
  const SOURCE = path.join(assets, 'exiftool.jpg');

  let server: Server;

  before(async () => {
    await sqlHelper.initDB();
    // initDB removes the tmp folder, so the gallery is created after it
    const folder = path.join(TestHelper.TMP_DIR, 'noauth-gallery');
    fs.mkdirSync(path.join(folder, DIR), {recursive: true});
    fs.copyFileSync(SOURCE, path.join(folder, DIR, FILE));
    fs.copyFileSync(path.join(assets, 'wild-1-small.jpg'), path.join(folder, 'gyökér.jpg'));
    Config.Users.authenticationRequired = false;
    Config.Media.folder = folder;
    Config.Media.tempFolder = path.join(TestHelper.TMP_DIR, 'noauth-temp');
    ProjectPath.reset();
    server = new Server(false);
    await server.onStarted.wait();

    const im = ObjectManagers.getInstance().IndexingManager;
    await im.indexDirectory('.', true);
    await im.indexDirectory(DIR, true);
  });

  after(async () => {
    Config.Users.unAuthenticatedUserRole = UserRoles.Admin;
    await sqlHelper.clearDB();
  });

  interface Response {
    status: number;
    headers: Record<string, string>;
    body: Buffer;
    json: any;
  }

  // a fresh visitor every time: no cookie
  const send = async (method: 'get' | 'post' | 'put' | 'delete', url: string, data?: unknown): Promise<Response> => {
    let req = (request.execute(server.Server) as any)[method](Config.Server.apiPath + url);
    if (data !== undefined) {
      req = req.send(data);
    }
    const res = await req.buffer(true)
      .parse((r: NodeJS.ReadableStream, cb: (err: Error | null, body: Buffer) => void) => {
        const chunks: Buffer[] = [];
        r.on('data', (c: Buffer) => chunks.push(c));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    const json = (res.headers['content-type'] || '').includes('json') ? JSON.parse((res.body as Buffer).toString('utf8')) : null;
    return {status: res.status, headers: res.headers, body: res.body, json};
  };
  const get = (url: string): Promise<Response> => send('get', url);

  const enc = (p: string): string => p.split('/').map(encodeURIComponent).join('/');
  const q = (query: SearchQueryDTO): string => encodeURIComponent(JSON.stringify(query));

  const shouldBeRefused = (res: Response, what: string): void => {
    expect(res.json?.error?.code, what).to.equal(ErrorCodes.NOT_AUTHORISED);
    // 401 today, 403 once #1315 is fixed
    expect(res.status, what).to.be.oneOf([401, 403]);
  };

  const shouldBrowse = (): void => {

    it('should list the folders without logging in', async () => {
      const root = await get('/gallery/content/');
      root.status.should.equal(200);
      expect(root.json.error).to.equal(null);
      const rootCw = ContentWrapperUtils.unpack(root.json.result as PackedContentWrapper);
      expect(rootCw.directory!.directories.map(d => d.name)).to.deep.equal([DIR]);

      const dir = await get('/gallery/content/' + enc(DIR));
      dir.status.should.equal(200);
      const cw = ContentWrapperUtils.unpack(dir.json.result as PackedContentWrapper);
      expect(cw.directory!.media.map(m => m.name)).to.deep.equal([FILE]);
    });

    it('should search', async () => {
      const res = await get('/search/' + q({type: SearchQueryTypes.file_name, value: 'árvíztűrő'} as TextSearch));
      res.status.should.equal(200);
      expect(res.json.error).to.equal(null);
      const cw = ContentWrapperUtils.unpack(res.json.result as PackedContentWrapper);
      expect(cw.searchResult!.media.map(m => m.name)).to.deep.equal([FILE]);
    });

    it('should open the original photo and its thumbnail', async () => {
      const original = await get('/gallery/content/' + enc(DIR + '/' + FILE));
      original.status.should.equal(200);
      expect(original.body.equals(fs.readFileSync(SOURCE)), 'the original file').to.be.true;

      const thumbnail = await get('/gallery/content/' + enc(DIR + '/' + FILE) + '/240');
      thumbnail.status.should.equal(200);
      expect(thumbnail.headers['content-type']).to.contain('image/');
    });

    it('should download a folder as zip', async () => {
      const res = await get('/gallery/zip/' + q({
        type: SearchQueryTypes.directory,
        matchType: TextSearchQueryMatchTypes.exact_match,
        value: './' + DIR
      } as TextSearch));
      res.status.should.equal(200);
      expect(res.headers['content-type']).to.equal('application/zip');
      expect(new AdmZip(res.body).getEntries().map(e => e.entryName)).to.deep.equal([FILE]);
    });

    it('should not offer the login: answers 404 (as "skip login" of UserRouter.spec)', async () => {
      const res = await send('post', '/user/login', {loginCredential: {username: 'admin', password: 'admin', rememberMe: false}});
      res.status.should.equal(404);
      expect(res.headers['set-cookie']).to.equal(undefined);
    });

    it('should not allow user management, not even for an admin visitor', async () => {
      for (const [method, url, data] of [
        ['get', '/user/list', undefined],
        ['put', '/user', {newUser: {name: 'új', password: 'új', role: UserRoles.Admin}}],
        ['delete', '/user/1', undefined],
        ['post', '/user/1/role', {newRole: UserRoles.Admin}],
      ] as ['get' | 'put' | 'delete' | 'post', string, unknown][]) {
        const res = await send(method, url, data);
        const code = res.json?.error?.code;
        // below Admin the role check refuses it first
        expect(code, method + ' ' + url).to.be.oneOf([ErrorCodes.USER_MANAGEMENT_DISABLED, ErrorCodes.NOT_AUTHORISED]);
        if (Config.Users.unAuthenticatedUserRole >= UserRoles.Admin) {
          expect(code, method + ' ' + url).to.equal(ErrorCodes.USER_MANAGEMENT_DISABLED);
        }
      }
      expect(await ObjectManagers.getInstance().UserManager.find({name: 'új'})).to.deep.equal([]);
    });
  };

  describe('as Guest (Users.unAuthenticatedUserRole)', () => {
    before(() => {
      Config.Users.unAuthenticatedUserRole = UserRoles.Guest;
    });

    shouldBrowse();

    it('should give the visitor the Guest role', async () => {
      const res = await get('/user/me');
      res.status.should.equal(200);
      expect(res.json.result.name).to.equal(UserRoles[UserRoles.Guest]);
      expect(res.json.result.role).to.equal(UserRoles.Guest);
    });

    it('should refuse the admin API (settings, jobs, statistics)', async () => {
      shouldBeRefused(await get('/settings'), 'GET settings');
      shouldBeRefused(await send('put', '/settings', {settingsPath: 'Server.applicationTitle', settings: 'feltört'}), 'PUT settings');
      shouldBeRefused(await get('/admin/jobs/available'), 'jobs');
      shouldBeRefused(await send('post', '/admin/jobs/scheduled/' + DefaultsJobs[DefaultsJobs.Indexing] + '/start', {}), 'start job');
      shouldBeRefused(await get('/admin/statistic'), 'statistic');
      expect(Config.Server.applicationTitle).to.not.equal('feltört');
    });

    it('should refuse the admin API to a User role too', async () => {
      Config.Users.unAuthenticatedUserRole = UserRoles.User;
      try {
        shouldBeRefused(await get('/settings'), 'GET settings');
        shouldBeRefused(await get('/admin/jobs/available'), 'jobs');
      } finally {
        Config.Users.unAuthenticatedUserRole = UserRoles.Guest;
      }
    });
  });

  // the default: an open gallery where everybody is admin (e.g. a private home network)
  describe('as Admin (the default Users.unAuthenticatedUserRole)', () => {
    before(() => {
      Config.Users.unAuthenticatedUserRole = UserRoles.Admin;
    });

    shouldBrowse();

    it('should let the visitor use the settings and the jobs', async () => {
      const settings = await get('/settings');
      settings.status.should.equal(200);
      expect(settings.json.error).to.equal(null);
      const jobs = await get('/admin/jobs/available');
      jobs.status.should.equal(200);
      expect(jobs.json.error).to.equal(null);
    });

    // Admin is the intended default, but the admin can lower it to User in the settings ("Default user right")
    it('should let the admin visitor lower the default right to User, which closes the admin API', async () => {
      try {
        const users = (await get('/settings')).json.result.Users;
        expect(users.unAuthenticatedUserRole).to.equal(UserRoles.Admin);
        // the settings page shows the saved config; this test switched the authentication off only in memory, a real install saves it
        const saved = await send('put', '/settings', {
          settingsPath: 'Users', settings: {...users, authenticationRequired: false, unAuthenticatedUserRole: UserRoles.User}
        });
        expect(saved.json.error, 'saving the default user right').to.equal(null);
        expect(Config.Users.unAuthenticatedUserRole).to.equal(UserRoles.User);
        expect(Config.Users.authenticationRequired).to.equal(false);

        // the next visitor is a User: browses, but the admin API is refused
        const me = await get('/user/me');
        expect(me.json.result.role).to.equal(UserRoles.User);
        expect((await get('/gallery/content/')).json.error).to.equal(null);
        shouldBeRefused(await get('/settings'), 'GET settings');
        shouldBeRefused(await get('/admin/jobs/available'), 'jobs');
      } finally {
        Config.Users.authenticationRequired = false;
        Config.Users.unAuthenticatedUserRole = UserRoles.Admin;
      }
    });
  });
});
