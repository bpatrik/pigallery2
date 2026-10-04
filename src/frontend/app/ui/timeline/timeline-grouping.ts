import {MediaDTO} from '../../../../common/entities/MediaDTO';
import {Utils} from '../../../../common/Utils';
import {MediaGroup} from '../gallery/navigator/sorting.service';

const DAY_MS = 86400000;

export function getTimelineMediaId(media: MediaDTO): string {
  return Utils.concatUrls(media.directory.path, media.directory.name, media.name);
}

export function getTimelineDay(media: MediaDTO, ignoreTimestampOffset: boolean): number {
  return Math.floor(
    Utils.getTimeMS(media.metadata.creationDate, media.metadata.creationDateOffset, ignoreTimestampOffset) / DAY_MS
  );
}

export interface TimelineMonth {
  year: number;
  month: number; // 1-12
}

const MONTH_PARAM = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function parseTimelineMonth(value: unknown): TimelineMonth | null {
  const match = typeof value === 'string' ? MONTH_PARAM.exec(value) : null;
  return match ? {year: Number(match[1]), month: Number(match[2])} : null;
}

export function formatTimelineMonth(month: TimelineMonth): string {
  return `${String(month.year).padStart(4, '0')}-${String(month.month).padStart(2, '0')}`;
}

// Exclusive `before` bound for a month jump: first instant of the following month in effective time.
export function getTimelineMonthEnd(month: TimelineMonth): number {
  // setUTCFullYear, unlike Date.UTC, does not map years 0-99 to 1900-1999
  return new Date(0).setUTCFullYear(month.year, month.month, 1);
}

export function getTimelineMonth(media: MediaDTO, ignoreTimestampOffset: boolean): TimelineMonth {
  const date = new Date(
    Utils.getTimeMS(media.metadata.creationDate, media.metadata.creationDateOffset, ignoreTimestampOffset)
  );
  return {year: date.getUTCFullYear(), month: date.getUTCMonth() + 1};
}

/**
 * Groups consecutive media (already in timeline order) by effective day.
 * A day split across pages stays one group.
 */
export function groupTimelineByDay(
  media: MediaDTO[],
  ignoreTimestampOffset: boolean,
  dayName: (dayStartMs: number) => string
): MediaGroup[] {
  const groups: MediaGroup[] = [];
  let lastDay: number = null;
  for (const item of media) {
    const day = getTimelineDay(item, ignoreTimestampOffset);
    if (day !== lastDay) {
      groups.push({name: dayName(day * DAY_MS), media: []});
      lastDay = day;
    }
    groups[groups.length - 1].media.push(item);
  }
  return groups;
}
