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
