import {MediaDTO} from '../../../common/entities/MediaDTO';
import {Utils} from '../../../common/Utils';

export interface TimelineCursor {
  from: number;
  after: number;
}

export interface TimelineScanCursor {
  creationDate: number;
  id: number;
}

export interface TimelinePage<T extends MediaDTO> {
  media: T[];
  next: TimelineCursor | null;
}

export interface TimelinePagingOptions {
  limit: number;
  ignoreTimestampOffset: boolean;
  cursor?: TimelineCursor;
  before?: number;
  batchSize?: number;
  onRowsScanned?: (rows: number) => void;
}

export type TimelineBatchFetcher<T extends MediaDTO> = (
  scanAfter: TimelineScanCursor | null,
  rawUpperBound: number | null,
  limit: number
) => Promise<T[]>;

const MAX_OFFSET_MS = 14 * 60 * 60 * 1000;

export function getTimelineEffectiveTime(
  media: Pick<MediaDTO, 'metadata'>,
  ignoreTimestampOffset: boolean
): number {
  return Utils.getTimeMS(
    media.metadata.creationDate,
    media.metadata.creationDateOffset || '',
    ignoreTimestampOffset
  );
}

function compareMedia<T extends MediaDTO>(
  left: T,
  right: T,
  ignoreTimestampOffset: boolean
): number {
  const timeDifference =
    getTimelineEffectiveTime(right, ignoreTimestampOffset) -
    getTimelineEffectiveTime(left, ignoreTimestampOffset);
  return timeDifference || right.id - left.id;
}

function isBeforeCursor<T extends MediaDTO>(
  media: T,
  cursor: TimelineCursor,
  ignoreTimestampOffset: boolean
): boolean {
  const time = getTimelineEffectiveTime(media, ignoreTimestampOffset);
  return time < cursor.from || (time === cursor.from && media.id < cursor.after);
}

export async function loadTimelinePage<T extends MediaDTO>(
  fetchBatch: TimelineBatchFetcher<T>,
  options: TimelinePagingOptions
): Promise<TimelinePage<T>> {
  const batchSize = options.batchSize || options.limit * 2;
  const offsetWindow = options.ignoreTimestampOffset ? MAX_OFFSET_MS : 0;
  const rawUpperBound = options.cursor
    ? options.cursor.from + offsetWindow
    : options.before === undefined
      ? null
      : options.before + offsetWindow;
  const kept: T[] = [];
  let scanAfter: TimelineScanCursor | null = null;
  let exhausted = false;

  while (!exhausted) {
    const batch = await fetchBatch(scanAfter, rawUpperBound, batchSize);
    options.onRowsScanned?.(batch.length);
    if (batch.length === 0) {
      exhausted = true;
      break;
    }

    for (const media of batch) {
      if (
        options.cursor &&
        !isBeforeCursor(media, options.cursor, options.ignoreTimestampOffset)
      ) {
        continue;
      }
      const effectiveTime = getTimelineEffectiveTime(
        media,
        options.ignoreTimestampOffset
      );
      if (options.before !== undefined && effectiveTime >= options.before) {
        continue;
      }
      kept.push(media);
    }

    const last = batch[batch.length - 1];
    scanAfter = {
      creationDate: last.metadata.creationDate,
      id: last.id,
    };
    kept.sort((left, right) =>
      compareMedia(left, right, options.ignoreTimestampOffset)
    );
    if (kept.length > options.limit) {
      kept.length = options.limit;
    }

    if (batch.length < batchSize) {
      exhausted = true;
      break;
    }

    if (
      kept.length === options.limit &&
      scanAfter.creationDate + offsetWindow <
        getTimelineEffectiveTime(
          kept[kept.length - 1],
          options.ignoreTimestampOffset
        )
    ) {
      break;
    }
  }

  const media = kept;
  const last = media[media.length - 1];
  return {
    media,
    next:
      last && media.length === options.limit
        ? {
            from: getTimelineEffectiveTime(last, options.ignoreTimestampOffset),
            after: last.id,
          }
        : null,
  };
}