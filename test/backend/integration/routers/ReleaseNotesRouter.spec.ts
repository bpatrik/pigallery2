// Only admins learn the app version: from index.html and the release notes ("What's new" popup).
import * as fs from 'node:fs';
import * as path from 'node:path';
import {DatabaseType} from '../../../../src/common/config/Enums';
import {Config} from '../../../../src/common/config/private/Config';
import {Server} from '../../../../src/backend/server';
import {UserDTO, UserRoles} from '../../../../src/common/entities/UserDTO';
import {ObjectManagers} from '../../../../src/backend/model/ObjectManagers';
import {CookieNames} from '../../../../src/common/CookieNames';
import {ReleaseNotesDTO} from '../../../../src/common/entities/ReleaseNotesDTO';
import {ProjectPath} from '../../../../src/backend/ProjectPath';
import {BuildInfo} from '../../../../src/backend/model/BuildInfo';
import {SuperAgentStatic} from 'superagent';
import {expect} from 'chai';
import * as chai from 'chai';
import {default as chaiHttp, request} from 'chai-http';
import {DBTestHelper} from '../../DBTestHelper';
import {TestHelper} from '../../../TestHelper';

process.env['NODE_ENV'] = 'test';
chai.use(chaiHttp);

describe('ReleaseNotesRouter', () => {
  before(TestHelper.resetConfig);
  const sqlHelper = new DBTestHelper(DatabaseType.sqlite);
  const normalUser = {name: 'normal_user', password: 'password', role: UserRoles.User};
  let server: Server;

  beforeEach(async () => {
    Config.Users.authenticationRequired = true;
    // the DB init creates the default admin (admin/admin)
    await sqlHelper.initDB();
    server = new Server(false);
    await server.onStarted.wait();
    await ObjectManagers.getInstance().UserManager.createUser({...normalUser} as UserDTO);
  });

  afterEach(async () => {
    await sqlHelper.clearDB();
  });

  const agent = (): SuperAgentStatic => request.execute(server.Server) as SuperAgentStatic;

  const login = async (username: string, password: string): Promise<string> => {
    const res = await agent()
      .post(Config.Server.apiPath + '/user/login')
      .send({loginCredential: {username, password, rememberMe: false}});
    expect(res.status, 'login of ' + username).to.equal(200);
    const cookies = res.headers['set-cookie'] as unknown as string[];
    return cookies.filter(c => c.startsWith(CookieNames.session)).map(c => c.split(';')[0]).join('; ');
  };

  const getReleaseNotes = async (cookie: string): Promise<{ status: number, result: ReleaseNotesDTO }> => {
    const res = await agent().get(Config.Server.apiPath + '/admin/release-notes').set('Cookie', cookie);
    return {status: res.status, result: res.body.result};
  };

  const injectedBuildInfo = (html: string): unknown => {
    const match = html.match(/buildInfo: (null|\{[^}]*\})/);
    expect(match, 'buildInfo in index.html').to.not.equal(null);
    return JSON.parse(match![1]);
  };

  const expectNoVersion = (html: string): void => {
    const at = html.indexOf(Config.Environment.appVersion!);
    expect(at, 'the version in: ...' + html.substring(at - 200, at + 50) + '...').to.equal(-1);
  };

  describe('/GET admin/release-notes', () => {

    it('should give the build info and the release notes to an admin', async () => {
      const {status, result} = await getReleaseNotes(await login('admin', 'admin'));
      expect(status).to.equal(200);
      expect(result.build.appVersion).to.be.a('string').and.to.equal(Config.Environment.appVersion);
      // the tests run in a git checkout: without a commit in package.json, git tells it
      expect(result.build.buildCommitHash).to.match(/^[0-9a-f]{40}$/);
      expect(result.notes).to.equal(fs.readFileSync(path.join(ProjectPath.Root, 'RELEASE_NOTES.md'), 'utf-8'));
      expect(result.seenVersion).to.equal(null);
    });

    it('should not give the version to a normal user', async () => {
      const cookie = await login(normalUser.name, normalUser.password);
      const {status, result} = await getReleaseNotes(cookie);
      expect(status).to.equal(403);
      expect(result ?? null).to.equal(null);
      const res = await agent().post(Config.Server.apiPath + '/admin/release-notes/seen').set('Cookie', cookie);
      expect(res.status).to.equal(403);
    });

    it('should not give the version without login', async () => {
      const res = await agent().get(Config.Server.apiPath + '/admin/release-notes');
      expect(res.status).to.equal(401);
    });
  });

  describe('/POST admin/release-notes/seen', () => {

    it('should save the running version as seen, without ending the session', async () => {
      const cookie = await login('admin', 'admin');
      const res = await agent().post(Config.Server.apiPath + '/admin/release-notes/seen').set('Cookie', cookie);
      expect(res.status).to.equal(200);
      // the session stamp is computed again from the user row
      ObjectManagers.getInstance().SessionManager.invalidateSessionCache();
      const {status, result} = await getReleaseNotes(cookie);
      expect(status, 'the session of the admin is still valid').to.equal(200);
      expect(result.seenVersion).to.equal(Config.Environment.appVersion);
    });
  });

  describe('index.html', () => {

    it('should inject the build info for an admin', async () => {
      const cookie = await login('admin', 'admin');
      const res = await agent().get('/about').set('Cookie', cookie);
      expect(res.status).to.equal(200);
      expect(injectedBuildInfo(res.text)).to.deep.equal(BuildInfo.get());
    });

    it('should not inject the build info for a normal user', async () => {
      const cookie = await login(normalUser.name, normalUser.password);
      const res = await agent().get('/about').set('Cookie', cookie);
      expect(res.status).to.equal(200);
      expect(injectedBuildInfo(res.text)).to.equal(null);
      expectNoVersion(res.text);
    });

    it('should not inject the build info without login', async () => {
      const res = await agent().get('/login');
      expect(res.status).to.equal(200);
      expect(injectedBuildInfo(res.text)).to.equal(null);
      expectNoVersion(res.text);
    });
  });
});
