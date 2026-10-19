import {Injectable} from '@angular/core';
import {NetworkService} from '../../model/network/network.service';
import {TimelineDTO} from '../../../../common/entities/TimelineDTO';
import {MediaDTO} from '../../../../common/entities/MediaDTO';
import {DateSearch, SearchQueryTypes} from '../../../../common/entities/SearchQueryDTO';
import {ContentWrapperUtils, PackedContentWrapperWithError} from '../../../../common/entities/ContentWrapper';
import {Config} from '../../../../common/config/public/Config';
import {Utils} from '../../../../common/Utils';

/**
 * Data of the timeline view. Kept for the whole session (singleton), so that
 * coming back from the lightbox does not reload anything and the scroll
 * position can be restored.
 */
@Injectable({providedIn: 'root'})
export class TimelineService {
  /**
   * Window scroll position when the timeline was left. Also kept in the
   * session storage, so a page reload (e.g. after an action on the photos)
   * comes back to the same place.
   */
  private static readonly SCROLL_KEY = 'timeline-scroll-y';

  public get scrollY(): number {
    try {
      return parseInt(sessionStorage.getItem(TimelineService.SCROLL_KEY), 10) || 0;
    } catch (e) {
      return 0;
    }
  }

  public set scrollY(value: number) {
    try {
      sessionStorage.setItem(TimelineService.SCROLL_KEY, '' + Math.round(value));
    } catch (e) {
      // private mode or storage disabled: only lost after a reload
    }
  }

  private days: Promise<TimelineDTO> = null;
  private daysLoadedAt = 0;
  private readonly months = new Map<string, Promise<MediaDTO[]>>();

  constructor(private networkService: NetworkService) {
  }

  /** Local day of a media, the same way the server counts it ('YYYY-MM-DD'). */
  public static dayKey(media: MediaDTO): string {
    let t = media.metadata.creationDate;
    if (Config.Gallery.ignoreTimestampOffset === true) {
      t += (Utils.getOffsetMinutes(media.metadata.creationDateOffset) || 0) * 60000;
    }
    return new Date(t).toISOString().substring(0, 10);
  }

  /** Search query of a whole month ('YYYY-MM'), shared with the lightbox. */
  public static monthQuery(month: string): DateSearch {
    const [y, m] = month.split('-').map(v => parseInt(v, 10));
    return {
      type: SearchQueryTypes.date,
      min: Date.UTC(y, m - 1, 1),
      max: Date.UTC(y, m, 1) - 1,
    } as DateSearch;
  }

  public getDays(): Promise<TimelineDTO> {
    // Refreshed when older than 10 minutes (new photos).
    if (!this.days || Date.now() - this.daysLoadedAt > 10 * 60 * 1000) {
      this.daysLoadedAt = Date.now();
      this.months.clear();
      this.days = this.networkService.getJson<TimelineDTO>('/timeline');
      this.days.catch((): void => {
        this.days = null;
      });
    }
    return this.days;
  }

  /** Media of a month ('YYYY-MM'), newest first. */
  public getMonth(month: string): Promise<MediaDTO[]> {
    if (!this.months.has(month)) {
      const p = this.networkService
        .getJson<PackedContentWrapperWithError>('/search/' + encodeURIComponent(JSON.stringify(TimelineService.monthQuery(month))))
        .then(cw => {
          const media = ContentWrapperUtils.unpack(cw)?.searchResult?.media || [];
          return media.sort((a, b) => b.metadata.creationDate - a.metadata.creationDate);
        });
      p.catch(() => this.months.delete(month));
      this.months.set(month, p);
    }
    return this.months.get(month);
  }
}
