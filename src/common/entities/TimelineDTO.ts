/**
 * Timeline index: number of media per local day, newest day first.
 * A day is the UTC calendar day of the creation date, shifted by the
 * creation date offset when Gallery.ignoreTimestampOffset is set (the same
 * convention as the date range search, so a day or month can be loaded with
 * a SearchQueryTypes.date query).
 */
export interface TimelineDTO {
  days: [string, number][]; // ['YYYY-MM-DD', count]
}
