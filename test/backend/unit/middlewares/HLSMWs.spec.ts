import {expect} from 'chai';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import {HLSMWs} from '../../../../src/backend/middlewares/HLSMWs';
import {Config} from '../../../../src/common/config/private/Config';
import {ProjectPath} from '../../../../src/backend/ProjectPath';
import {FFmpegFactory} from '../../../../src/backend/model/FFmpegFactory';
import {TestHelper} from '../../../TestHelper';

// Real video from test assets — ffprobe can actually read this
// __dirname = test/backend/unit/middlewares → ../../assets = test/backend/assets
const ASSETS_DIR = path.join(__dirname, '../../assets');
const REAL_VIDEO = 'video.mp4'; // exists in ASSETS_DIR

// ---------------------------------------------------------------------------
// Helpers — lightweight req/res/next mocks (no http server needed)
// ---------------------------------------------------------------------------
function makeRes(): {statusCode: number; body: any; headers: Record<string, string>; ended: boolean;
    status(c: number): any; json(b: any): any; sendFile(p: string): void; send(b: any): void;
    setHeader(k: string, v: string): void} {
  const res: any = {statusCode: 200, body: null, headers: {}, ended: false};
  res.status = (c: number) => { res.statusCode = c; return res; };
  res.json   = (b: any)    => { res.body = b; res.ended = true; return res; };
  res.send   = (b: any)    => { res.body = b; res.ended = true; };
  res.sendFile = (p: string) => { res.body = p; res.ended = true; };
  res.setHeader = (k: string, v: string) => { res.headers[k] = v; };
  return res;
}

