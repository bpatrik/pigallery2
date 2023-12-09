import {Logger} from '../../Logger';
import {promises as fsp} from 'fs';
import {FfmpegCommand} from 'fluent-ffmpeg';
import {FFmpegFactory} from '../FFmpegFactory';
import {FFmpegPresets, videoCodecType, videoFormatType, videoResolutionType,} from '../../../common/config/private/PrivateConfig';

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
  private static ffmpeg = FFmpegFactory.get();

  public static async convert(input: VideoConverterInput): Promise<void> {
    const origPath = input.output.path;
    input.output.path = origPath + '.part';
    await this._convert(input);
    await fsp.rename(input.output.path, origPath);
  }

  private static _convert(input: VideoConverterInput): Promise<void> {
    if (this.ffmpeg == null) {
      this.ffmpeg = FFmpegFactory.get();
    }

    return new Promise((resolve, reject) => {
      Logger.silly('[FFmpeg] transcoding video: ' + input.videoPath);

      const command: FfmpegCommand = this.ffmpeg(input.videoPath);
      let executedCmd = '';
      command
          .on('start', (cmd: string) => {
            Logger.silly('[FFmpeg] running:' + cmd);
            executedCmd = cmd;
          })
          .on('end', () => {
            resolve();
          })
          .on('error', (e: any) => {
            reject('[FFmpeg] ' + e.toString() + ' executed: ' + executedCmd);
          })
          .on('stderr', function(line: string) {
            // Although this is under `stderr` event, all of ffmpeg output come here.
            Logger.debug('[FFmpeg] ' + line);
          });

      // set custom input options
      if (input.input.customOptions) {
        command.inputOptions(input.input.customOptions);
      }
      // set video bitrate
      if (input.output.bitRate) {
        command.videoBitrate(input.output.bitRate / 1024 + 'k');
      }
      // set target codec
      command.videoCodec(input.output.codec);
      if (input.output.resolution) {
        command.size('?x' + input.output.resolution);
      }

      // set fps
      if (input.output.fps) {
        command.fps(input.output.fps);
      }

      // set Constant Rate Factor (CRF)
      if (input.output.crf) {
        command.addOption(['-crf ' + input.output.crf]);
      }

      // set preset
      if (input.output.preset) {
        command.addOption(['-preset ' + FFmpegPresets[input.output.preset]]);
      }
      // set any additional commands
      if (input.output.customOptions) {
        command.addOption(input.output.customOptions);
      }

      // set output format to force
      command
          .format(input.output.format)
          // save to file
          .save(input.output.path);
    });
  }
}

