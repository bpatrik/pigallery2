import {FfmpegCommand} from 'fluent-ffmpeg';

/* eslint-disable @typescript-eslint/no-var-requires */
export class FFmpegFactory {
  public static get(): (path?: string) => FfmpegCommand {
    const ffmpeg = require('fluent-ffmpeg');
    try {
      const ffmpegPath = require('ffmpeg-static');
      ffmpeg.setFfmpegPath(ffmpegPath);
      const ffprobePath = require('ffprobe-static');
      ffmpeg.setFfprobePath(ffprobePath.path);
    } catch (e) {
      // ignoring errors
    }
    return ffmpeg;
  }
}
