import {Logger} from '../../Logger';
import {promises as fsp} from 'node:fs';
import {FFmpeg} from '../FFmpeg';
import {FFmpegPresets, videoCodecType, videoFormatType, videoResolutionType,} from '../../../common/config/private/PrivateConfig';
import {ExtensionDecorator} from '../extension/ExtensionDecorator';

export interface VideoConverterInput {
  videoPath: string;
  input: {
    customOptions?: string[];
  };
  output: {
    path: string;
    bitRate?: number;
    resolution?: videoResolutionType;
    fps?: number;
    crf?: number;
    preset?: FFmpegPresets;
    customOptions?: string[];
    codec: videoCodecType;
    format: videoFormatType;
  };
}

export class VideoConverterWorker {

  @ExtensionDecorator(e => e.gallery.VideoConverter.convert)
  public static async convert(input: VideoConverterInput): Promise<void> {
    const origPath = input.output.path;
    input.output.path = origPath + '.part';
    await this._convert(input);
    await fsp.rename(input.output.path, origPath);
  }

  /**
   * ffmpeg arguments in the order fluent-ffmpeg used to build them.
   */
  public static buildArgs(input: VideoConverterInput): string[] {
    const args = [...FFmpeg.splitOptions(input.input.customOptions), '-i', input.videoPath, '-y'];
    if (input.output.bitRate) {
      args.push('-b:v', input.output.bitRate / 1024 + 'k');
    }
    args.push('-vcodec', input.output.codec);
    if (input.output.fps) {
      args.push('-r', '' + input.output.fps);
    }
    if (input.output.resolution) {
      // keeps the aspect ratio with an even width
      args.push('-filter:v', 'scale=w=trunc(oh*a/2)*2:h=' + input.output.resolution);
    }
    // Constant Rate Factor (CRF)
    if (input.output.crf) {
      args.push('-crf', '' + input.output.crf);
    }
    if (input.output.preset) {
      args.push('-preset', FFmpegPresets[input.output.preset]);
    }
    args.push(...FFmpeg.splitOptions(input.output.customOptions));
    // force the output format, the .part extension does not tell it
    args.push('-f', input.output.format, input.output.path);
    return args;
  }

  private static _convert(input: VideoConverterInput): Promise<void> {
    Logger.silly('[FFmpeg] transcoding video: ' + input.videoPath);
    return FFmpeg.run(this.buildArgs(input), {
      onStart: (cmd: string) => Logger.silly('[FFmpeg] running:' + cmd),
      onStderrLine: (line: string) => Logger.debug('[FFmpeg] ' + line)
    });
  }
}
