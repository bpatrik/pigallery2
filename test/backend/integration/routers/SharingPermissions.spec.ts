import {Config} from '../../../../src/common/config/private/Config';
import {Server} from '../../../../src/backend/server';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as chai from 'chai';
import {expect} from 'chai';
import chaiAsPromised from 'chai-as-promised';
import {default as chaiHttp, request} from 'chai-http';
import {DBTestHelper} from '../../DBTestHelper';
import {TestHelper} from '../../../TestHelper';
import {ProjectPath} from '../../../../src/backend/ProjectPath';
import {ObjectManagers} from '../../../../src/backend/model/ObjectManagers';
import {UserDTO, UserRoles} from '../../../../src/common/entities/UserDTO';
import {ErrorCodes} from '../../../../src/common/entities/Error';
import {ResponseSharingDTO} from '../../../../src/common/entities/SharingDTO';
import {QueryParams} from '../../../../src/common/QueryParams';
import {Utils} from '../../../../src/common/Utils';
import {ContentWrapperUtils, PackedContentWrapper} from '../../../../src/common/entities/ContentWrapper';

process.env['NODE_ENV'] = 'test';
chai.should();
chai.use(chaiHttp);
chai.use(chaiAsPromised);

// to help WebStorm to handle the test cases
declare let describe: any;
declare const it: any;

/**
 * Sharing permissions and editing (#1307, CUJ 29–31): who may create a sharing, whose sharings a user may list,
 * update and delete, and what an update changes.
 * And a shared folder that is renamed or removed on disk (#1307): the sharing stays valid, its listing answers
 * "directory not found" (#1308).
 */
const tmpDescribe = describe;
describe = DBTestHelper.describe();

