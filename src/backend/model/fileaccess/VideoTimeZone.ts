import {Utils} from '../../../common/Utils';
import tzlookup from '@photostructure/tz-lookup';

export interface VideoDate {
  creationDate: number;
  creationDateOffset?: string;
}

/**
 * Finds the UTC offset of a video.
 * Videos store their date in creation_time (UTC) without an offset, so photos (that have one)
 * and videos sort apart by the timezone when sorting by local time.
 * The offset is taken from, in this order:
 *  1. com.apple.quicktime.creationdate: local capture time with offset (e.g. 2025-07-11T09:44:38-0600)
 *  2. com.samsung.android.utc_offset: offset of creation_time (e.g. +0100)
 *  3. the timezone at the GPS position of the video at the time of capture
 * If none of them is usable, the date is returned unchanged and without offset.
 */
export class VideoTimeZone {

  /**
   * @param tags ffprobe format tags
   * @param date the date read so far
   * @param isUTC true if date comes from creation_time (UTC), false if it is the file system date
   */
  public static getDate(tags: Record<string, unknown> | undefined, date: number, isUTC: boolean): VideoDate {
    if (!tags) {
      return {creationDate: date};
    }

    const [ts, offset] = VideoTimeZone.parseQuickTimeCreationDate(tags['com.apple.quicktime.creationdate']);
    if (ts && offset) {
      const ms = Utils.timestampToMS(ts, offset);
      if (Number.isFinite(ms)) {
        return {creationDate: ms, creationDateOffset: offset};
      }
    }

    // the remaining sources only know the offset, so the date has to be a real UTC instant
    if (!isUTC) {
      return {creationDate: date};
    }

    const utcOffset = VideoTimeZone.parseUtcOffset(tags['com.samsung.android.utc_offset']);
    if (utcOffset) {
      return {creationDate: date, creationDateOffset: utcOffset};
    }

    const position = VideoTimeZone.parseISO6709(tags['com.apple.quicktime.location.ISO6709']) ||
      VideoTimeZone.parseISO6709(tags['location']);
    if (position) {
      const gpsOffset = VideoTimeZone.getOffsetAtPosition(position.latitude, position.longitude, date);
      if (gpsOffset) {
        return {creationDate: date, creationDateOffset: gpsOffset};
      }
    }

    return {creationDate: date};
  }

  /**
   * Converts a UTC offset written as +HHMM or +HH:MM (e.g. -0600, +02:00) into +HH:MM.
   * Returns undefined if the value is missing, malformed or out of the valid range.
   */
  public static parseUtcOffset(value: unknown): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }
    const match = value.trim().match(/^([+-])(\d{2}):?([0-5]\d)$/);
    if (!match) {
      return undefined;
    }
    return Utils.getOffsetString((match[1] === '-' ? -1 : 1) * (parseInt(match[2], 10) * 60 + parseInt(match[3], 10)));
  }

  /**
   * Splits the 'com.apple.quicktime.creationdate' tag (local time with offset,
   * e.g. 2025-07-11T09:44:38-0600 or 2025-07-11T09:44:38+02:00) into timestamp and +HH:MM offset.
   * Returns [undefined, undefined] if the value is missing, malformed or has no usable offset.
   */
  public static parseQuickTimeCreationDate(value: unknown): [string | undefined, string | undefined] {
    if (typeof value !== 'string') {
      return [undefined, undefined];
    }
    const match = value.trim().match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?)([+-]\d{2}:?\d{2})$/);
    const offset = match ? VideoTimeZone.parseUtcOffset(match[2]) : undefined;
    if (!offset) {
      return [undefined, undefined];
    }
    return [match[1], offset];
  }

  /**
   * Parses an ISO 6709 position in decimal degrees as written into videos,
   * e.g. +52.5163+013.3777/ or +35.6895+139.6917+012.345/ (with altitude).
   * Returns undefined for missing, malformed, out of range and 0,0 positions
   * (0,0 is what broken GPS receivers report).
   */
  public static parseISO6709(value: unknown): { latitude: number, longitude: number } | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }
    // degrees only: 2 digits for latitude, 3 for longitude (longer means the DDMM / DDMMSS notation)
    const match = value.trim().match(/^([+-]\d{1,2}(?:\.\d+)?)([+-]\d{1,3}(?:\.\d+)?)(?:[+-]\d+(?:\.\d+)?)?(?:CRS[^/]*)?\/?$/);
    if (!match) {
      return undefined;
    }
    const latitude = parseFloat(match[1]);
    const longitude = parseFloat(match[2]);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
      Math.abs(latitude) > 90 || Math.abs(longitude) > 180 ||
      (latitude === 0 && longitude === 0)) {
      return undefined;
    }
    return {latitude, longitude};
  }

  /**
   * Returns the +HH:MM offset of the timezone at the given position at the given time
   * (so daylight saving time is taken into account), or undefined if it cannot be determined.
   */
  public static getOffsetAtPosition(latitude: number, longitude: number, date: number): string | undefined {
    try {
      return VideoTimeZone.getOffsetOfTimeZone(tzlookup(latitude, longitude), date);
    } catch {
      return undefined;
    }
  }

  /**
   * Returns the +HH:MM offset of an IANA timezone (e.g. Europe/Berlin) at the given time,
   * or undefined if the timezone or the time is invalid.
   */
  public static getOffsetOfTimeZone(timeZone: string, date: number): string | undefined {
    try {
      if (!Number.isFinite(date)) {
        return undefined;
      }
      const name = new Intl.DateTimeFormat('en-US', {timeZone, timeZoneName: 'longOffset'})
        .formatToParts(new Date(date))
        .find(p => p.type === 'timeZoneName')?.value;
      if (name === 'GMT') {
        return '+00:00';
      }
      return VideoTimeZone.parseUtcOffset(name?.replace(/^GMT/, ''));
    } catch {
      return undefined;
    }
  }
}
