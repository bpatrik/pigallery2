import * as path from 'path';
import {Brackets} from 'typeorm';
import {Config} from '../../../common/config/private/Config';
import {MediaDTO, MediaDTOUtils} from '../../../common/entities/MediaDTO';
import {
  TimelineSummaryDTO,
  TimelineSummaryYearDTO,
} from '../../../common/entities/TimelineDTO';
import {DatabaseType} from '../../../common/config/private/PrivateConfig';
import {SessionContext} from '../SessionContext';
import {IObjectManager} from '../database/IObjectManager';
import {SQLConnection} from '../database/SQLConnection';
import {MediaEntity} from '../database/enitites/MediaEntity';
import {PhotoEntity} from '../database/enitites/PhotoEntity';
import {VideoEntity} from '../database/enitites/VideoEntity';
import {
  loadTimelinePage,
  TimelineCursor,
  TimelinePage,
  TimelineScanCursor,
} from './TimelinePaging';

export interface TimelinePageOptions {
  limit: number;
  cursor?: TimelineCursor;
  before?: number;
  onRowsScanned?: (rows: number) => void;
}

function pairKey(directoryId: number, identifier: string): string {
  return `${directoryId}\u0000${identifier}`;
}

export class TimelineManager implements IObjectManager {
  private readonly summaryCache = new Map<
    string,
    {generation: number; value: TimelineSummaryDTO}
  >();
  private readonly summaryInFlight = new Map<
    string,
    {generation: number; promise: Promise<TimelineSummaryDTO>}
  >();
  private generation = 0;
  private static readonly SUMMARY_CACHE_SIZE = 32;

  public async onNewDataVersion(): Promise<void> {
    this.generation++;
  }

  public async cleanUp(): Promise<void> {
    this.summaryCache.clear();
    this.summaryInFlight.clear();
  }

  public async getSummary(session: SessionContext): Promise<TimelineSummaryDTO> {
    const projectionKey = session.user.projectionKey || '';
    const cached = this.summaryCache.get(projectionKey);
    if (cached?.generation === this.generation) {
      this.summaryCache.delete(projectionKey);
      this.summaryCache.set(projectionKey, cached);
      return cached.value;
    }

    const active = this.summaryInFlight.get(projectionKey);
    if (active?.generation === this.generation) {
      return active.promise;
    }

    const generation = this.generation;
    let promise: Promise<TimelineSummaryDTO>;
    promise = this.buildSummary(session).then(value => {
      if (this.generation === generation) {
        this.summaryCache.delete(projectionKey);
        this.summaryCache.set(projectionKey, {generation, value});
        while (this.summaryCache.size > TimelineManager.SUMMARY_CACHE_SIZE) {
          const oldest = this.summaryCache.keys().next().value;
          if (oldest === undefined) {
            break;
          }
          this.summaryCache.delete(oldest);
        }
      }
      return value;
    }).finally(() => {
      if (this.summaryInFlight.get(projectionKey)?.promise === promise) {
        this.summaryInFlight.delete(projectionKey);
      }
    });
    this.summaryInFlight.set(projectionKey, {generation, promise});
    return promise;
  }

  public async getMediaPage(
    session: SessionContext,
    options: TimelinePageOptions
  ): Promise<TimelinePage<MediaEntity>> {
    const page = await loadTimelinePage<MediaEntity>(
      (scanAfter, rawUpperBound, limit) =>
        this.fetchBatch(session, scanAfter, rawUpperBound, limit),
      {
        ...options,
        ignoreTimestampOffset: Config.Gallery.ignoreTimestampOffset,
      }
    );

    if (Config.Media.LivePhoto.enabled && Config.Media.Video.enabled) {
      await this.pairLivePhotos(session, page.media);
    }
    for (const media of page.media) {
      if (media.metadata?.contentIdentifier) {
        const metadata = media.metadata as MediaDTO['metadata'];
        delete metadata.contentIdentifier;
      }
    }
    return page;
  }

  private async fetchBatch(
    session: SessionContext,
    scanAfter: TimelineScanCursor | null,
    rawUpperBound: number | null,
    limit: number
  ): Promise<MediaEntity[]> {
    const connection = await SQLConnection.getConnection();
    const repository = connection.getRepository(
      Config.Media.Video.enabled ? MediaEntity : PhotoEntity
    );
    const query = repository
      .createQueryBuilder('media')
      .innerJoin('media.directory', 'directory')
      .select(['media', 'directory.id', 'directory.name', 'directory.path']);

    if (rawUpperBound !== null) {
      query.where('media.metadata.creationDate <= :rawUpperBound', {rawUpperBound});
    }
    if (scanAfter) {
      const cursorPredicate = new Brackets(qb =>
        qb.where('media.metadata.creationDate < :scanDate', {
          scanDate: scanAfter.creationDate,
        }).orWhere(
          '(media.metadata.creationDate = :scanDate AND media.id < :scanId)',
          {scanDate: scanAfter.creationDate, scanId: scanAfter.id}
        )
      );
      if (rawUpperBound === null) {
        query.where(cursorPredicate);
      } else {
        query.andWhere(cursorPredicate);
      }
    }
    if (session.projectionQuery) {
      query.andWhere(session.projectionQuery);
    }

    return query
      .orderBy('media.metadata.creationDate', 'DESC')
      .addOrderBy('media.id', 'DESC')
      .limit(limit)
      .getMany() as Promise<MediaEntity[]>;
  }

