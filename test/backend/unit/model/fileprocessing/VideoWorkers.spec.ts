import {expect} from 'chai';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import sharp from 'sharp';
import {MediaRendererInput, ThumbnailSourceType, VideoRendererFactory} from '../../../../../src/backend/model/fileaccess/PhotoWorker';
import {VideoConverterInput, VideoConverterWorker} from '../../../../../src/backend/model/fileaccess/VideoConverterWorker';
import {MetadataLoader} from '../../../../../src/backend/model/fileaccess/MetadataLoader';
import {ConfigDiagnostics} from '../../../../../src/backend/model/diagnostics/ConfigDiagnostics';
import {Config} from '../../../../../src/common/config/private/Config';
import {FFmpegPresets, videoResolutionType} from '../../../../../src/common/config/private/PrivateConfig';
import {TestHelper} from '../../../../TestHelper';

const assets = path.join(__dirname, '/../../../assets');

const expectRejection = async (p: Promise<unknown>): Promise<unknown> => {
  try {
    await p;
  } catch (e) {
    return e;
  }
  expect.fail('expected the promise to reject');
};

describe('Video workers (ffmpeg)', () => {
  before(TestHelper.resetConfig);

  let tmpDir: string;
  beforeEach(async () => {
    tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'pg2-video-'));
  });
  afterEach(async () => {
    await fs.promises.rm(tmpDir, {recursive: true, force: true});
  });

  describe('VideoRendererFactory (thumbnail)', () => {
    const render = VideoRendererFactory.build();
    const input = (file: string, size: number, makeSquare: boolean): MediaRendererInput => ({
      type: ThumbnailSourceType.Video,
      mediaPath: path.join(assets, file),
      outPath: path.join(tmpDir, 'thumb ű.jpg'),
      size,
      makeSquare,
      quality: 80,
      useLanczos3: true,
      smartSubsample: false,
      sharpOptions: {},
      animate: false
    });

    it('should render a square thumbnail', async () => {
      const i = input('video.mp4', 32, true);
      await render(i);
      const meta = await sharp(i.outPath).metadata();
      expect(meta.format).to.equal('jpeg');
      expect([meta.width, meta.height]).to.deep.equal([32, 32]);
    });

    it('should keep the aspect ratio when not square', async () => {
      const i = input('video.mp4', 30, false);
      await render(i);
      const meta = await sharp(i.outPath).metadata();
      expect([meta.width, meta.height]).to.deep.equal([40, 30]);
    });

    it('should not upscale when not square', async () => {
      const i = input('video.mp4', 1000, false);
      await render(i);
      const meta = await sharp(i.outPath).metadata();
      expect([meta.width, meta.height]).to.deep.equal([80, 60]);
    });

    it('should render a rotated video', async () => {
      const i = input('video_rotate.mp4', 30, false);
      await render(i);
      const meta = await sharp(i.outPath).metadata();
      expect([meta.width, meta.height]).to.deep.equal([22, 30]);
    });

    it('should reject for a missing file', async () => {
      const i = input('not_existing.mp4', 32, true);
      await expectRejection(render(i));
      expect(fs.existsSync(i.outPath!)).to.be.false;
    });
  });

  describe('VideoConverterWorker', () => {
    const input = (out: string, codec: VideoConverterInput['output']['codec'],
                   format: VideoConverterInput['output']['format']): VideoConverterInput => ({
      videoPath: path.join(assets, 'video.mp4'),
      input: {},
      output: {path: path.join(tmpDir, out), codec, format}
    });

    it('should transcode with every output option', async () => {
      const i = input('out ő.mp4', 'libx264', 'mp4');
      i.input.customOptions = ['-t 2'];
      i.output.bitRate = 100 * 1024;
      i.output.resolution = 30 as videoResolutionType;
      i.output.fps = 10;
      i.output.crf = 30;
      i.output.preset = FFmpegPresets.veryfast;
      i.output.customOptions = ['-movflags +faststart', '-an'];
      const outPath = i.output.path;

      await VideoConverterWorker.convert(i);

      expect(fs.existsSync(outPath)).to.be.true;
      expect(fs.existsSync(outPath + '.part')).to.be.false;
      const meta = await MetadataLoader.loadVideoMetadata(outPath);
      expect(meta.size).to.deep.equal({width: 40, height: 30});
      expect(meta.fps).to.equal(10);
      expect(meta.duration).to.be.within(1500, 2500); // -t 2 as input option (the full video is 13.6s)
    });

    it('should transcode with only the required options', async () => {
      const i = input('out.webm', 'libvpx', 'webm');
      i.input.customOptions = ['-t 1'];
      const outPath = i.output.path;

      await VideoConverterWorker.convert(i);

      const meta = await MetadataLoader.loadVideoMetadata(outPath);
      expect(meta.size).to.deep.equal({width: 80, height: 60});
      expect(meta.fps).to.equal(15);
    });

    it('should reject for an unknown codec', async () => {
      const i = input('bad.mp4', 'no_such_codec' as VideoConverterInput['output']['codec'], 'mp4');
      const outPath = i.output.path;
      await expectRejection(VideoConverterWorker.convert(i));
      expect(fs.existsSync(outPath)).to.be.false;
    });
  });

  describe('ConfigDiagnostics.testVideoConfig', () => {
    it('should find ffmpeg and ffprobe', async () => {
      Config.Media.Video.enabled = true;
      await ConfigDiagnostics.testVideoConfig(Config.Media.Video, Config);
    });
  });
});
