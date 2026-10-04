import {Injectable} from '@angular/core';
import {Subject} from 'rxjs';
import {MediaDTO} from '../../../../common/entities/MediaDTO';
import {TimelinePageDTO, TimelineSummaryDTO} from '../../../../common/entities/TimelineDTO';
import {UserDTO} from '../../../../common/entities/UserDTO';
import {NetworkService} from '../../model/network/network.service';
import {AuthenticationService} from '../../model/network/authentication.service';
import {VersionService} from '../../model/version.service';

export interface TimelineScrollAnchor {
  mediaId: string;
  // distance of the anchor's top edge from the viewport top, in px
  offset: number;
}

/**
 * Timeline state that outlives TimelineComponent, so Back restores loaded pages.
 * Kept in memory only; cleared on logout and on user or projection change.
 */
@Injectable({providedIn: 'root'})
export class TimelineStore {
  static readonly PAGE_SIZE = 100;

  readonly changes = new Subject<void>();
  items: MediaDTO[] = [];
  next: TimelinePageDTO['next'] = null;
  done = false;
  loading = false;
  error: string = null;
  newDataAvailable = false;
  startBefore: number = null;
  scrollAnchor: TimelineScrollAnchor = null;
  summary: TimelineSummaryDTO = null;
  // set when the gallery version moved past the one the summary was loaded under
  summaryStale = false;

  private ids = new Set<number>();
  private epoch = 0;
  private pending: Promise<void> = null;
  private summaryEpoch = 0;
  private summaryPending: Promise<void> = null;
  private summaryVersion: string = null;
  private userKey: string = undefined;
  private dataVersion: string = null;

  constructor(
    private networkService: NetworkService,
    private versionService: VersionService,
    authService: AuthenticationService
  ) {
    authService.user.subscribe((user): void => {
      const key = TimelineStore.getUserKey(user);
      if (key !== this.userKey) {
        this.userKey = key;
        this.clearSummary();
        this.reset();
      }
    });
    versionService.version.subscribe((version): void => {
      if (version && this.dataVersion && version !== this.dataVersion && !this.newDataAvailable) {
        this.newDataAvailable = true;
        this.changes.next();
      }
      if (version && this.summary && this.summaryVersion && version !== this.summaryVersion && !this.summaryStale) {
        this.summaryStale = true;
        this.changes.next();
      }
    });
  }

  private static getUserKey(user: UserDTO): string {
    if (!user) {
      return null;
    }
    return JSON.stringify([user.id, user.name, user.role, user.projectionKey ?? null, user.usedSharingKey ?? null]);
  }

  get hasMore(): boolean {
    return !this.done;
  }

  /**
   * Loads the page after the current cursor. Concurrent calls share one request;
   * responses that arrive after reset() or cancel() are dropped.
   */
  loadNextPage(): Promise<void> {
    if (this.pending) {
      return this.pending;
    }
    if (this.done) {
      return Promise.resolve();
    }
    const epoch = this.epoch;
    const query: Record<string, number> = {limit: TimelineStore.PAGE_SIZE};
    if (this.next) {
      query['from'] = this.next.from;
      query['after'] = this.next.after;
    } else if (this.startBefore !== null) {
      query['before'] = this.startBefore;
    }
    const wasEmpty = this.items.length === 0;

    this.loading = true;
    this.error = null;
    this.changes.next();
    const request = this.networkService
      .getJson<TimelinePageDTO>('/timeline/media', query)
      .then((page): void => {
        if (epoch !== this.epoch) {
          return;
        }
        if (!page) {
          throw new Error('Empty timeline response');
        }
        for (const media of page.media) {
          if (!this.ids.has(media.id)) {
            this.ids.add(media.id);
            this.items.push(media);
          }
        }
        // advance even when every item was a duplicate, so the next call makes progress
        this.next = page.next;
        this.done = !page.next;
        if (wasEmpty) {
          this.dataVersion = this.versionService.version.value;
        }
      })
      .catch((err): void => {
        if (epoch !== this.epoch) {
          return;
        }
        this.error = typeof err === 'string' ? err : (err?.message || $localize`Unknown server error`);
      })
      .finally((): void => {
        if (epoch !== this.epoch) {
          return;
        }
        this.loading = false;
        this.pending = null;
        this.changes.next();
      });
    this.pending = request;
    return request;
  }

  /**
   * Drops the in-flight request but keeps loaded data.
   */
  cancel(): void {
    if (!this.pending) {
      return;
    }
    this.epoch++;
    this.pending = null;
    this.loading = false;
    this.changes.next();
  }

  reset(startBefore: number = null): void {
    this.epoch++;
    this.pending = null;
    this.items = [];
    this.ids.clear();
    this.next = null;
    this.done = false;
    this.loading = false;
    this.error = null;
    this.newDataAvailable = false;
    this.dataVersion = null;
    this.scrollAnchor = null;
    this.startBefore = startBefore;
    this.changes.next();
  }

  /**
   * Loads the year/month counts; refetches only when stale. A stale summary stays visible
   * until the new one arrives; failures keep what is there so the rail does not flicker.
   */
  loadSummary(): Promise<void> {
    if (this.summary && !this.summaryStale) {
      return Promise.resolve();
    }
    if (this.summaryPending) {
      return this.summaryPending;
    }
    const epoch = this.summaryEpoch;
    const request = this.networkService
      .getJson<TimelineSummaryDTO>('/timeline/summary')
      .then((summary): void => {
        if (epoch === this.summaryEpoch && summary) {
          this.summary = summary;
          this.summaryVersion = this.versionService.version.value;
        }
      })
      .catch(console.error)
      .finally((): void => {
        if (epoch !== this.summaryEpoch) {
          return;
        }
        // also cleared on failure, otherwise every store change would retry
        this.summaryStale = false;
        this.summaryPending = null;
        this.changes.next();
      });
    this.summaryPending = request;
    return request;
  }

  clearSummary(): void {
    this.summaryEpoch++;
    this.summary = null;
    this.summaryStale = false;
    this.summaryVersion = null;
    this.summaryPending = null;
  }
}