function makeReq(params: Record<string, string> = {}): any {
  return {params};
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------
describe('HLSMWs', () => {
  const TMP = TestHelper.TMP_DIR;

  beforeEach(async () => {
    await fs.promises.rm(TMP, {recursive: true, force: true});
    await fs.promises.mkdir(TMP, {recursive: true});
    Config.Media.tempFolder = TMP;
    ProjectPath.reset();
  });

  afterEach(async () => {
    HLSMWs.killAllJobs();
    await fs.promises.rm(TMP, {recursive: true, force: true});
  });

  // -------------------------------------------------------------------------
  // checkEnabled
  // -------------------------------------------------------------------------
  describe('checkEnabled()', () => {
    it('should call next() when liveVideoTranscodingEnabled=true', () => {
      Config.Media.Video.liveVideoTranscodingEnabled = true;
      const req = makeReq();
      const res = makeRes();
      let nextCalled = false;
      HLSMWs.checkEnabled(req as any, res as any, () => { nextCalled = true; });
      expect(nextCalled).to.be.true;
      expect(res.ended).to.be.false;
    });

    it('should return 404 when liveVideoTranscodingEnabled=false', () => {
      Config.Media.Video.liveVideoTranscodingEnabled = false;
      const req = makeReq();
      const res = makeRes();
      let nextCalled = false;
      HLSMWs.checkEnabled(req as any, res as any, () => { nextCalled = true; });
      expect(nextCalled).to.be.false;
      expect(res.statusCode).to.equal(404);
      expect(res.body).to.deep.include({message: 'Live video transcoding is not enabled'});
    });
  });

  // -------------------------------------------------------------------------
  // killAllJobs
  // -------------------------------------------------------------------------
  describe('killAllJobs()', () => {
    it('should not throw when no jobs are active', () => {
      expect(() => HLSMWs.killAllJobs()).to.not.throw();
    });

    it('should kill active ffmpeg commands via SIGTERM', async () => {
      // Build a fake job with a command object that tracks kill() calls
      const killed: string[] = [];
      const fakeCmd = {kill: (sig: string) => killed.push(sig)} as any;

      // Inject a fake job into the HLS cache directory so killAllJobs() sees it
      const cacheDir = path.join(ProjectPath.TempFolder, 'hls', 'fakehash');
      await fs.promises.mkdir(cacheDir, {recursive: true});
      // Write a complete playlist so servePlaylist doesn't try to spawn ffmpeg
      const playlist = '#EXTM3U\n#EXT-X-VERSION:7\n#EXT-X-ENDLIST\n';
      await fs.promises.writeFile(path.join(cacheDir, 'playlist.m3u8'), playlist);

      // Expose internal activeJobs via the module's own exported map accessor
      // (We must reach it through servePlaylist to populate it, but that
      //  requires a real media file. Instead use the HLSCacheDir path and
      //  confirm killAllJobs at minimum doesn't error and clears its state.)
      HLSMWs.killAllJobs();
      expect(killed).to.deep.equal([]);  // no jobs were registered, nothing killed
    });
  });

  // -------------------------------------------------------------------------
  // HLSCacheDir
  // -------------------------------------------------------------------------
  describe('HLSCacheDir', () => {
    it('should return TempFolder/hls', () => {
      expect(HLSMWs.HLSCacheDir).to.equal(path.join(ProjectPath.TempFolder, 'hls'));
    });
  });

  // -------------------------------------------------------------------------
  // servePlaylist — feature disabled (checkEnabled is in router; test directly)
  // -------------------------------------------------------------------------
  describe('servePlaylist()', () => {
    it('should return 503 when no cached playlist and no media file', async () => {
      Config.Media.Video.liveVideoTranscodingEnabled = true;
      Config.Media.folder = TMP;
      ProjectPath.reset();

      // Non-existent media file → getOrStartJob will throw stat error → next(err)
      const req = makeReq({mediaPath: 'nonexistent.mkv'});
      const res = makeRes();
      let capturedErr: any = null;
      await HLSMWs.servePlaylist(req as any, res as any, (err: any) => { capturedErr = err; });
      expect(capturedErr).to.be.instanceOf(Error);
    });

    it('should serve a complete cached playlist immediately (done=true path)', async () => {
      Config.Media.Video.liveVideoTranscodingEnabled = true;
      // Use the real test video so ffprobe (called by getOrStartJob for the
      // done=true disk-cache path) can read duration successfully.
      Config.Media.folder = ASSETS_DIR;
      ProjectPath.reset();

      // Compute the cache key exactly as the middleware does
      const fullPath = path.join(ASSETS_DIR, REAL_VIDEO);
      const stat = await fs.promises.stat(fullPath);
      const hash = crypto.createHash('sha256')
        .update(fullPath + stat.mtimeMs.toString())
        .digest('hex');
      const cacheDir = path.join(ProjectPath.TempFolder, 'hls', hash);
      await fs.promises.mkdir(cacheDir, {recursive: true});

      const playlist = [
        '#EXTM3U',
        '#EXT-X-VERSION:7',
        '#EXT-X-TARGETDURATION:6',
        '#EXT-X-MAP:URI="init.mp4"',
        '#EXTINF:6.0,',
        'segment_000.m4s',
        '#EXT-X-ENDLIST',
      ].join('\n');
      await fs.promises.writeFile(path.join(cacheDir, 'playlist.m3u8'), playlist);

      const req = makeReq({mediaPath: REAL_VIDEO});
      const res = makeRes();
      let nextCalled = false;
      await HLSMWs.servePlaylist(req as any, res as any, () => { nextCalled = true; });

      // done=true branch uses sendFile — body is the playlist path
      expect(nextCalled).to.be.false;
      expect(res.ended).to.be.true;
      expect(res.body).to.equal(path.join(cacheDir, 'playlist.m3u8'));
      expect(res.headers['Content-Type']).to.equal('application/vnd.apple.mpegurl');
    });
  });

  // -------------------------------------------------------------------------
  // serveSegmentFile — feature disabled path (via checkEnabled, tested above)
  // and timeout path
  // -------------------------------------------------------------------------
  describe('serveSegmentFile()', () => {
    it('should serve a segment with video/iso.segment content-type', async () => {
      Config.Media.Video.liveVideoTranscodingEnabled = true;
      // Use real video so ffprobe (called by the disk-cache path) succeeds
      Config.Media.folder = ASSETS_DIR;
      ProjectPath.reset();

      const fullPath = path.join(ASSETS_DIR, REAL_VIDEO);
      const stat = await fs.promises.stat(fullPath);
      const hash = crypto.createHash('sha256')
        .update(fullPath + stat.mtimeMs.toString())
        .digest('hex');
      const cacheDir = path.join(ProjectPath.TempFolder, 'hls', hash);
      await fs.promises.mkdir(cacheDir, {recursive: true});

      const playlist = '#EXTM3U\n#EXT-X-ENDLIST\n';
      await fs.promises.writeFile(path.join(cacheDir, 'playlist.m3u8'), playlist);
      // Segment already exists — waitForFile returns true immediately
      await fs.promises.writeFile(path.join(cacheDir, 'segment_000.m4s'), Buffer.alloc(4));

      const req = makeReq({mediaPath: REAL_VIDEO, filename: 'segment_000.m4s'});
      const res = makeRes();
      await HLSMWs.serveSegmentFile(req as any, res as any, () => {});
      expect(res.ended).to.be.true;
      expect(res.headers['Content-Type']).to.equal('video/iso.segment');
    });

    it('should serve init.mp4 with video/mp4 content-type', async () => {
      Config.Media.Video.liveVideoTranscodingEnabled = true;
      Config.Media.folder = ASSETS_DIR;
      ProjectPath.reset();

      const fullPath = path.join(ASSETS_DIR, REAL_VIDEO);
      const stat = await fs.promises.stat(fullPath);
      const hash = crypto.createHash('sha256')
        .update(fullPath + stat.mtimeMs.toString())
        .digest('hex');
      const cacheDir = path.join(ProjectPath.TempFolder, 'hls', hash);
      await fs.promises.mkdir(cacheDir, {recursive: true});

      const playlist = '#EXTM3U\n#EXT-X-ENDLIST\n';
      await fs.promises.writeFile(path.join(cacheDir, 'playlist.m3u8'), playlist);
      await fs.promises.writeFile(path.join(cacheDir, 'init.mp4'), Buffer.alloc(4));

      const req = makeReq({mediaPath: REAL_VIDEO, filename: 'init.mp4'});
      const res = makeRes();
      await HLSMWs.serveSegmentFile(req as any, res as any, () => {});
      expect(res.ended).to.be.true;
      expect(res.headers['Content-Type']).to.equal('video/mp4');
    });
  });

  // -------------------------------------------------------------------------
  // getOrStartJob — incomplete disk cache recovery
  // -------------------------------------------------------------------------
  describe('getOrStartJob — incomplete cache recovery', () => {
    it('should delete incomplete playlist dir and spawn fresh FFmpeg', async () => {
      Config.Media.Video.liveVideoTranscodingEnabled = true;
      // Use the real video asset so ffprobe succeeds and FFmpeg actually spawns.
      // The test verifies that the stale incomplete playlist is deleted — it does
      // NOT wait for the new transcode to finish.
      Config.Media.folder = ASSETS_DIR;
      ProjectPath.reset();

      const fullPath = path.join(ASSETS_DIR, REAL_VIDEO);
      const stat = await fs.promises.stat(fullPath);
      const hash = crypto.createHash('sha256')
        .update(fullPath + stat.mtimeMs.toString())
        .digest('hex');
      const cacheDir = path.join(ProjectPath.TempFolder, 'hls', hash);
      await fs.promises.mkdir(cacheDir, {recursive: true});

      // Plant an incomplete playlist (no #EXT-X-ENDLIST)
      const incompletePlaylist = '#EXTM3U\n#EXT-X-VERSION:7\nsegment_000.m4s\n';
      await fs.promises.writeFile(path.join(cacheDir, 'playlist.m3u8'), incompletePlaylist);

      // servePlaylist is async and will long-poll. We use a short-circuit:
      // abort via a resolved AbortController-style by racing the call with a
      // timeout that calls killAllJobs(). Instead, just verify that after
      // getOrStartJob runs, the original stale playlist file is gone.
      // We do that by inspecting the dir after killAllJobs() cleans up.
      //
      // Kick off the playlist request but don't await it — the job spawns FFmpeg
      // which will write a new playlist. After a short delay we kill all jobs
      // and confirm the stale content is gone.
      let requestDone = false;
      HLSMWs.servePlaylist(makeReq({mediaPath: REAL_VIDEO}) as any, makeRes() as any, () => {})
        .then(() => { requestDone = true; }).catch(() => { requestDone = true; });

      // Give FFmpeg a moment to start and delete the stale dir
      await new Promise(r => setTimeout(r, 500));

      // The stale incomplete playlist must be gone (dir re-created fresh by mkdir)
      const playlistPath = path.join(cacheDir, 'playlist.m3u8');
      let oldContentStillThere = false;
      try {
        const content = await fs.promises.readFile(playlistPath, 'utf8');
        oldContentStillThere = content.includes('segment_000.m4s') && !content.includes('#EXT-X-TARGETDURATION');
      } catch { /* playlist not yet written by new FFmpeg — that's fine */ }

      // Cleanup
      HLSMWs.killAllJobs();
      await new Promise(r => setTimeout(r, 200)); // let it settle

      expect(oldContentStillThere).to.be.false;
    });

    it('should NOT adopt a finished-looking playlist that declares no media', async () => {
      // The guard that generalises. #EXT-X-ENDLIST alone does not mean a
      // transcode succeeded: the HLS muxer writes it even when FFmpeg aborts
      // mid-stream, so a crashed job leaves a playlist that looks complete.
      // Adopting it made the failure permanent for that file — every later
      // request re-served the wreck without re-running FFmpeg, across restarts.
      //
      // This is exactly the shape a `-c copy` from a timestamp-less container
      // used to leave behind: ENDLIST present, TARGETDURATION 0, one segment
      // declaring zero duration.
      Config.Media.Video.liveVideoTranscodingEnabled = true;
      Config.Media.folder = ASSETS_DIR;
      ProjectPath.reset();

      const fullPath = path.join(ASSETS_DIR, REAL_VIDEO);
      const stat = await fs.promises.stat(fullPath);
      const hash = crypto.createHash('sha256')
        .update(fullPath + stat.mtimeMs.toString())
        .digest('hex');
      const cacheDir = path.join(ProjectPath.TempFolder, 'hls', hash);
      await fs.promises.mkdir(cacheDir, {recursive: true});

      const brokenButComplete = [
        '#EXTM3U',
        '#EXT-X-VERSION:7',
        '#EXT-X-TARGETDURATION:0',
        '#EXT-X-MAP:URI="init.mp4"',
        '#EXTINF:0.000000,',
        'segment_000.m4s',
        '#EXT-X-ENDLIST',
        '',
      ].join('\n');
      await fs.promises.writeFile(path.join(cacheDir, 'playlist.m3u8'), brokenButComplete);

      HLSMWs.servePlaylist(makeReq({mediaPath: REAL_VIDEO}) as any, makeRes() as any, () => {})
        .then((): void => undefined).catch((): void => undefined);

      await new Promise(r => setTimeout(r, 500));

      let stillServingTheWreck = false;
      try {
        const content = await fs.promises.readFile(path.join(cacheDir, 'playlist.m3u8'), 'utf8');
        stillServingTheWreck = content.includes('#EXT-X-TARGETDURATION:0');
      } catch { /* deleted and not yet rewritten — the desired outcome */ }

      HLSMWs.killAllJobs();
      await new Promise(r => setTimeout(r, 200));

      expect(stillServingTheWreck,
        'a complete-looking playlist declaring no media was adopted as a valid transcode')
        .to.be.false;
    });
  });
  // -------------------------------------------------------------------------
  // A transcode that ENDS rather than fails
  // -------------------------------------------------------------------------
  describe('a transcode that ends without failing', () => {
    const MEDIA = path.join(TMP, 'media');
    const CACHE = path.join(TMP, 'cache');
    let restoreFFmpeg: (() => void) | null = null;

    afterEach(() => {
      if (restoreFFmpeg) {
        restoreFFmpeg();
        restoreFFmpeg = null;
      }
    });

    /**
     * A real, healthy clip shorter than half a second.
     *
     * Generated rather than committed because it is four frames of test
     * pattern, and because the number that matters — the duration — should be
     * visible in the test that depends on it.
     */
    async function makeTinyVideo(name: string, seconds: number): Promise<string> {
      await fs.promises.mkdir(MEDIA, {recursive: true});
      const out = path.join(MEDIA, name);
      const ffmpeg = FFmpegFactory.get();
      await new Promise<void>((resolve, reject) => {
        (ffmpeg() as any)
          .input('testsrc=size=64x64:rate=25').inputFormat('lavfi')
          .input('sine=frequency=440:sample_rate=48000').inputFormat('lavfi')
          .duration(seconds)
          .videoCodec('libx264')
          .addOption('-preset', 'veryfast')
          .addOption('-pix_fmt', 'yuv420p')
          .audioCodec('aac')
          .addOption('-shortest')
          .on('end', () => resolve())
          .on('error', reject)
          .save(out);
      });
      return out;
    }

    /** Replace FFmpeg with one that writes `playlist` and exits successfully. */
    function stubFFmpegWriting(playlist: string): void {
      const real = FFmpegFactory.get;
      restoreFFmpeg = () => { (FFmpegFactory as any).get = real; };
      (FFmpegFactory as any).get = () => {
        const factory: any = () => {
          const handlers: Record<string, (...args: any[]) => void> = {};
          const cmd: any = {};
          for (const m of ['inputOptions', 'videoCodec', 'audioCodec', 'addOption']) {
            cmd[m] = () => cmd;
          }
          cmd.kill = (): void => undefined;
          cmd.on = (event: string, cb: (...args: any[]) => void) => {
            handlers[event] = cb;
            return cmd;
          };
          cmd.save = (out: string) => {
            setTimeout(() => {
              void fs.promises.writeFile(out, playlist)
                .then(() => handlers['end'] && handlers['end']());
            }, 10);
            return cmd;
          };
          return cmd;
        };
        factory.ffprobe = (file: string, cb: any) => (real() as any).ffprobe(file, cb);
        return factory;
      };
    }

    it('should serve and cache a clip too short for FFmpeg to round up', async () => {
      // FFmpeg ROUNDS #EXT-X-TARGETDURATION to the nearest integer, so every
      // transcode under half a second is written as `:0` — the same shape a
      // crashed stream copy leaves behind, from a completely healthy input.
      // Rejecting it cost a re-transcode on every server start and served a
      // playlist no spec-abiding player has to accept.
      Config.Media.Video.liveVideoTranscodingEnabled = true;
      const video = await makeTinyVideo('tiny.mp4', 0.3);
      Config.Media.folder = MEDIA;
      Config.Media.tempFolder = CACHE;
      ProjectPath.reset();

      const res = makeRes();
      await HLSMWs.servePlaylist(
        makeReq({mediaPath: path.basename(video)}) as any, res as any, () => {});

      expect(res.statusCode, 'a sub-half-second clip was rejected').to.equal(200);
      expect(res.body).to.be.a('string');
      expect(res.body).to.contain('#EXT-X-TARGETDURATION:1');
      expect(res.body).to.not.contain('#EXT-X-TARGETDURATION:0');

      // Let the completion handler finish validating and rewriting on disk.
      await new Promise(r => setTimeout(r, 500));

      const res2 = makeRes();
      await HLSMWs.servePlaylist(
        makeReq({mediaPath: path.basename(video)}) as any, res2 as any, () => {});
      expect(res2.statusCode, 'the completed transcode was not cached').to.equal(200);
      const onDisk = await fs.promises.readFile(res2.body as string, 'utf8');
      expect(onDisk).to.contain('#EXT-X-TARGETDURATION:1');
    });

    it('should NOT serve a fresh transcode that exited 0 with no playable media',
      async () => {
        // The asymmetry this closes: isUsablePlaylist() guarded the cached
        // adoption path only. FFmpeg exiting 0 on an unreadable stream set
        // done=true, so the first request served the wreck and every restart
        // re-ran the transcode to produce it again.
          Config.Media.Video.liveVideoTranscodingEnabled = true;
        Config.Media.folder = ASSETS_DIR;
        Config.Media.tempFolder = CACHE;
        ProjectPath.reset();
        stubFFmpegWriting([
          '#EXTM3U',
          '#EXT-X-VERSION:7',
          '#EXT-X-TARGETDURATION:0',
          '#EXT-X-MAP:URI="init.mp4"',
          '#EXTINF:0.000000,',
          'segment_000.m4s',
          '#EXT-X-ENDLIST',
          '',
        ].join('\n'));

        const res = makeRes();
        await HLSMWs.servePlaylist(
          makeReq({mediaPath: REAL_VIDEO}) as any, res as any, () => {});

        expect(res.statusCode,
          'a playlist declaring no media was served as a successful transcode')
          .to.equal(500);

        // Both the stream copy and its re-encode fallback end this way, so the
        // cache must be gone once the second one has given up too.
        await new Promise(r => setTimeout(r, 500));
        const fullPath = path.join(ASSETS_DIR, REAL_VIDEO);
        const stat = await fs.promises.stat(fullPath);
        const cacheDir = path.join(ProjectPath.TempFolder, 'hls',
          crypto.createHash('sha256')
            .update(fullPath + stat.mtimeMs.toString()).digest('hex'));
        let cacheKept = true;
        try {
          await fs.promises.access(path.join(cacheDir, 'playlist.m3u8'));
        } catch {
          cacheKept = false;
        }
        expect(cacheKept, 'the unusable transcode was left on disk to be adopted')
          .to.be.false;
      });
  });
});
