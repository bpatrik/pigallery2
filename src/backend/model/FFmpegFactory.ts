export interface FFmpegPaths {
  ffmpeg: string;
  ffprobe: string;
}

export class FFmpegFactory {
  private static paths: FFmpegPaths | null = null;

  /**
   * Paths of the ffmpeg and ffprobe executables.
   * Prefers the optional ffmpeg-static/ffprobe-static packages, then FFMPEG_PATH/FFPROBE_PATH, then the PATH.
   */
  public static getPaths(): FFmpegPaths {
    if (this.paths === null) {
      this.paths = {
        ffmpeg: this.requirePath(() => require('ffmpeg-static') as string) || process.env['FFMPEG_PATH'] || 'ffmpeg',
        ffprobe: this.requirePath(() => (require('ffprobe-static') as { path: string }).path) || process.env['FFPROBE_PATH'] || 'ffprobe'
      };
    }
    return this.paths;
  }

  private static requirePath(load: () => string): string | null {
    try {
      return load();
    } catch {
      return null; // the optional package is not installed
    }
  }
}