  private async buildSummary(session: SessionContext): Promise<TimelineSummaryDTO> {
    const dayCounts = await this.getDailyCounts(session, PhotoEntity);
    if (Config.Media.Video.enabled) {
      const visiblePhotoPairs =
        Config.Media.LivePhoto.enabled
          ? await this.getVisiblePhotoPairs(session)
          : new Set<string>();
      const videoCounts = await this.getVideoDailyCounts(session);
      for (const row of videoCounts) {
        if (
          Config.Media.LivePhoto.enabled &&
          row.identifier &&
          visiblePhotoPairs.has(pairKey(row.directoryId, row.identifier))
        ) {
          continue;
        }
        dayCounts.set(row.day, (dayCounts.get(row.day) || 0) + row.count);
      }
    }

    const monthCounts = new Map<number, Map<number, number>>();
    for (const [day, count] of dayCounts) {
      const date = new Date(day * 86400000);
      const year = date.getUTCFullYear();
      const month = date.getUTCMonth() + 1;
      if (!monthCounts.has(year)) {
        monthCounts.set(year, new Map<number, number>());
      }
      const months = monthCounts.get(year)!;
      months.set(month, (months.get(month) || 0) + count);
    }

    const years: TimelineSummaryYearDTO[] = [...monthCounts.keys()]
      .sort((left, right) => left - right)
      .map(year => ({
        year,
        months: [...monthCounts.get(year)!.entries()]
          .sort(([left], [right]) => left - right)
          .map(([month, count]) => ({month, count})),
      }));
    return {years};
  }

  private getDayExpression(): string {
    const creationDate = 'media.metadata.creationDate';
    const offset = Config.Gallery.ignoreTimestampOffset
      ? `(CASE WHEN media.metadata.creationDateOffset BETWEEN -720 AND 840 ` +
        'THEN media.metadata.creationDateOffset ELSE 0 END) * 60000'
      : '0';
    const effectiveTime = `(${creationDate} + (${offset}))`;
    if (Config.Database.type === DatabaseType.sqlite) {
      return `CASE WHEN ${effectiveTime} >= 0 ` +
        `THEN CAST(${effectiveTime} / 86400000 AS INTEGER) ` +
        `ELSE -CAST((ABS(${effectiveTime}) + 86399999) / 86400000 AS INTEGER) END`;
    }
    return `FLOOR(${effectiveTime} / 86400000)`;
  }

  private async getDailyCounts(
    session: SessionContext,
    entity: typeof PhotoEntity
  ): Promise<Map<number, number>> {
    const connection = await SQLConnection.getConnection();
    const dayExpression = this.getDayExpression();
    const query = connection
      .getRepository(entity)
      .createQueryBuilder('media')
      .innerJoin('media.directory', 'directory')
      .select(dayExpression, 'day')
      .addSelect('COUNT(media.id)', 'count')
      .groupBy(dayExpression);
    if (session.projectionQuery) {
      query.andWhere(session.projectionQuery);
    }
    const rows = await query.getRawMany<{day: string | number; count: string | number}>();
    return new Map(rows.map(row => [Number(row.day), Number(row.count)]));
  }

  private async getVisiblePhotoPairs(
    session: SessionContext
  ): Promise<Set<string>> {
    const connection = await SQLConnection.getConnection();
    const query = connection
      .getRepository(PhotoEntity)
      .createQueryBuilder('media')
      .innerJoin('media.directory', 'directory')
      .select('directory.id', 'directoryId')
      .addSelect('media.metadata.contentIdentifier', 'identifier')
      .where('media.metadata.contentIdentifier IS NOT NULL')
      .andWhere("media.metadata.contentIdentifier <> ''")
      .distinct(true);
    if (session.projectionQuery) {
      query.andWhere(session.projectionQuery);
    }
    const rows = await query.getRawMany<{
      directoryId: number | string;
      identifier: string;
    }>();
    return new Set(
      rows.map(row =>
        pairKey(Number(row.directoryId), row.identifier)
      )
    );
  }

  private async getVideoDailyCounts(
    session: SessionContext
  ): Promise<{day: number; directoryId: number; identifier: string | null; count: number}[]> {
    const connection = await SQLConnection.getConnection();
    const dayExpression = this.getDayExpression();
    const query = connection
      .getRepository(VideoEntity)
      .createQueryBuilder('media')
      .innerJoin('media.directory', 'directory')
      .select(dayExpression, 'day')
      .addSelect('directory.id', 'directoryId')
      .addSelect('media.metadata.contentIdentifier', 'identifier')
      .addSelect('COUNT(media.id)', 'count')
      .groupBy(dayExpression)
      .addGroupBy('directory.id')
      .addGroupBy('media.metadata.contentIdentifier');
    if (session.projectionQuery) {
      query.andWhere(session.projectionQuery);
    }
    const rows = await query.getRawMany<{
      day: string | number;
      directoryId: string | number;
      identifier: string | null;
      count: string | number;
    }>();
    return rows.map(row => ({
      day: Number(row.day),
      directoryId: Number(row.directoryId),
      identifier: row.identifier,
      count: Number(row.count),
    }));
  }

