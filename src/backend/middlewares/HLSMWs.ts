import * as path from 'path';
import * as crypto from 'crypto';
import {promises as fsp} from 'fs';
import {NextFunction, Request, Response} from 'express';
import {FfmpegCommand} from 'fluent-ffmpeg';
import {ProjectPath} from '../ProjectPath';
import {Config} from '../../common/config/private/Config';
import {FFmpegFactory} from '../model/FFmpegFactory';
import {Logger} from '../Logger';

const SEGMENT_DURATION_SEC = 6;
const SEGMENT_WAIT_TIMEOUT_MS = 30_000;
const SEGMENT_POLL_INTERVAL_MS = 100;

interface HLSJob {
  cacheDir: string;
  duration: number;
  segmentCount: number;
  command: FfmpegCommand | null;
  done: boolean;
  // FFmpeg produced no usable output — whether it crashed or exited 0 with a
  // playlist that declares no media. Distinct from `done`: a failed job must
  // never be served, and must never be adopted from disk on a later request.
  failed: boolean;
}

const activeJobs = new Map<string, HLSJob>();

/**
 * Is a playlist a transcode we can actually serve?
 *
 * `#EXT-X-ENDLIST` alone is not the answer, which is the trap this function
 * exists for: the HLS muxer writes ENDLIST on its way out even when FFmpeg
 * aborts mid-stream. A crashed `-c copy` therefore leaves behind a playlist
 * that looks finished, and treating ENDLIST as "complete" makes the wreckage
 * permanent — it is re-served on every later request and survives restarts.
 *
 * The one thing that actually distinguishes wreckage from a stream is whether
 * any segment declares real media. Copying from a container that carries no
 * packet timestamps (AVI) produces `#EXTINF:0.000000` — which hls.js reads as
 * a complete playlist containing nothing, and stalls on forever.
 *
 * TARGETDURATION is deliberately NOT part of this test. FFmpeg rounds it to
 * the nearest integer, so every transcode shorter than 0.5 s is written as
 * `#EXT-X-TARGETDURATION:0` with perfectly good segments beside it. Requiring
 * a non-zero value here rejected those as broken; see normalizeTargetDuration.
 */
function isUsablePlaylist(content: string): boolean {
  if (!content.includes('#EXT-X-ENDLIST')) {
    return false;
  }
  for (const raw of content.split('\n')) {
    const line = raw.trim();
    if (line.startsWith('#EXTINF:') &&
        parseFloat(line.substring('#EXTINF:'.length)) > 0) {
      return true;
    }
  }
  return false;
}

/**
 * `#EXT-X-TARGETDURATION:0` is out of spec — RFC 8216 §4.3.3.1 requires that
 * no segment exceed it, and a 0.34 s segment does. FFmpeg emits it anyway for
 * any output under half a second, because it rounds rather than ceils.
 *
 * hls.js clamps the value back to 1 and plays such a playlist regardless, so
 * this is not what breaks playback. It is rewritten because nothing else in
 * the chain — Safari's native HLS on the `canPlayType` path, a proxy, a future
 * hls.js — is obliged to be that forgiving, and 1 is correct for every segment
 * this can apply to.
 *
 * Only the literal 0 is touched. Any other value is FFmpeg's own rounding of a
 * real segment length and must be left alone.
 */
