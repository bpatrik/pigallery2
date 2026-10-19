import {TimelineService} from './timeline.service';
import {MediaDTO} from '../../../../common/entities/MediaDTO';
import {SearchQueryTypes} from '../../../../common/entities/SearchQueryDTO';
import {Config} from '../../../../common/config/public/Config';

describe('TimelineService', () => {
  const media = (creationDate: number, creationDateOffset?: string): MediaDTO => ({
    metadata: {creationDate, creationDateOffset},
  } as unknown as MediaDTO);
  let ignoreOffset: boolean;

  beforeEach(() => {
    ignoreOffset = Config.Gallery.ignoreTimestampOffset;
  });

  afterEach(() => {
    Config.Gallery.ignoreTimestampOffset = ignoreOffset;
  });

  it('should put a media on the local day of its offset', () => {
    Config.Gallery.ignoreTimestampOffset = true;
    // 2026-10-18 23:30 UTC = 2026-10-19 01:30 in +02:00
    const t = Date.UTC(2026, 9, 18, 23, 30);
    expect(TimelineService.dayKey(media(t, '+02:00'))).toEqual('2026-10-19');
    expect(TimelineService.dayKey(media(t, '-05:00'))).toEqual('2026-10-18');
    expect(TimelineService.dayKey(media(t))).toEqual('2026-10-18');
  });

  it('should use the UTC day when the offset is not ignored', () => {
    Config.Gallery.ignoreTimestampOffset = false;
    expect(TimelineService.dayKey(media(Date.UTC(2026, 9, 18, 23, 30), '+02:00'))).toEqual('2026-10-18');
  });

  it('should build a date range query covering the whole month', () => {
    const q = TimelineService.monthQuery('2024-02');
    expect(q.type).toEqual(SearchQueryTypes.date);
    expect(q.min).toEqual(Date.UTC(2024, 1, 1));
    expect(q.max).toEqual(Date.UTC(2024, 2, 1) - 1);
    // December rolls over to January of the next year
    expect(TimelineService.monthQuery('2025-12').max).toEqual(Date.UTC(2026, 0, 1) - 1);
  });
});