  private async pairLivePhotos(
    session: SessionContext,
    media: MediaEntity[]
  ): Promise<void> {
    const videos = media.filter(
      item => MediaDTOUtils.isVideo(item) && item.metadata?.contentIdentifier
    );
    const photos = media.filter(
      item => !MediaDTOUtils.isVideo(item) && item.metadata?.contentIdentifier
    );
    if (videos.length === 0 && photos.length === 0) {
      return;
    }

    const photosWithCompanion = await this.findPairs(
      session,
      PhotoEntity,
      videos
    );
    const companionVideos = await this.findCompanionVideos(
      session,
      photos
    );
    const pairedKeys = new Set(photosWithCompanion);

    for (const photo of photos) {
      const directoryId = (photo.directory as {id: number}).id;
      const identifier = photo.metadata.contentIdentifier;
      const companion = companionVideos.get(pairKey(directoryId, identifier));
      if (!companion) {
        continue;
      }
      const directory = companion.directory;
      const video = companion as VideoEntity;
      photo.liveVideoPath = path.join(
        directory.path,
        directory.name,
        companion.name
      );
      photo.liveVideoInfo = {
        name: companion.name,
        size: video.metadata.size,
        fileSize: video.metadata.fileSize,
        duration: video.metadata.duration,
        fps: video.metadata.fps,
        bitRate: video.metadata.bitRate,
      };
    }

    for (let index = media.length - 1; index >= 0; index--) {
      const item = media[index];
      if (
        MediaDTOUtils.isVideo(item) &&
        item.metadata?.contentIdentifier &&
        pairedKeys.has(
          pairKey(
            (item.directory as {id: number}).id,
            item.metadata.contentIdentifier
          )
        )
      ) {
        media.splice(index, 1);
      }
    }
  }

  private async findPairs(
    session: SessionContext,
    entity: typeof PhotoEntity,
    targets: MediaEntity[]
  ): Promise<string[]> {
    const pairs = this.getPairs(targets);
    if (pairs.length === 0) {
      return [];
    }
    const connection = await SQLConnection.getConnection();
    const query = connection
      .getRepository(entity)
      .createQueryBuilder('media')
      .innerJoin('media.directory', 'directory')
      .select(['media.id', 'directory.id', 'media.metadata.contentIdentifier']);
    query.where(this.pairPredicate(pairs));
    if (session.projectionQuery) {
      query.andWhere(session.projectionQuery);
    }
    const found = await query.getMany();
    return found.map(item =>
      pairKey(
        (item.directory as {id: number}).id,
        item.metadata.contentIdentifier
      )
    );
  }

  private async findCompanionVideos(
    session: SessionContext,
    photos: MediaEntity[]
  ): Promise<Map<string, VideoEntity>> {
    const pairs = this.getPairs(photos);
    const result = new Map<string, VideoEntity>();
    if (pairs.length === 0) {
      return result;
    }
    const connection = await SQLConnection.getConnection();
    const query = connection
      .getRepository(VideoEntity)
      .createQueryBuilder('media')
      .innerJoin('media.directory', 'directory')
      .select(['media', 'directory.id', 'directory.name', 'directory.path'])
      .where(this.pairPredicate(pairs))
      .orderBy('media.id', 'ASC');
    if (session.projectionQuery) {
      query.andWhere(session.projectionQuery);
    }
    const found = await query.getMany();
    for (const video of found) {
      const key = pairKey(
        (video.directory as {id: number}).id,
        video.metadata.contentIdentifier
      );
      if (!result.has(key)) {
        result.set(key, video);
      }
    }
    return result;
  }

  private getPairs(media: MediaDTO[]): {directoryId: number; identifier: string}[] {
    const unique = new Map<string, {directoryId: number; identifier: string}>();
    for (const item of media) {
      const identifier = item.metadata?.contentIdentifier;
      const directoryId = (item.directory as unknown as {id: number})?.id;
      if (!identifier || directoryId === undefined) {
        continue;
      }
      unique.set(pairKey(directoryId, identifier), {directoryId, identifier});
    }
    return [...unique.values()];
  }

  private pairPredicate(
    pairs: {directoryId: number; identifier: string}[]
  ): Brackets {
    return new Brackets(qb => {
      pairs.forEach((pair, index) => {
        const condition =
          'directory.id = :timelineDir' + index +
          ' AND media.metadata.contentIdentifier = :timelineIdentifier' + index;
        const parameters = {
          ['timelineDir' + index]: pair.directoryId,
          ['timelineIdentifier' + index]: pair.identifier,
        };
        if (index === 0) {
          qb.where(condition, parameters);
        } else {
          qb.orWhere(condition, parameters);
        }
      });
    });
  }
}