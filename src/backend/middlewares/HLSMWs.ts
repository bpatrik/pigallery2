import * as path from 'path';
import * as crypto from 'crypto';
import {promises as fsp} from 'fs';
import {NextFunction, Request, Response} from 'express';
import {FfmpegCommand} from 'fluent-ffmpeg';
import {ProjectPath} from '../ProjectPath';
import {Config} from '../../common/config/private/Config';
import {FFmpegFactory} from '../model/FFmpegFactory';

const SEGMENT_DURATION_SEC = 6;
const SEGMENT_WAIT_TIMEOUT_MS = 30_000;
const SEGMENT_POLL_INTERVAL_MS = 100;

interface HLSJob {
  cacheDir: string;
  duration: number;
  segmentCount: number;
  command: FfmpegCommand | null;
  done: boolean;
}

const activeJobs = new Map<string, HLSJob>();

async function detectCodecs(
  videoPath: string
): Promise<{video: string; audio: string; duration: number}> {
  return new Promise((resolve, reject) => {
    const ffmpeg = FFmpegFactory.get();
    (ffmpeg as any).ffprobe(videoPath, (err: Error, data: any) => {
      if (err) return reject(err);
      let video = '';
      let audio = '';
      let duration = 0;
      for (const stream of data.streams || []) {
        if (stream.codec_type === 'video' && !video) {
          video = stream.codec_name || '';
          if (!duration && stream.duration) {
            duration = parseFloat(stream.duration);
          }
        }
        if (stream.codec_type === 'audio' && !audio) {
          audio = stream.codec_name || '';
        }
      }
      if (!duration && data.format?.duration) {
        duration = parseFloat(data.format.duration);
      }
      resolve({video, audio, duration});
    });
  });
}

function spawnHLSJob(
  inputPath: string,
  cacheDir: string,
  transmuxMode: boolean
): FfmpegCommand {
  const ffmpeg = FFmpegFactory.get();
  const outputPlaylist = path.join(cacheDir, 'playlist.m3u8');
  const segmentPattern = path.join(cacheDir, 'segment_%03d.m4s');

  const cmd: FfmpegCommand = ffmpeg(inputPath);

  if (transmuxMode) {
    cmd.videoCodec('copy').audioCodec('copy');
  } else {
    cmd
      .videoCodec('libx264')
      .audioCodec('aac')
      .addOption('-preset', 'fast')
      .addOption('-crf', '23')
      .addOption('-b:a', '128k')
      .addOption('-ac', '2');
  }

  cmd
    // avoid_negative_ts must be an OUTPUT option (muxer-level flag)
    .addOption('-avoid_negative_ts', 'make_zero')
    .addOption('-hls_time', String(SEGMENT_DURATION_SEC))
    .addOption('-hls_list_size', '0')
    .addOption('-hls_segment_type', 'fmp4')
    .addOption('-hls_segment_filename', segmentPattern)
    .addOption('-hls_flags', 'independent_segments')
    .on('start', (cmdLine: string) => {
      console.log('[HLSMWs] FFmpeg started:', cmdLine);
    })
    .on('end', () => {
      const job = activeJobs.get(cacheDir);
      if (job) job.done = true;
    })
    .on('error', (err: Error) => {
      console.error('[HLSMWs] FFmpeg error for ' + inputPath + ':', err.message);
    })
    .save(outputPlaylist);

  return cmd;
}

async function getOrStartJob(fullMediaPath: string): Promise<HLSJob> {
  const stat = await fsp.stat(fullMediaPath);
  const hashInput = fullMediaPath + stat.mtimeMs.toString();
  const hash = crypto.createHash('sha256').update(hashInput).digest('hex');
  const cacheDir = path.join(ProjectPath.TempFolder, 'hls', hash);

  const existing = activeJobs.get(cacheDir);
  if (existing) return existing;

  // Cache already on disk (from a previous server run)
  const playlistPath = path.join(cacheDir, 'playlist.m3u8');
  try {
    await fsp.access(playlistPath);
    const {duration} = await detectCodecs(fullMediaPath);
    const segmentCount = Math.ceil(duration / SEGMENT_DURATION_SEC);
    const job: HLSJob = {cacheDir, duration, segmentCount, command: null, done: true};
    activeJobs.set(cacheDir, job);
    return job;
  } catch {
    // not cached yet — fall through
  }

  const {video, audio, duration} = await detectCodecs(fullMediaPath);
  const segmentCount = Math.ceil(duration / SEGMENT_DURATION_SEC);

  await fsp.mkdir(cacheDir, {recursive: true});

  const transmuxMode = video === 'h264' && (audio === 'aac' || audio === 'mp3');
  const cmd = spawnHLSJob(fullMediaPath, cacheDir, transmuxMode);

  const job: HLSJob = {cacheDir, duration, segmentCount, command: cmd, done: false};
  activeJobs.set(cacheDir, job);
  return job;
}

