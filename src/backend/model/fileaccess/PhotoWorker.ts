/* eslint-disable @typescript-eslint/no-var-requires */
import * as sharp from 'sharp';
import {Metadata, Sharp, SharpOptions} from 'sharp';
import {Logger} from '../../Logger';
import {FfmpegCommand, FfprobeData} from 'fluent-ffmpeg';
import {FFmpegFactory} from '../FFmpegFactory';
import * as path from 'path';
import {ExtensionDecorator} from '../extension/ExtensionDecorator';


sharp.cache(false);

export class PhotoWorker {
  private static videoRenderer: (input: MediaRendererInput) => Promise<void> = null;

  public static render(input: SvgRendererInput | MediaRendererInput): Promise<void> {
    if (input.type === ThumbnailSourceType.Photo) {
      return this.renderFromImage(input);
    }
    if (input.type === ThumbnailSourceType.Video) {
      return this.renderFromVideo(input as MediaRendererInput);
    }
    throw new Error('Unsupported media type to render thumbnail:' + input.type);
  }

  public static renderFromImage(input: SvgRendererInput | MediaRendererInput, dryRun = false): Promise<void> {
    return ImageRendererFactory.render(input, dryRun);
  }

  public static renderFromVideo(input: MediaRendererInput): Promise<void> {
    if (PhotoWorker.videoRenderer === null) {
      PhotoWorker.videoRenderer = VideoRendererFactory.build();
    }
    return PhotoWorker.videoRenderer(input);
  }
}

export enum ThumbnailSourceType {
  Photo = 1,
  Video = 2,
}

interface RendererInput {
  type: ThumbnailSourceType;
  size: number;
  makeSquare?: boolean;
  outPath?: string;
  quality: number;
  useLanczos3: boolean;
  cut?: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
}

export interface MediaRendererInput extends RendererInput {
  mediaPath: string;
  smartSubsample: boolean;
  sharpOptions: SharpOptions;
  animate: boolean; // animates the output. Used for Gifs
}

export interface SvgRendererInput extends RendererInput {
  svgString: string;
}

export class VideoRendererFactory {
  public static build(): (input: MediaRendererInput) => Promise<void> {
    const ffmpeg = FFmpegFactory.get();
    return (input: MediaRendererInput): Promise<void> => {
      return new Promise((resolve, reject): void => {
        Logger.silly('[FFmpeg] rendering thumbnail: ' + input.mediaPath);

        ffmpeg(input.mediaPath).ffprobe((err: Error, data: FfprobeData): void => {
          if (!!err || data === null) {
            return reject('[FFmpeg] ' + err.toString());
          }

          let width = null;
          let height = null;
          for (const stream of data.streams) {
            if (stream.width && stream.height && !isNaN(stream.width) && !isNaN(stream.height)) {
              width = stream.width;
              height = stream.height;
              break;
            }
          }
          if (!width || !height || isNaN(width) || isNaN(height)) {
            return reject(`[FFmpeg] Can not read video dimension. Found: ${{width}}x${{height}}`);
          }
          const command: FfmpegCommand = ffmpeg(input.mediaPath);
          const fileName = path.basename(input.outPath);
          const folder = path.dirname(input.outPath);
          let executedCmd = '';
          command
            .on('start', (cmd): void => {
              executedCmd = cmd;
            })
            .on('end', (): void => {
              resolve();
            })
            .on('error', (e): void => {
              reject('[FFmpeg] ' + e.toString() + ' executed: ' + executedCmd);
            })
            .outputOptions(['-qscale:v 50']);
          if (input.makeSquare === false) {
            const newSize =
              width < height
                ? Math.min(input.size, width) + 'x?'
                : '?x' + Math.min(input.size, height);
            command.takeScreenshots({
              timemarks: ['10%'],
              size: newSize,
              filename: fileName,
              folder,
            });
          } else {
            command.takeScreenshots({
              timemarks: ['10%'],
              size: input.size + 'x' + input.size,
              filename: fileName,
              folder,
            });
          }
        });
      });
    };
  }
}

export class ImageRendererFactory {

  @ExtensionDecorator(e => e.gallery.ImageRenderer.render)
  public static async render(input: MediaRendererInput | SvgRendererInput, dryRun = false): Promise<void> {

    let image: Sharp;
    if ((input as MediaRendererInput).mediaPath) {
      Logger.silly(
        '[SharpRenderer] rendering photo:' +
        (input as MediaRendererInput).mediaPath +
        ', size:' +
        input.size
      );
      image = sharp((input as MediaRendererInput).mediaPath, {
        failOnError: false,
        animated: (input as MediaRendererInput).animate, ...((input as MediaRendererInput).sharpOptions || {})
      });
    } else {
      const svg_buffer = Buffer.from((input as SvgRendererInput).svgString);
      image = sharp(svg_buffer, {density: 450});
    }
    image.rotate();
    const metadata: Metadata = await image.metadata();
    const kernel =
      input.useLanczos3 === true
        ? sharp.kernel.lanczos3
        : sharp.kernel.nearest;

    if (input.cut) {
      image.extract(input.cut);
    }
    // size 0 means keep original dimensions (full-res conversion)
    if (input.size > 0) {
      if (input.makeSquare === false) {
        if (metadata.height > metadata.width) {
          image.resize(Math.min(input.size, metadata.width), null, {
            kernel,
          });
        } else {
          image.resize(null, Math.min(input.size, metadata.height), {
            kernel,
          });
        }
      } else {
        image.resize(input.size, input.size, {
          kernel,
          position: sharp.gravity.centre,
          fit: 'cover',
        });
      }
    }
    let processedImg: sharp.Sharp;
    if ((input as MediaRendererInput).mediaPath) {
      processedImg = image.webp({
        effort: 6,
        quality: input.quality,
        smartSubsample: (input as MediaRendererInput).smartSubsample
      });
    } else {
      if ((input as SvgRendererInput).svgString) {
        processedImg = image.png({effort: 6, quality: input.quality});
      }
    }
    // do not save to file
    if (dryRun) {
      await processedImg.toFormat('webp').toBuffer();
      return;
    }
    await processedImg.toFile(input.outPath);

  }
}
