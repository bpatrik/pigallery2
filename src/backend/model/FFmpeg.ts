import {spawn} from 'child_process';
import * as path from 'path';
import {FFmpegFactory} from './FFmpegFactory';

/**
 * The part of `ffprobe -print_format json -show_format -show_streams` that the app reads.
 * ffprobe prints most numbers as strings.
 */
export interface FfprobeStream {
  codec_type?: string;
  width?: number;
  height?: number;
  duration?: string;
  bit_rate?: string;
  avg_frame_rate?: string;
  side_data_list?: { side_data_type?: string, rotation?: number }[];
  tags?: Record<string, string>;
}

export interface FfprobeFormat {
  duration?: string;
  bit_rate?: string;
  tags?: Record<string, string>;
}

export interface FfprobeData {
  streams: FfprobeStream[];
  format: FfprobeFormat;
}

export interface FFmpegRunOptions {
  /** Called with every line ffmpeg writes to stderr (ffmpeg writes all its output there). */
  onStderrLine?: (line: string) => void;
  /** Called with the full command line before ffmpeg starts. */
  onStart?: (cmd: string) => void;
}

/**
 * Thin wrapper over the ffmpeg and ffprobe executables.
 */
export class FFmpeg {
  /** stderr lines kept for the error message of a failed run */
  private static readonly ERROR_LINES = 20;

  public static async probe(file: string): Promise<FfprobeData> {
    const stdout = await this.spawn(FFmpegFactory.getPaths().ffprobe,
      ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file], {}, true);
    const data = JSON.parse(stdout) as Partial<FfprobeData>;
    return {streams: data.streams || [], format: data.format || {}};
  }

  public static async run(args: string[], options: FFmpegRunOptions = {}): Promise<void> {
    await this.spawn(FFmpegFactory.getPaths().ffmpeg, args, options, false);
  }

  /**
   * Splits each `'-option value'` (exactly two words) into two arguments, so config values like
   * `'-movflags +faststart'` work (fluent-ffmpeg did the same).
   */
  public static splitOptions(options: string[] = []): string[] {
    return options.flatMap((o) => {
      const split = String(o).split(' ');
      return split.length === 2 ? split : [o];
    });
  }

  private static spawn(bin: string, args: string[], options: FFmpegRunOptions, collectStdout: boolean): Promise<string> {
    const cmd = [bin, ...args].join(' ');
    options.onStart?.(cmd);
    return new Promise((resolve, reject) => {
      const proc = spawn(bin, args, {windowsHide: true});
      const stdout: Buffer[] = [];
      const lastLines: string[] = [];
      let partialLine = '';

      const onLine = (line: string): void => {
        if (line.length === 0) {
          return;
        }
        options.onStderrLine?.(line);
        lastLines.push(line);
        if (lastLines.length > this.ERROR_LINES) {
          lastLines.shift();
        }
      };

      proc.stdout.on('data', (chunk: Buffer) => {
        if (collectStdout) {
          stdout.push(chunk);
        }
      });
      proc.stderr.setEncoding('utf8');
      proc.stderr.on('data', (chunk: string) => {
        const lines = (partialLine + chunk).split(/\r\n|\r|\n/);
        partialLine = lines.pop();
        lines.forEach(onLine);
      });
      proc.on('error', (err) => {
        reject(new Error('[FFmpeg] cannot run ' + bin + ': ' + err.message));
      });
      proc.on('close', (code, signal) => {
        onLine(partialLine);
        if (code === 0) {
          return resolve(Buffer.concat(stdout).toString('utf8'));
        }
        reject(new Error('[FFmpeg] ' + path.basename(bin) + ' exited with ' + (signal ? 'signal ' + signal : 'code ' + code) +
          ': ' + lastLines.join('\n') + '\nexecuted: ' + cmd));
      });
    });
  }
}

const path = (bin: string): string => bin.split(/[\\/]/).pop();
