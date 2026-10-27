import {Config} from '../../../../src/common/config/private/Config';
import {Server} from '../../../../src/backend/server';
import * as path from 'path';
import * as chai from 'chai';
import {expect} from 'chai';
import {SuperAgentStatic} from 'superagent';
import {ProjectPath} from '../../../../src/backend/ProjectPath';
import {ObjectManagers} from '../../../../src/backend/model/ObjectManagers';
import {DBTestHelper} from '../../DBTestHelper';
import {ReIndexingSensitivity} from '../../../../src/common/config/private/PrivateConfig';
import {TestHelper} from '../../../TestHelper';
import {default as chaiHttp, request} from 'chai-http';
import {ErrorCodes} from '../../../../src/common/entities/Error';
import {ANDSearchQuery, DirectorySearch, SearchQueryDTO, SearchQueryTypes, TextSearch, TextSearchQueryMatchTypes} from '../../../../src/common/entities/SearchQueryDTO';
import {SearchQueryUtils} from '../../../../src/common/SearchQueryUtils';
import {UserRoles} from '../../../../src/common/entities/UserDTO';

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

  describe('/GET /api/gallery/random/:searchQueryDTO', async () => {

    beforeEach(setUp);
    afterEach(tearDown);

    it('should return random photo for URLified search query', async () => {
      await ObjectManagers.getInstance().IndexingManager.indexDirectory('orientation', true);

      const urlifiedQuery = SearchQueryUtils.urlify({
        type: SearchQueryTypes.file_name,
        matchType: TextSearchQueryMatchTypes.exact_match,
        value: 'Landscape_0.jpg',
      } as TextSearch);

      const result = await (request.execute(server.Server) as SuperAgentStatic)
        .get(Config.Server.apiPath + '/gallery/random/' + encodeURIComponent(urlifiedQuery));

      (result.should as any).have.status(200);
      (result.should as any).have.header('content-type', /^image\/jpeg/);
      expect(result.body).to.be.instanceof(Buffer);
    });

    it('should return random photo for directory query containing /', async () => {
      await ObjectManagers.getInstance().IndexingManager.indexDirectory('orientation', true);

      const query: ANDSearchQuery = {
        type: SearchQueryTypes.AND,
        list: [
          {
            type: SearchQueryTypes.directory,
            matchType: TextSearchQueryMatchTypes.globMatch,
            value: 'orientation/*',
          } as DirectorySearch,
          {
            type: SearchQueryTypes.file_name,
            matchType: TextSearchQueryMatchTypes.exact_match,
            value: 'Landscape_0.jpg',
          } as TextSearch,
        ],
      };

      const urlifiedQuery = SearchQueryUtils.urlify(query);

      const encoded = await (request.execute(server.Server) as SuperAgentStatic)
        .get(Config.Server.apiPath + '/gallery/random/' + encodeURIComponent(urlifiedQuery));
      (encoded.should as any).have.status(200);
      (encoded.should as any).have.header('content-type', /^image\/jpeg/);
      expect(encoded.body).to.be.instanceof(Buffer);

      const raw = await (request.execute(server.Server) as SuperAgentStatic)
        .get(Config.Server.apiPath + '/gallery/random/' + urlifiedQuery);
      (raw.should as any).have.status(200);
      (raw.should as any).have.header('content-type', /^image\/jpeg/);
      expect(raw.body).to.be.instanceof(Buffer);
    });

    it('should keep % sequences in search text through Express routing', async () => {
      let receivedQuery: SearchQueryDTO = null;
      const origGetNMedia = ObjectManagers.getInstance().SearchManager.getNMedia;
      ObjectManagers.getInstance().SearchManager.getNMedia = async (context: any, query: SearchQueryDTO, ...args: any[]) => {
        receivedQuery = query;
        return origGetNMedia.call(ObjectManagers.getInstance().SearchManager, context, query, ...args);
      };
      try {
        const originalQuery: TextSearch = {
          type: SearchQueryTypes.keyword,
          value: 'a%20b',
          matchType: TextSearchQueryMatchTypes.exact_match,
        };
        const urlifiedQuery = SearchQueryUtils.urlify(originalQuery);

        await (request.execute(server.Server) as SuperAgentStatic)
          .get(Config.Server.apiPath + '/gallery/random/' + encodeURIComponent(urlifiedQuery));

        expect(receivedQuery).to.deep.equal(originalQuery);
      } finally {
        ObjectManagers.getInstance().SearchManager.getNMedia = origGetNMedia;
      }
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
