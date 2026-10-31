import {Config} from '../../../../src/common/config/private/Config';
import {Server} from '../../../../src/backend/server';
import * as path from 'path';
import * as chai from 'chai';
import {expect} from 'chai';
import {SuperAgentStatic} from 'superagent';
import {ProjectPath} from '../../../../src/backend/ProjectPath';
import {DBTestHelper} from '../../DBTestHelper';
import {ReIndexingSensitivity} from '../../../../src/common/config/private/PrivateConfig';
import {TestHelper} from '../../../TestHelper';
import {default as chaiHttp, request} from 'chai-http';
import {ErrorCodes} from '../../../../src/common/entities/Error';
import {UserRoles} from '../../../../src/common/entities/UserDTO';
import {SearchQueryTypes} from '../../../../src/common/entities/SearchQueryDTO';
import {ObjectManagers} from '../../../../src/backend/model/ObjectManagers';

process.env.NODE_ENV = 'test';
chai.should();
chai.use(chaiHttp);

// to help WebStorm to handle the test cases
declare let describe: any;
declare const after: any;
declare const it: any;
declare global {
  export interface Object {
    should: Chai.Assertion;
  }
}

const tmpDescribe = describe;
describe = DBTestHelper.describe({sqlite: true});

describe('GalleryRouter', (sqlHelper: DBTestHelper) => {
  before(TestHelper.resetConfig);
  describe = tmpDescribe;

  let server: Server;
  const setUp = async () => {
    await sqlHelper.initDB();
    Config.Users.authenticationRequired = false;
    Config.Media.Video.enabled = true;
    Config.Media.folder = path.join(__dirname, '../../assets');
    Config.Media.tempFolder = TestHelper.TMP_DIR;
    ProjectPath.reset();
    server = new Server(false);
    await server.onStarted.wait();
  };
  const tearDown = async () => {
    await sqlHelper.clearDB();
  };


  describe('/GET /api/gallery/content/', async () => {

    beforeEach(setUp);
    afterEach(tearDown);

    it('should load gallery', async () => {
      const result = await (request.execute(server.Server) as SuperAgentStatic)
        .get(Config.Server.apiPath + '/gallery/content/');

      (result.should as any).have.status(200);
      expect(result.body.error).to.be.equal(null);
      expect(result.body.result).to.not.be.equal(null);
      expect(result.body.result.directory).to.not.be.equal(null);
    });

    it('should load gallery twice (to force loading form db)', async () => {
      Config.Indexing.reIndexingSensitivity = ReIndexingSensitivity.low;
      const _ = await (request.execute(server.Server) as SuperAgentStatic)
        .get(Config.Server.apiPath + '/gallery/content/orientation');

      const result = await (request.execute(server.Server) as SuperAgentStatic)
        .get(Config.Server.apiPath + '/gallery/content/orientation');

      (result.should as any).have.status(200);
      expect(result.body.error).to.be.equal(null);
      expect(result.body.result).to.not.be.equal(null);
      expect(result.body.result.directory).to.not.be.equal(null);
    });


  });

  describe('express uri parsing', async () => {


    beforeEach(setUp);
    afterEach(tearDown);

    it('express should parse path orientation/JPEG', async () => {
      Config.Indexing.reIndexingSensitivity = ReIndexingSensitivity.low;
      const result = await (request.execute(server.Server) as SuperAgentStatic)
        .get(Config.Server.apiPath + '/gallery/content/orientation/JPEG');


      (result.should as any).have.status(404);
    });


    it('express should parse path orientation encoded', async () => {
      Config.Indexing.reIndexingSensitivity = ReIndexingSensitivity.low;
      const result = await (request.execute(server.Server) as SuperAgentStatic)
        .get(Config.Server.apiPath + '/gallery/content/' + encodeURIComponent('orientation'));


      (result.should as any).have.status(200);
      expect(result.body.error).to.be.equal(null);
      expect(result.body.result).to.not.be.equal(null);
      expect(result.body.result.directory).to.not.be.equal(null);
    });

    it('express should parse path orientation/JPEG encoded', async () => {
      Config.Indexing.reIndexingSensitivity = ReIndexingSensitivity.low;
      const result = await (request.execute(server.Server) as SuperAgentStatic)
        .get(Config.Server.apiPath + '/gallery/content/' + encodeURIComponent('orientation/JPEG'));


      (result.should as any).have.status(404);
    });


  });

  describe('/GET /api/gallery/content/video.mp4/bestFit', async () => {

    beforeEach(setUp);
    afterEach(tearDown);

    it('should get video without transcoding', async () => {
      const result = await (request.execute(server.Server) as SuperAgentStatic)
        .get(Config.Server.apiPath + '/gallery/content/video.mp4/bestFit');

      (result.should as any).have.status(200);
      expect(result.body).to.be.instanceof(Buffer);
    });


  });

  describe('/GET /api/gallery//', async () => {

    beforeEach(setUp);
    afterEach(tearDown);

    it('should list root directory even with double slash', async () => {
      const result = await (request.execute(server.Server) as SuperAgentStatic)
        .get(Config.Server.apiPath + '/gallery//');

      (result.should as any).have.status(200);
      expect(result.body.error).to.be.equal(null);
      expect(result.body.result).to.not.be.equal(null);
      expect(result.body.result.directory).to.not.be.equal(null);
    });
  });

  describe('/GET raw video, icon and thumbnail', async () => {

    beforeEach(setUp);
    afterEach(tearDown);

    it('should get raw video', async () => {
      const result = await (request.execute(server.Server) as SuperAgentStatic)
        .get(Config.Server.apiPath + '/gallery/content/video.mp4');

      (result.should as any).have.status(200);
      expect(result.body).to.be.instanceof(Buffer);
    });

    it('should get video icon', async () => {
      const result = await (request.execute(server.Server) as SuperAgentStatic)
        .get(Config.Server.apiPath + '/gallery/content/video.mp4/icon');

      (result.should as any).have.status(200);
      expect(result.body).to.be.instanceof(Buffer);
    });

    it('should get video thumbnail (size 240)', async () => {
      const result = await (request.execute(server.Server) as SuperAgentStatic)
        .get(Config.Server.apiPath + '/gallery/content/video.mp4/240');

      (result.should as any).have.status(200);
      expect(result.body).to.be.instanceof(Buffer);
    });
  });

  describe('negative paths for non-existent media/meta', async () => {

    beforeEach(setUp);
    afterEach(tearDown);

    it('should return PATH_ERROR for non-existent video (raw)', async () => {
      const result = await (request.execute(server.Server) as SuperAgentStatic)
        .get(Config.Server.apiPath + '/gallery/content/nonexistent.mp4');

      (result.should as any).have.status(200);
      expect(result.body.error).to.not.be.equal(null);
      expect(result.body.result).to.be.equal(null);
      expect(result.body.error.code).to.be.equal(ErrorCodes.PATH_ERROR);
    });

    it('should return PATH_ERROR for non-existent video icon', async () => {
      const result = await (request.execute(server.Server) as SuperAgentStatic)
        .get(Config.Server.apiPath + '/gallery/content/nonexistent.mp4/icon');

      (result.should as any).have.status(200);
      expect(result.body.error).to.not.be.equal(null);
      expect(result.body.result).to.be.equal(null);
      expect(result.body.error.code).to.be.equal(ErrorCodes.PATH_ERROR);
    });

    it('should return PATH_ERROR for non-existent meta file (gpx)', async () => {
      const result = await (request.execute(server.Server) as SuperAgentStatic)
        .get(Config.Server.apiPath + '/gallery/content/nonexistent.gpx');

      (result.should as any).have.status(200);
      expect(result.body.error).to.not.be.equal(null);
      expect(result.body.result).to.be.equal(null);
      expect(result.body.error.code).to.be.equal(ErrorCodes.PATH_ERROR);
    });

    it('should return PATH_ERROR for non-existent meta file bestFit (gpx)', async () => {
      const result = await (request.execute(server.Server) as SuperAgentStatic)
        .get(Config.Server.apiPath + '/gallery/content/nonexistent.gpx/bestFit');

      (result.should as any).have.status(200);
      expect(result.body.error).to.not.be.equal(null);
      expect(result.body.result).to.be.equal(null);
      expect(result.body.error.code).to.be.equal(ErrorCodes.PATH_ERROR);
    });
  });

  describe('Cache-Control', async () => {

    beforeEach(setUp);
    afterEach(tearDown);

    const get = (url: string) => (request.execute(server.Server) as SuperAgentStatic)
      .get(Config.Server.apiPath + url);

    it('should cache photos and thumbnails for a day', async () => {
      const photo = await get('/gallery/content/wild-1-small.jpg');
      (photo.should as any).have.status(200);
      expect(photo.headers['cache-control']).to.equal('private, max-age=86400');

      const thumbnail = await get('/gallery/content/wild-1-small.jpg/240');
      (thumbnail.should as any).have.status(200);
      expect(thumbnail.headers['cache-control']).to.equal('private, max-age=86400');
    });

    it('should revalidate bestFit video', async () => {
      const result = await get('/gallery/content/video.mp4/bestFit');
      (result.should as any).have.status(200);
      expect(result.headers['cache-control']).to.equal('private, no-cache');
      expect(result.headers['etag']).to.be.a('string');
    });

    it('should not store random photo', async () => {
      // the content request would save the folder in the background, the random query needs it in the DB
      await ObjectManagers.getInstance().IndexingManager.indexDirectory('.', true);
      const result = await get('/gallery/random/' + encodeURIComponent(JSON.stringify({type: SearchQueryTypes.any_text, value: 'wild'})));
      (result.should as any).have.status(200);
      expect(result.headers['content-type']).to.equal('image/jpeg');
      expect(result.headers['cache-control']).to.equal('no-store');
    });
  });

  describe('role based access', async () => {

    beforeEach(setUp);
    afterEach(async () => {
      Config.Users.unAuthenticatedUserRole = UserRoles.Admin;
      await tearDown();
    });

    const get = (url: string) => (request.execute(server.Server) as SuperAgentStatic)
      .get(Config.Server.apiPath + url);

    it('LimitedGuest should not use autocomplete', async () => {
      Config.Users.unAuthenticatedUserRole = UserRoles.LimitedGuest;
      const result = await get('/autocomplete/a');
      (result.should as any).have.status(401);
    });

    it('Guest should use autocomplete', async () => {
      Config.Users.unAuthenticatedUserRole = UserRoles.Guest;
      const result = await get('/autocomplete/a');
      (result.should as any).have.status(200);
    });

    it('Guest should not see notifications', async () => {
      Config.Users.unAuthenticatedUserRole = UserRoles.Guest;
      const result = await get('/notifications');
      (result.should as any).have.status(401);
    });

    it('User should see notifications', async () => {
      Config.Users.unAuthenticatedUserRole = UserRoles.User;
      const result = await get('/notifications');
      (result.should as any).have.status(200);
    });
  });

});