function normalizeTargetDuration(content: string): string {
  return content.replace(/#EXT-X-TARGETDURATION:0(?!\d)/, '#EXT-X-TARGETDURATION:1');
}

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
  transmuxMode: boolean,
  onError: (err: Error) => void
): FfmpegCommand {
  const ffmpeg = FFmpegFactory.get();
  const outputPlaylist = path.join(cacheDir, 'playlist.m3u8');
  const segmentPattern = path.join(cacheDir, 'segment_%03d.m4s');

  const cmd: FfmpegCommand = ffmpeg(inputPath)
    // Reconstruct missing presentation timestamps at the DEMUXER, before any
    // muxing decision is made. An input option, so it must be added here and
    // not below with the output flags.
    //
    // AVI records a global frame rate in its header and no per-packet PTS/DTS.
    // With `-c copy` there is no decoder in the pipeline to derive them, so
    // FFmpeg hands the fMP4 muxer packets with unset timestamps ("pts has no
    // value", repeated once per frame) and the muxer, having no durations to
    // add up, emits `#EXT-X-TARGETDURATION:0` and a single `#EXTINF:0.000000`.
    // +genpts makes the demuxer generate them from the header frame rate.
    //
    // Harmless where timestamps already exist — mp4/mkv/ts are unaffected.
    .inputOptions(['-fflags', '+genpts']);

  if (transmuxMode) {
    cmd.videoCodec('copy').audioCodec('copy')
      // MPEG-TS carries AAC in ADTS framing, which fMP4 cannot hold: the muxer
      // refuses with "Malformed AAC bitstream detected: use the audio bitstream
      // filter 'aac_adtstoasc'" and the whole job dies after a handful of
      // frames. The filter rewrites ADTS headers into the AudioSpecificConfig
      // form fMP4 wants.
      //
      // Unconditional on purpose: it keys off the ADTS syncword and passes
      // non-ADTS packets through untouched, so it is a no-op for the inputs
      // that never needed it.
      .addOption('-bsf:a', 'aac_adtstoasc');
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
      Logger.debug('[HLSMWs] FFmpeg started:', cmdLine);
    })
    .on('end', () => {
      // Exit 0 is not the same as "produced something playable". FFmpeg can
      // finish cleanly on an input whose video stream it could not read and
      // still write a playlist that declares no media; `.on('error')` never
      // fires for that. `done` was set regardless, so the wreck was served —
      // and then rejected on adoption at the next restart. The validation
      // existed, just not on the path that creates the file.
      void (async () => {
        const job = activeJobs.get(cacheDir);
        if (!job) {
          return;
        }
        const playlistPath = path.join(cacheDir, 'playlist.m3u8');
        try {
          const content = await fsp.readFile(playlistPath, 'utf8');
          if (!isUsablePlaylist(content)) {
            // Routed through onError rather than failing here, so that a
            // stream copy which ends this way still gets its re-encode
            // fallback — the same second chance a crashing copy gets.
            Logger.error('[HLSMWs] FFmpeg exited 0 with no playable output for '
              + inputPath);
            onError(new Error('no playable output'));
            return;
          }
          const fixed = normalizeTargetDuration(content);
          if (fixed !== content) {
            await fsp.writeFile(playlistPath, fixed);
          }
          job.done = true;
        } catch (e) {
          Logger.error('[HLSMWs] could not validate the finished playlist for '
            + inputPath + ':', e);
          onError(e instanceof Error ? e : new Error(String(e)));
        }
      })();
    })
    .on('error', (err: Error) => {
      Logger.error('[HLSMWs] FFmpeg error for ' + inputPath + ':', err.message);
      onError(err);
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
    if (isUsablePlaylist(content)) {
      // Complete cached transcode — serve instantly
      const {duration} = await detectCodecs(fullMediaPath);
      const segmentCount = Math.ceil(duration / SEGMENT_DURATION_SEC);
      const job: HLSJob = {
        cacheDir, duration, segmentCount, command: null, done: true, failed: false,
      };
      activeJobs.set(cacheDir, job);
      return job;
    }
    // Either an interrupted transcode (no ENDLIST) or one that finished-looking
    // but declares no playable media (a crashed `-c copy`). Neither can be
    // served, and adopting the second kind is what made a broken stream
    // permanent. Delete and re-transcode.
    await fsp.rm(cacheDir, {recursive: true, force: true});
  } catch {
    // not cached yet — fall through
  }

  const {video, audio, duration} = await detectCodecs(fullMediaPath);
  const segmentCount = Math.ceil(duration / SEGMENT_DURATION_SEC);

  await fsp.mkdir(cacheDir, {recursive: true});

  const job: HLSJob = {
    cacheDir, duration, segmentCount, command: null, done: false, failed: false,
  };
  activeJobs.set(cacheDir, job);

  // Codec names are not enough to decide whether `-c copy` will work, and this
  // check used to be the whole decision. Two things it cannot see also decide
  // it: whether the container carries per-packet timestamps, and how the
  // elementary stream is framed. h264+aac in an AVI and in an MPEG-TS both pass
  // this test and both used to fail — differently.
  //
  // So the fast path is now an attempt rather than a prediction: try it, and
  // when FFmpeg actually fails, fall back to the full re-encode that works for
  // everything. A client already long-polling the playlist sees only a slightly
  // later first segment; it does not need to know which path produced it.
  const start: (transmux: boolean) => void = (transmux) => {
    job.command = spawnHLSJob(fullMediaPath, cacheDir, transmux, () => {
      void (async () => {
        // Remove the partial output before anything can adopt it: the HLS muxer
        // writes #EXT-X-ENDLIST even when FFmpeg aborts, so what is on disk
        // right now looks like a finished transcode to getOrStartJob.
        try {
          await fsp.rm(cacheDir, {recursive: true, force: true});
        } catch {
          // Already gone, or never created. Either is fine.
        }
        if (transmux) {
          Logger.warn('[HLSMWs] stream copy failed for ' + fullMediaPath
            + ' — falling back to a full re-encode');
          try {
            await fsp.mkdir(cacheDir, {recursive: true});
            start(false);
            return;
          } catch (e) {
            Logger.error('[HLSMWs] could not start the re-encode fallback for '
              + fullMediaPath + ': ' + e);
          }
        }
        // Re-encoding failed too (or could not be started). Mark the job so the
        // request handlers answer with an error instead of serving whatever
        // FFmpeg left behind.
        job.failed = true;
      })();
    });
  };
  start(video === 'h264' && (audio === 'aac' || audio === 'mp3'));
  return job;
}

