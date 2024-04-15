import {Config} from '../../../../src/common/config/private/Config';
import {Server} from '../../../../src/backend/server';
import * as path from 'path';
import * as fs from 'fs';
import {expect} from 'chai';
import {SuperAgentStatic} from 'superagent';
import {ProjectPath} from '../../../../src/backend/ProjectPath';
import {DBTestHelper} from '../../DBTestHelper';
import {ReIndexingSensitivity} from '../../../../src/common/config/private/PrivateConfig';
import {TestHelper} from '../../../TestHelper';


process.env.NODE_ENV = 'test';
const chai: any = require('chai');
const chaiHttp = require('chai-http');
const should = chai.should();
chai.use(chaiHttp);

// to help WebStorm to handle the test cases
declare let describe: any;
declare const after: any;
declare const it: any;
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
      const result = await (chai.request(server.Server) as SuperAgentStatic)
        .get(Config.Server.apiPath + '/gallery/content/');

      (result.should as any).have.status(200);
      expect(result.body.error).to.be.equal(null);
      expect(result.body.result).to.not.be.equal(null);
      expect(result.body.result.directory).to.not.be.equal(null);
    });

    it('should load gallery twice (to force loading form db)', async () => {
      Config.Indexing.reIndexingSensitivity = ReIndexingSensitivity.low;
      const _ = await (chai.request(server.Server) as SuperAgentStatic)
        .get(Config.Server.apiPath + '/gallery/content/orientation');

      const result = await (chai.request(server.Server) as SuperAgentStatic)
        .get(Config.Server.apiPath + '/gallery/content/orientation');

      (result.should as any).have.status(200);
      expect(result.body.error).to.be.equal(null);
      expect(result.body.result).to.not.be.equal(null);
      expect(result.body.result.directory).to.not.be.equal(null);
    });


  });

  describe('/GET /api/gallery/content/video.mp4/bestFit', async () => {

    beforeEach(setUp);
    afterEach(tearDown);

    it('should get video without transcoding', async () => {
      const result = await (chai.request(server.Server) as SuperAgentStatic)
        .get(Config.Server.apiPath + '/gallery/content/video.mp4/bestFit');

      (result.should as any).have.status(200);
      expect(result.body).to.be.instanceof(Buffer);
    });


  });


});
