import {Config} from '../../../../src/common/config/private/Config';
import {Server} from '../../../../src/backend/server';
import * as path from 'path';
import * as chai from 'chai';
import {expect} from 'chai';
import {SuperAgentStatic} from 'superagent';
import {ProjectPath} from '../../../../src/backend/ProjectPath';
import {DBTestHelper} from '../../DBTestHelper';
import {TestHelper} from '../../../TestHelper';
import {default as chaiHttp, request} from 'chai-http';
import {HLSMWs} from '../../../../src/backend/middlewares/HLSMWs';

process.env.NODE_ENV = 'test';
chai.should();
chai.use(chaiHttp);

declare let describe: any;
declare const after: any;
declare const it: any;

const tmpDescribe = describe;
describe = DBTestHelper.describe({sqlite: true});

describe('HLSRouter', (sqlHelper: DBTestHelper) => {
  describe = tmpDescribe;

  let server: Server;

  const setUp = async () => {
    await sqlHelper.initDB();
    Config.Users.authenticationRequired = false;
    Config.Media.Video.enabled = true;
    Config.Media.Video.liveVideoTranscodingEnabled = false; // default off
    Config.Media.folder = path.join(__dirname, '../../assets');
    Config.Media.tempFolder = TestHelper.TMP_DIR;
    ProjectPath.reset();
    server = new Server(false);
    await server.onStarted.wait();
  };

  const tearDown = async () => {
    HLSMWs.killAllJobs();
    await sqlHelper.clearDB();
  };

  // --------------------------------------------------------------------------
  // Playlist endpoint — feature disabled
  // --------------------------------------------------------------------------
  describe('GET /api/gallery/hls/:path/playlist.m3u8 (feature disabled)', async () => {
    beforeEach(setUp);
    afterEach(tearDown);

    it('should return 404 when liveVideoTranscodingEnabled=false', async () => {
      Config.Media.Video.liveVideoTranscodingEnabled = false;
      const result = await (request.execute(server.Server) as SuperAgentStatic)
        .get(Config.Server.apiPath + '/gallery/hls/video.mp4/playlist.m3u8');
      expect(result.status).to.equal(404);
      expect(result.body.message).to.equal('Live video transcoding is not enabled');
    });
  });

  // --------------------------------------------------------------------------
  // Segment endpoint — feature disabled
  // --------------------------------------------------------------------------
  describe('GET /api/gallery/hls/:path/:filename (feature disabled)', async () => {
    beforeEach(setUp);
    afterEach(tearDown);

    it('should return 404 for init.mp4 when feature disabled', async () => {
      Config.Media.Video.liveVideoTranscodingEnabled = false;
      const result = await (request.execute(server.Server) as SuperAgentStatic)
        .get(Config.Server.apiPath + '/gallery/hls/video.mp4/init.mp4');
      expect(result.status).to.equal(404);
      expect(result.body.message).to.equal('Live video transcoding is not enabled');
    });

    it('should return 404 for segment_000.m4s when feature disabled', async () => {
      Config.Media.Video.liveVideoTranscodingEnabled = false;
      const result = await (request.execute(server.Server) as SuperAgentStatic)
        .get(Config.Server.apiPath + '/gallery/hls/video.mp4/segment_000.m4s');
      expect(result.status).to.equal(404);
      expect(result.body.message).to.equal('Live video transcoding is not enabled');
    });
  });

  // --------------------------------------------------------------------------
  // Path traversal protection
  // --------------------------------------------------------------------------
  describe('Path traversal protection', async () => {
    beforeEach(setUp);
    afterEach(tearDown);

    it('should block path traversal attempts for playlist', async () => {
      Config.Media.Video.liveVideoTranscodingEnabled = true;
      // The normalizePathParam middleware must reject paths that escape the image root.
      // With authentication disabled the first rejection we'll see is 400/403/500
      // rather than a successful response serving an arbitrary file.
      const result = await (request.execute(server.Server) as SuperAgentStatic)
        .get(Config.Server.apiPath + '/gallery/hls/../../etc/passwd/playlist.m3u8');
      expect(result.status).to.be.oneOf([400, 403, 404, 500]);
      // Must not be a 200 that serves the playlist for an escaped path
      expect(result.status).to.not.equal(200);
    });

    it('should block path traversal attempts for segments', async () => {
      Config.Media.Video.liveVideoTranscodingEnabled = true;
      const result = await (request.execute(server.Server) as SuperAgentStatic)
        .get(Config.Server.apiPath + '/gallery/hls/../../etc/passwd/segment_000.m4s');
      expect(result.status).to.be.oneOf([400, 403, 404, 500]);
      expect(result.status).to.not.equal(200);
    });
  });

  // --------------------------------------------------------------------------
  // Feature enabled: playlist for a real (mp4) file that needs no transcode
  // Serves the 503 "not ready in time" because FFmpeg can't produce HLS for an
  // mp4 instantly in a test environment — but the route MUST return a non-404.
  // --------------------------------------------------------------------------
  describe('GET /api/gallery/hls/:path/playlist.m3u8 (feature enabled)', async () => {
    beforeEach(setUp);
    afterEach(tearDown);

    it('should NOT return 404 (feature disabled message) when enabled', async () => {
      Config.Media.Video.liveVideoTranscodingEnabled = true;
      // The request will error (503 or 500) because no real FFmpeg output is
      // produced in the test, but the 404-disabled gate must not fire.
      const result = await (request.execute(server.Server) as SuperAgentStatic)
        .get(Config.Server.apiPath + '/gallery/hls/video.mp4/playlist.m3u8');
      expect(result.status).to.not.equal(404);
      if (result.status === 404) {
        // If somehow 404, make sure it's NOT the disabled message
        expect(result.body.message).to.not.equal('Live video transcoding is not enabled');
      }
    });
  });
});
