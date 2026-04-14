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
      .addOption('-preset', 'veryfast')
      .addOption('-crf', '23')
      .addOption('-b:a', '128k')
      .addOption('-ac', '2')
      // Force an IDR keyframe every SEGMENT_DURATION_SEC seconds so FFmpeg can
      // always cut at the requested boundary. Without this, segments follow the
      // source file's keyframe spacing (often 10-15 s for RealMedia), which means
      // TARGETDURATION is double hls_time and each segment takes longer to produce.
      .addOption(
        '-force_key_frames',
        `expr:gte(t,n_forced*${SEGMENT_DURATION_SEC})`
      );
  }

  cmd
    // avoid_negative_ts must be an OUTPUT option (muxer-level flag)
    .addOption('-avoid_negative_ts', 'make_zero')
    .addOption('-hls_time', String(SEGMENT_DURATION_SEC))
    .addOption('-hls_list_size', '0')
    .addOption('-hls_playlist_type', 'event')
    .addOption('-hls_init_time', '0')
    .addOption('-hls_segment_type', 'fmp4')
    .addOption('-hls_segment_filename', segmentPattern)
    .addOption('-hls_flags', 'independent_segments+discont_start')
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
  if (existing) {
    if (!existing.done) return existing;
    // done=true: verify the playlist still exists on disk
    // (could have been deleted by TempFolderCleaningJob or manually)
    try {
      await fsp.access(path.join(cacheDir, 'playlist.m3u8'));
      return existing;
    } catch {
      activeJobs.delete(cacheDir);
      // fall through to re-transcode
    }
  }

  // Cache already on disk (from a previous server run)
  const playlistPath = path.join(cacheDir, 'playlist.m3u8');
  try {
    const content = await fsp.readFile(playlistPath, 'utf8');
    if (content.includes('#EXT-X-ENDLIST')) {
      // Complete cached transcode — serve instantly
      const {duration} = await detectCodecs(fullMediaPath);
      const segmentCount = Math.ceil(duration / SEGMENT_DURATION_SEC);
      const job: HLSJob = {cacheDir, duration, segmentCount, command: null, done: true};
      activeJobs.set(cacheDir, job);
      return job;
    }
    // Incomplete playlist (interrupted transcode) — delete and re-transcode
    await fsp.rm(cacheDir, {recursive: true, force: true});
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

function countSegments(content: string): number {
  return content
    .split('\n')
    .filter(l => {const t = l.trim(); return t.length > 0 && !t.startsWith('#');})
    .length;
}

// Minimum segments to deliver on the FIRST response. hls.js treats a 1-segment
// EVENT playlist as a barely-keeping-up live stream and waits ~10 s before asking
// again. With 3 segments (18 s of content) it pre-buffers eagerly and re-polls
// immediately. If FFmpeg hasn't produced 3 segments within FIRST_RESPONSE_WAIT_MS
// we return whatever is available (at least 1 segment).
const FIRST_RESPONSE_MIN_SEGMENTS = 3;
const FIRST_RESPONSE_WAIT_MS = 3_000; // max extra wait for first response

/**
 * Long-poll: blocks until the playlist has MORE segments than it did when the
 * request arrived (or until ENDLIST is written).
 *
 * - First call (initialCount=0): waits until min(FIRST_RESPONSE_MIN_SEGMENTS,
 *   whatever is available) segments exist, ensuring hls.js pre-buffers eagerly.
 * - Subsequent calls (hls.js re-poll, initialCount>0): returns the moment a
 *   new segment appears — pushes the response as soon as FFmpeg is done,
 *   eliminating hls.js's poll-interval lag entirely.
 */
async function waitForNewContent(cacheDir: string, requiredCount = 0): Promise<boolean> {
  const playlistPath = path.join(cacheDir, 'playlist.m3u8');
  const initPath = path.join(cacheDir, 'init.mp4');

  // Snapshot current state at request-arrival time
  let initialCount = requiredCount;
  let initExists = false;
  try {
    const content = await fsp.readFile(playlistPath, 'utf8');
    if (content.includes('#EXT-X-ENDLIST')) return true;
    const current = countSegments(content);
    if (requiredCount === 0) initialCount = 0; // first load: want ≥ FIRST_RESPONSE_MIN_SEGMENTS
    else initialCount = Math.max(requiredCount, current); // re-poll: want at least one more
  } catch { /* playlist not yet created */ }
  try { await fsp.access(initPath); initExists = true; } catch { /* not yet */ }

  // For the first response, try to accumulate FIRST_RESPONSE_MIN_SEGMENTS before
  // responding, but don't wait longer than FIRST_RESPONSE_WAIT_MS from the time
  // the first segment appears.
  let firstSegmentSeenAt = 0;
  const deadline = Date.now() + SEGMENT_WAIT_TIMEOUT_MS;

  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, SEGMENT_POLL_INTERVAL_MS));
    try {
      const content = await fsp.readFile(playlistPath, 'utf8');
      if (content.includes('#EXT-X-ENDLIST')) return true;
      const newCount = countSegments(content);

      // Ensure init.mp4 exists before we respond
      if (!initExists) {
        try { await fsp.access(initPath); initExists = true; } catch { continue; }
      }

      if (newCount > 0 && firstSegmentSeenAt === 0) firstSegmentSeenAt = Date.now();

      const isFirstLoad = requiredCount === 0;
      if (isFirstLoad) {
        // Wait for FIRST_RESPONSE_MIN_SEGMENTS unless we've already waited
        // FIRST_RESPONSE_WAIT_MS since the first segment appeared.
        const waitedEnough = firstSegmentSeenAt > 0 &&
          Date.now() - firstSegmentSeenAt >= FIRST_RESPONSE_WAIT_MS;
        if (newCount >= FIRST_RESPONSE_MIN_SEGMENTS || waitedEnough && newCount >= 1) {
          return true;
        }
      } else {
        // Re-poll: return as soon as we have more than we started with
        if (newCount > initialCount) return true;
      }
    } catch { /* keep polling */ }
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

      if (job.done) {
        // Complete cached transcode — serve instantly, no special cache headers needed
        // (URL already contains SHA256 hash so it's effectively immutable)
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.sendFile(playlistPath);
        return;
      }

      // Long-poll: hold the connection until FFmpeg writes a new segment (or ENDLIST).
      // This eliminates hls.js's fixed poll interval lag — the server responds the
      // moment new content is available (~100 ms after FFmpeg flushes the segment).
      const ready = await waitForNewContent(job.cacheDir);
      if (!ready) {
        res.status(503).json({message: 'Playlist not ready in time'});
        return;
      }

      // Read the file ourselves and use res.send() instead of sendFile() so
      // Express does NOT generate an ETag. With sendFile + ETag, browsers send
      // If-None-Match on re-polls and get 304 Not Modified — hls.js stalls because
      // it sees no new segments. With res.send() there is no ETag, so every
      // re-poll gets a fresh 200 with the current playlist content.
      const content = await fsp.readFile(playlistPath, 'utf8');
      res.setHeader('Cache-Control', 'no-cache, no-store');
      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      res.send(content);
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