/** Parse segment filenames out of FFmpeg's generated M3U8 playlist */
function parseSegmentFilenames(m3u8: string): string[] {
  return m3u8
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0 && !l.startsWith('#'));
}

async function waitForFile(filePath: string): Promise<boolean> {
  const deadline = Date.now() + SEGMENT_WAIT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      await fsp.access(filePath);
      return true;
    } catch {
      await new Promise(r => setTimeout(r, SEGMENT_POLL_INTERVAL_MS));
    }
  }
  return false;
}

const PLAYLIST_COMPLETE_TIMEOUT_MS = 5 * 60_000; // 5 min max for long videos

/** Wait until FFmpeg writes EXT-X-ENDLIST into the playlist (all segments done). */
async function waitForPlaylistComplete(playlistPath: string): Promise<boolean> {
  const deadline = Date.now() + PLAYLIST_COMPLETE_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const content = await fsp.readFile(playlistPath, 'utf8');
      if (content.includes('#EXT-X-ENDLIST')) return true;
    } catch {
      // file not written yet
    }
    await new Promise(r => setTimeout(r, SEGMENT_POLL_INTERVAL_MS));
  }
  return false;
}

export class HLSMWs {
  public static checkEnabled(req: Request, res: Response, next: NextFunction): void {
    if (!Config.Media.Video.liveVideoTranscodingEnabled) {
      res.status(404).json({message: 'Live video transcoding is not enabled'});
      return;
    }
    next();
  }

  public static async servePlaylist(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const mediaPath = req.params['mediaPath'] as string;
      const fullMediaPath = path.join(ProjectPath.ImageFolder, mediaPath);

      const job = await getOrStartJob(fullMediaPath);
      const {duration, segmentCount} = job;

      const playlistPath = path.join(job.cacheDir, 'playlist.m3u8');

      // Wait for FFmpeg to complete the playlist (EXT-X-ENDLIST written).
      // In transmux mode (most RM/MKV) this completes in seconds.
      // The playlist has accurate EXTINF durations matching fMP4 tfdt values,
      // so hls.js calculates seek positions correctly.
      const ready = await waitForPlaylistComplete(playlistPath);
      if (!ready) {
        res.status(503).json({message: 'Playlist not ready in time'});
        return;
      }

      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      res.sendFile(playlistPath);
    } catch (err) {
      next(err);
    }
  }

  public static async serveSegmentFile(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const mediaPath = req.params['mediaPath'] as string;
      const filename = req.params['filename'] as string;
      const fullMediaPath = path.join(ProjectPath.ImageFolder, mediaPath);

      const job = await getOrStartJob(fullMediaPath);
      const filePath = path.join(job.cacheDir, filename);

      const ready = await waitForFile(filePath);
      if (!ready) {
        res.status(503).json({message: 'Segment not ready in time'});
        return;
      }

      const isInit = filename === 'init.mp4';
      res.setHeader('Content-Type', isInit ? 'video/mp4' : 'video/iso.segment');
      res.sendFile(filePath);
    } catch (err) {
      next(err);
    }
  }

  public static killAllJobs(): void {
    for (const job of activeJobs.values()) {
      if (job.command && !job.done) {
        try {
          job.command.kill('SIGTERM');
        } catch {
          // ignore
        }
      }
    }
    activeJobs.clear();
  }

  public static get HLSCacheDir(): string {
    return path.join(ProjectPath.TempFolder, 'hls');
  }
}