async function waitForFile(filePath: string, job: HLSJob): Promise<boolean> {
  const deadline = Date.now() + SEGMENT_WAIT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    // A failed job will never produce the file. Without this the request sat
    // out the full SEGMENT_WAIT_TIMEOUT_MS and then reported a timeout, which
    // reads as "slow" rather than "this cannot be transcoded".
    if (job.failed) {
      return false;
    }
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
async function waitForNewContent(job: HLSJob, knownSegmentCount = 0): Promise<boolean> {
  const cacheDir = job.cacheDir;
  const playlistPath = path.join(cacheDir, 'playlist.m3u8');
  const initPath = path.join(cacheDir, 'init.mp4');

  // Snapshot segment count at request-arrival time so re-polls detect new ones
  let baselineCount = knownSegmentCount;
  let initExists = false;
  try {
    const content = await fsp.readFile(playlistPath, 'utf8');
    if (content.includes('#EXT-X-ENDLIST')) return true;
    // Re-poll: treat the live segment count as the minimum to beat
    if (knownSegmentCount > 0) baselineCount = Math.max(knownSegmentCount, countSegments(content));
  } catch { /* playlist not yet created */ }
  try { await fsp.access(initPath); initExists = true; } catch { /* not yet */ }

  // For the first response, accumulate FIRST_RESPONSE_MIN_SEGMENTS before
  // responding, but cap the extra wait at FIRST_RESPONSE_WAIT_MS after the
  // first segment appears.
  const isFirstLoad = knownSegmentCount === 0;
  let firstSegmentSeenAt = 0;
  const deadline = Date.now() + SEGMENT_WAIT_TIMEOUT_MS;

  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, SEGMENT_POLL_INTERVAL_MS));
    // See waitForFile: stop waiting for output that is never coming. Note this
    // is NOT reached during the re-encode fallback — that path deletes and
    // recreates the cache dir without setting `failed`, so the loop's ENOENT
    // catch below keeps it polling and the client transparently picks up the
    // fallback's segments.
    if (job.failed) return false;
    try {
      const content = await fsp.readFile(playlistPath, 'utf8');
      if (content.includes('#EXT-X-ENDLIST')) return true;
      const newCount = countSegments(content);

      // Ensure init.mp4 exists before we respond
      if (!initExists) {
        try { await fsp.access(initPath); initExists = true; } catch { continue; }
      }

      if (newCount > 0 && firstSegmentSeenAt === 0) firstSegmentSeenAt = Date.now();

      if (isFirstLoad) {
        // Wait for FIRST_RESPONSE_MIN_SEGMENTS unless FIRST_RESPONSE_WAIT_MS elapsed
        const waitedEnough = firstSegmentSeenAt > 0 &&
          Date.now() - firstSegmentSeenAt >= FIRST_RESPONSE_WAIT_MS;
        if (newCount >= FIRST_RESPONSE_MIN_SEGMENTS || (waitedEnough && newCount >= 1)) {
          return true;
        }
      } else {
        // Re-poll: return as soon as at least one new segment arrived
        if (newCount > baselineCount) return true;
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

      if (job.failed) {
        // FFmpeg could not produce a stream for this file, stream copy and
        // re-encode both. Answering 500 is the point: this used to be a 200
        // carrying whatever FFmpeg wrote before it died.
        res.status(500).json({message: 'Video could not be transcoded'});
        return;
      }

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
      const ready = await waitForNewContent(job);
      if (!ready) {
        if (job.failed) {
          res.status(500).json({message: 'Video could not be transcoded'});
        } else {
          res.status(503).json({message: 'Playlist not ready in time'});
        }
        return;
      }

      // Read the file ourselves and use res.send() instead of sendFile() so
      // Express does NOT generate an ETag. With sendFile + ETag, browsers send
      // If-None-Match on re-polls and get 304 Not Modified — hls.js stalls because
      // it sees no new segments. With res.send() there is no ETag, so every
      // re-poll gets a fresh 200 with the current playlist content.
      const content = await fsp.readFile(playlistPath, 'utf8');

      // waitForNewContent returns the moment it sees ENDLIST, which can be
      // before the `.on('end')` handler above has finished validating what
      // FFmpeg wrote. Validate the bytes we are about to send rather than
      // trusting a flag that may be one tick behind.
      if (content.includes('#EXT-X-ENDLIST') && !isUsablePlaylist(content)) {
        res.status(500).json({message: 'Video could not be transcoded'});
        return;
      }

      res.setHeader('Cache-Control', 'no-cache, no-store');
      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      res.send(normalizeTargetDuration(content));
    } catch (err) {
      next(err);
    }
  }

  // The only filenames FFmpeg writes into a cache dir and that the player ever
  // requests: the fMP4 init segment and segment_NNN.m4s. Anything else is
  // either a typo or an attempt to traverse — reject before any FS touch.
  private static readonly SEGMENT_FILENAME_RE = /^(init\.mp4|segment_\d+\.m4s)$/;

  public static async serveSegmentFile(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const mediaPath = req.params['mediaPath'] as string;
      const filename = req.params['filename'] as string;
      if (!HLSMWs.SEGMENT_FILENAME_RE.test(filename)) {
        res.status(404).end();
        return;
      }
      const fullMediaPath = path.join(ProjectPath.ImageFolder, mediaPath);

      // getOrStartJob is called even though the playlist endpoint already started
      // the job, because the server may have restarted between the two requests.
      // It is idempotent: an in-memory hit returns instantly.
      const job = await getOrStartJob(fullMediaPath);
      const filePath = path.join(job.cacheDir, filename);

      const ready = await waitForFile(filePath, job);
      if (!ready) {
        if (job.failed) {
          res.status(500).json({message: 'Video could not be transcoded'});
        } else {
          res.status(503).json({message: 'Segment not ready in time'});
        }
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