describe('Sharing permissions', (sqlHelper: DBTestHelper) => {
  before(TestHelper.resetConfig);
  describe = tmpDescribe;

  // accented on purpose: sharing a folder with a non-ASCII name
  const SHARED = 'Shared Árvíztűrő tükörfúrógép';
  const OTHER = 'Other folder';
  const PHOTO = 'photo.jpg';

  type TestUser = Omit<UserDTO, 'id'>;
  const owner: TestUser = {name: 'Owner', password: 'owner', role: UserRoles.User};
  const other: TestUser = {name: 'Other user', password: 'other', role: UserRoles.User};
  const admin: TestUser = {name: 'admin-test', password: 'admin-test', role: UserRoles.Admin};
  const guest: TestUser = {name: 'Guest', password: 'guest', role: UserRoles.Guest};

  let galleryFolder: string;
  let server: Server;
  let agents: Record<string, ReturnType<typeof request.agent>> = {};

  const setUp = async (): Promise<void> => {
    await sqlHelper.initDB();
    // initDB removes the tmp folder, so the gallery is created after it
    galleryFolder = path.join(TestHelper.TMP_DIR, 'sharing-gallery');
    for (const dir of [SHARED, OTHER]) {
      fs.mkdirSync(path.join(galleryFolder, dir), {recursive: true});
      fs.copyFileSync(path.join(__dirname, '../../assets/wild-1-small.jpg'), path.join(galleryFolder, dir, PHOTO));
    }
    Config.Users.authenticationRequired = true;
    Config.Sharing.enabled = true;
    Config.Sharing.passwordRequired = false;
    Config.Media.folder = galleryFolder;
    Config.Media.tempFolder = path.join(TestHelper.TMP_DIR, 'sharing-temp');
    ProjectPath.reset();
    server = new Server(false);
    await server.onStarted.wait();

    const om = ObjectManagers.getInstance();
    await om.IndexingManager.indexDirectory('.', true);
    await om.IndexingManager.indexDirectory(SHARED, true);
    await om.IndexingManager.indexDirectory(OTHER, true);
    agents = {};
    for (const user of [owner, other, admin, guest]) {
      await om.UserManager.createUser(Utils.clone(user) as UserDTO);
      const agent = request.agent(server.Server);
      const res = await agent.post(Config.Server.apiPath + '/user/login')
        .send({loginCredential: {username: user.name, password: user.password, rememberMe: false}});
      res.should.have.status(200);
      agents[user.name] = agent;
    }
  };

  const tearDown = async (): Promise<void> => {
    Object.values(agents).forEach(a => a.close());
    await sqlHelper.clearDB();
    // the next initDB() would create the temp folder of this one
    TestHelper.resetConfig();
  };

  const api = (p: string): string => Config.Server.apiPath + p;
  const as = (user: TestUser) => agents[user.name];

  const create = (user: TestUser, dir: string, password: string | null = null, valid = 60 * 60 * 1000): Promise<any> =>
    as(user).post(api('/share/' + encodeURIComponent(dir)))
      .send({createSharing: {password, valid}});

  const createOk = async (user: TestUser, dir: string, password: string | null = null): Promise<ResponseSharingDTO> => {
    const res = await create(user, dir, password);
    res.should.have.status(200);
    expect(res.body.error, user.name).to.equal(null);
    expect(res.body.result.sharingKey).to.be.a('string');
    return res.body.result as ResponseSharingDTO;
  };

  const update = (user: TestUser, dir: string, id: number, password: string | null, valid: number): Promise<any> =>
    as(user).put(api('/share/' + encodeURIComponent(dir)))
      .send({updateSharing: {id, password, valid}});

  const listForDir = async (user: TestUser, sharing: ResponseSharingDTO): Promise<string[]> => {
    const res = await as(user).get(api('/share/list/' + encodeURIComponent(JSON.stringify(sharing.directoryQuery))));
    res.should.have.status(200);
    expect(res.body.error).to.equal(null);
    return (res.body.result as ResponseSharingDTO[]).map(s => s.sharingKey).sort();
  };

  const sharingKeys = async (): Promise<string[]> =>
    (await ObjectManagers.getInstance().SharingManager.listAll()).map(s => s.sharingKey).sort();

  const shareLogin = (agent: ReturnType<typeof request.agent>, sharingKey: string, password: string | null): Promise<any> =>
    agent.post(api('/share/login?' + QueryParams.gallery.sharingKey_query + '=' + sharingKey)).send({password});

  const shouldBeRefused = (res: any, what: string): void => {
    expect(res.body.error?.code, what).to.equal(ErrorCodes.NOT_AUTHORISED);
    // 401 today, 403 once #1315 is fixed
    expect(res.status, what).to.be.oneOf([401, 403]);
  };

  describe('creating a sharing', () => {
    beforeEach(setUp);
    afterEach(tearDown);

    it('should let a User and an Admin share a folder with a non-ASCII name', async () => {
      const s = await createOk(owner, SHARED);
      expect(s.directoryQuery!.value).to.equal(SHARED);
      expect(s.passwordProtected).to.be.false;
      expect((s as any).password, 'the password never goes out').to.equal(undefined);
      expect((s as any).creator, 'the creator never goes out').to.equal(undefined);
      await createOk(admin, SHARED);
      expect((await sharingKeys()).length).to.equal(2);
    });

    it('should not let a Guest share (the minimum role is User)', async () => {
      shouldBeRefused(await create(guest, SHARED), 'guest');
      expect(await sharingKeys()).to.deep.equal([]);
    });

    it('should not let anybody share while sharing is disabled', async () => {
      Config.Sharing.enabled = false;
      for (const user of [owner, admin]) {
        const res = await create(user, SHARED);
        expect(res.body.error, user.name).to.not.equal(null);
        expect(res.body.result ?? null, user.name).to.equal(null);
      }
      expect(await sharingKeys()).to.deep.equal([]);
    });

    it('should require a password when Sharing.passwordRequired is set', async () => {
      Config.Sharing.passwordRequired = true;
      const res = await create(owner, SHARED);
      expect(res.body.error.code).to.equal(ErrorCodes.INPUT_ERROR);
      expect(await sharingKeys()).to.deep.equal([]);
      const s = await createOk(owner, SHARED, 'secret password');
      expect(s.passwordProtected).to.be.true;
    });
  });

  describe('listing, updating and deleting sharings', () => {
    let mine: ResponseSharingDTO;
    let others: ResponseSharingDTO;
    let admins: ResponseSharingDTO;

    beforeEach(async () => {
      await setUp();
      mine = await createOk(owner, SHARED, 'old password');
      others = await createOk(other, SHARED);
      admins = await createOk(admin, SHARED);
    });
    afterEach(tearDown);

    it('should list only the own sharings of a folder to a User, all of them to an Admin', async () => {
      expect(await listForDir(owner, mine)).to.deep.equal([mine.sharingKey]);
      expect(await listForDir(other, mine)).to.deep.equal([others.sharingKey]);
      expect(await listForDir(admin, mine)).to.deep.equal([mine.sharingKey, others.sharingKey, admins.sharingKey].sort());
    });

    it('should list all sharings only to an Admin', async () => {
      shouldBeRefused(await as(owner).get(api('/share/listAll')), 'user');
      const res = await as(admin).get(api('/share/listAll'));
      res.should.have.status(200);
      expect((res.body.result as ResponseSharingDTO[]).map(s => s.sharingKey).sort())
        .to.deep.equal([mine.sharingKey, others.sharingKey, admins.sharingKey].sort());
      for (const s of res.body.result) {
        expect(s.password, 'the password never goes out').to.equal(undefined);
      }
    });

    it('should not let a User delete the sharing of another user', async () => {
      const res = await as(other).delete(api('/share/' + mine.sharingKey));
      shouldBeRefused(res, 'other user');
      expect(await sharingKeys()).to.contain(mine.sharingKey);
    });

    it('should let a User delete the own sharing and an Admin anybody\'s', async () => {
      const own = await as(owner).delete(api('/share/' + mine.sharingKey));
      own.should.have.status(200);
      expect(own.body.error).to.equal(null);
      const byAdmin = await as(admin).delete(api('/share/' + others.sharingKey));
      byAdmin.should.have.status(200);
      expect(byAdmin.body.error).to.equal(null);
      expect(await sharingKeys()).to.deep.equal([admins.sharingKey]);
    });

    it('should not let a User update the sharing of another user', async () => {
      const res = await update(other, SHARED, mine.id, null, -1);
      expect(res.body.error, 'error').to.not.equal(null);
      // the old password still works, nothing changed
      (await shareLogin(request.agent(server.Server), mine.sharingKey, 'old password')).should.have.status(200);
      (await shareLogin(request.agent(server.Server), mine.sharingKey, null)).should.have.status(401);
    });

    it('should update the password and the expiry; the old password stops working', async () => {
      const valid = 2 * 24 * 60 * 60 * 1000;
      const before = Date.now();
      const res = await update(owner, SHARED, mine.id, 'new password', valid);
      res.should.have.status(200);
      expect(res.body.error).to.equal(null);
      expect(res.body.result.sharingKey, 'the link stays the same').to.equal(mine.sharingKey);
      expect(res.body.result.passwordProtected).to.be.true;
      expect(res.body.result.expires).to.be.within(before + valid, Date.now() + valid);

      const oldPassword = await shareLogin(request.agent(server.Server), mine.sharingKey, 'old password');
      oldPassword.should.have.status(401);
      expect(oldPassword.body.error.code).to.equal(ErrorCodes.CREDENTIAL_NOT_FOUND);
      (await shareLogin(request.agent(server.Server), mine.sharingKey, 'new password')).should.have.status(200);
    });

    it('should end the session of a guest that logged in with the old password', async () => {
      const guestAgent = request.agent(server.Server);
      try {
        (await shareLogin(guestAgent, mine.sharingKey, 'old password')).should.have.status(200);
        (await guestAgent.get(api('/user/me'))).should.have.status(200);

        (await update(owner, SHARED, mine.id, 'new password', -1)).should.have.status(200);
        (await guestAgent.get(api('/user/me'))).should.have.status(401);
      } finally {
        guestAgent.close();
      }
    });

    it('should remove the password of a sharing', async () => {
      const res = await update(owner, SHARED, mine.id, null, -1);
      expect(res.body.error).to.equal(null);
      expect(res.body.result.passwordProtected).to.be.false;
      (await shareLogin(request.agent(server.Server), mine.sharingKey, null)).should.have.status(200);
    });

    it('should lock a sharing for its User after Sharing.updateTimeout, not for an Admin', async () => {
      Config.Sharing.updateTimeout = 0;
      await new Promise(resolve => setTimeout(resolve, 5));
      const locked = await update(owner, SHARED, mine.id, 'new password', -1);
      expect(locked.body.error, 'locked').to.not.equal(null);
      (await shareLogin(request.agent(server.Server), mine.sharingKey, 'old password')).should.have.status(200);

      const byAdmin = await update(admin, SHARED, admins.id, 'new password', -1);
      expect(byAdmin.body.error, 'admin').to.equal(null);
    });

    it('should let an Admin update the sharing of another user', async () => {
      const res = await update(admin, SHARED, mine.id, 'admin password', -1);
      expect(res.body.error?.message ?? null, 'admin update').to.equal(null);
      // still the sharing of its owner
      expect(await listForDir(owner, mine)).to.deep.equal([mine.sharingKey]);
      (await shareLogin(request.agent(server.Server), mine.sharingKey, 'admin password')).should.have.status(200);
    });
  });

  describe('shared folder renamed or removed on disk (#1307)', () => {
    let sharing: ResponseSharingDTO;
    let guestAgent: ReturnType<typeof request.agent>;

    beforeEach(async () => {
      await setUp();
      sharing = await createOk(owner, SHARED, 'password');
      guestAgent = request.agent(server.Server);
      (await shareLogin(guestAgent, sharing.sharingKey, 'password')).should.have.status(200);
      const res = await guestAgent.get(api('/gallery/content/' + encodeURIComponent(SHARED)));
      res.should.have.status(200);
      const cw = ContentWrapperUtils.unpack(res.body.result as PackedContentWrapper);
      expect(cw.directory!.media.map(m => m.name)).to.deep.equal([PHOTO]);
    });
    afterEach(async () => {
      guestAgent.close();
      await tearDown();
    });

    const shouldStayValidWithDirectoryNotFound = async (): Promise<void> => {
      const info = await request.execute(server.Server).get(api('/share/' + sharing.sharingKey + '/publicInfo'));
      info.should.have.status(200);
      expect(info.body.result).to.deep.equal({sharingKey: sharing.sharingKey, passwordProtected: true});

      // the open session and a new login keep working
      for (const agent of [guestAgent, request.agent(server.Server)]) {
        if (agent !== guestAgent) {
          (await shareLogin(agent, sharing.sharingKey, 'password')).should.have.status(200);
        }
        (await agent.get(api('/user/me'))).should.have.status(200);
        const res = await agent.get(api('/gallery/content/' + encodeURIComponent(SHARED)));
        res.should.have.status(404);
        expect(res.body.error.code).to.equal(ErrorCodes.DIRECTORY_NOT_FOUND);
      }
    };

    it('should keep the sharing valid and answer "directory not found" for a renamed folder', async () => {
      fs.renameSync(path.join(galleryFolder, SHARED), path.join(galleryFolder, SHARED + ' (renamed)'));
      await shouldStayValidWithDirectoryNotFound();
    });

    it('should keep the sharing valid and answer "directory not found" for a removed folder', async () => {
      fs.rmSync(path.join(galleryFolder, SHARED), {recursive: true});
      await shouldStayValidWithDirectoryNotFound();
    });

    it('should not show the renamed folder under its new name to the guest', async () => {
      const renamed = SHARED + ' (renamed)';
      fs.renameSync(path.join(galleryFolder, SHARED), path.join(galleryFolder, renamed));
      const res = await guestAgent.get(api('/gallery/content/' + encodeURIComponent(renamed)));
      res.should.have.status(404);
      expect(res.body.error.code).to.equal(ErrorCodes.DIRECTORY_NOT_FOUND);
    });
  });
});
