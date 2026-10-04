import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  Inject,
  LOCALE_ID,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import {formatDate, NgFor, NgIf} from '@angular/common';
import {ActivatedRoute, Params, Router} from '@angular/router';
import {Subscription} from 'rxjs';
import {FrameComponent} from '../frame/frame.component';
import {GalleryGridComponent} from '../gallery/grid/grid.gallery.component';
import {GalleryLightboxComponent} from '../gallery/lightbox/lightbox.gallery.component';
import {MediaButtonModalComponent} from '../gallery/grid/photo/media-button-modal/media-button-modal.component';
import {MediaGroup} from '../gallery/navigator/sorting.service';
import {MediaDTO} from '../../../../common/entities/MediaDTO';
import {GroupByTypes} from '../../../../common/entities/SortingMethods';
import {QueryParams} from '../../../../common/QueryParams';
import {Config} from '../../../../common/config/public/Config';
import {AuthenticationService} from '../../model/network/authentication.service';
import {NavigationService} from '../../model/navigation.service';
import {PiTitleService} from '../../model/pi-title.service';
import {PageHelper} from '../../model/page.helper';
import {ShareService} from '../gallery/share.service';
import {TimelineStore} from './timeline.store';
import {
  formatTimelineMonth,
  getTimelineMediaId,
  getTimelineMonth,
  getTimelineMonthEnd,
  groupTimelineByDay,
  parseTimelineMonth,
  TimelineMonth,
} from './timeline-grouping';
import {TimelineLightboxSource} from './timeline-lightbox.source';
import {TimelineSummaryDTO} from '../../../../common/entities/TimelineDTO';

export interface TimelineRailMonth {
  key: string;
  month: number;
  count: number;
  shortName: string;
  longName: string;
}

export interface TimelineRailYear {
  year: number;
  months: TimelineRailMonth[];
}

@Component({
  selector: 'app-timeline',
  templateUrl: './timeline.component.html',
  styleUrls: ['./timeline.component.css'],
  imports: [
    FrameComponent,
    GalleryGridComponent,
    GalleryLightboxComponent,
    MediaButtonModalComponent,
    NgFor,
    NgIf,
  ]
})
export class TimelineComponent implements OnInit, AfterViewInit, OnDestroy {
  static readonly AT_PARAM = 'at';
  private static readonly PRELOAD_MARGIN_PX = 800;

  @ViewChild(GalleryGridComponent, {static: true}) grid: GalleryGridComponent;
  @ViewChild('lightbox', {static: true}) lightbox: GalleryLightboxComponent;
  @ViewChild('sentinel', {static: true}) sentinel: ElementRef<HTMLElement>;

  mediaGroups: MediaGroup[] = [];
  revealMediaId: string = null;
  ready = false;
  readonly mediaIdFn = getTimelineMediaId;
  readonly headerMethod = GroupByTypes.Date;
  atMonth: TimelineMonth = null;
  atMonthName: string = null;
  currentMonthKey: string = null;
  railYears: TimelineRailYear[] = [];

  private observer: IntersectionObserver;
  private subscription = new Subscription();
  private renderedItems: MediaDTO[] = null;
  private railSummary: TimelineSummaryDTO = null;
  private restoreTimer: number = null;
  private recheckTimer: number = null;
  private scrollFrame: number = null;

  constructor(
    public store: TimelineStore,
    private authService: AuthenticationService,
    private shareService: ShareService,
    private navigation: NavigationService,
    private piTitleService: PiTitleService,
    private router: Router,
    private route: ActivatedRoute,
    private changeDetector: ChangeDetectorRef,
    @Inject(LOCALE_ID) private locale: string
  ) {
    PageHelper.showScrollY('timeline');
  }

  async ngOnInit(): Promise<void> {
    await this.shareService.wait();
    if (!this.authService.isAuthenticated()) {
      await this.navigation.toLogin();
      return;
    }
    if (!this.isAvailable()) {
      await this.navigation.toDefault();
      return;
    }
    this.piTitleService.setTitle($localize`Timeline`);
    this.ready = true;
    this.subscription.add(this.store.changes.subscribe((): void => this.onStoreChange()));
    this.revealMediaId = this.store.scrollAnchor?.mediaId ?? null;
    this.onStoreChange();
    this.changeDetector.detectChanges();
    this.observeSentinel();
    let initial = true;
    this.subscription.add(this.route.queryParams.subscribe((params): void => {
      this.onQueryParams(params, initial);
      initial = false;
    }));
    this.store.loadSummary().catch(console.error);
  }

  ngAfterViewInit(): void {
    this.lightbox.setSource(new TimelineLightboxSource(
      this.store,
      this.grid.gridPhotoQL,
      (): Params => this.atMonth ? {[TimelineComponent.AT_PARAM]: formatTimelineMonth(this.atMonth)} : {}
    ));
  }

  ngOnDestroy(): void {
    if (this.ready) {
      this.store.scrollAnchor = this.getScrollAnchor();
    }
    this.store.cancel();
    this.subscription.unsubscribe();
    this.observer?.disconnect();
    if (this.restoreTimer !== null) {
      cancelAnimationFrame(this.restoreTimer);
    }
    if (this.scrollFrame !== null) {
      cancelAnimationFrame(this.scrollFrame);
    }
    if (this.recheckTimer !== null) {
      clearTimeout(this.recheckTimer);
    }
  }

  @HostListener('window:scroll')
  onScroll(): void {
    if (this.scrollFrame !== null || !this.ready) {
      return;
    }
    this.scrollFrame = requestAnimationFrame((): void => {
      this.scrollFrame = null;
      this.updateCurrentMonth();
    });
  }

  jumpToMonth(key: string): void {
    const month = parseTimelineMonth(key);
    if (!month) {
      return;
    }
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {[TimelineComponent.AT_PARAM]: formatTimelineMonth(month), [QueryParams.gallery.photo]: null},
      queryParamsHandling: 'merge',
    }).catch(console.error);
  }

  onPickMonth(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.jumpToMonth(select.value);
    select.value = '';
  }

  openMedia(media: MediaDTO): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {[QueryParams.gallery.photo]: getTimelineMediaId(media)},
      queryParamsHandling: 'merge',
    }).catch(console.error);
  }

  onMissingMedia(id: string): void {
    // the grid may lag behind the store for a tick; only drop ids the store does not have
    if (this.store.loading || this.store.items.some((m): boolean => getTimelineMediaId(m) === id)) {
      return;
    }
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {[QueryParams.gallery.photo]: null},
      queryParamsHandling: 'merge',
      replaceUrl: true,
    }).catch(console.error);
  }

  retry(): void {
    this.loadMore(true);
  }

  backToNewest(): void {
    if (this.store.newDataAvailable) {
      this.store.clearSummary();
    }
    if (this.atMonth) {
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: {[TimelineComponent.AT_PARAM]: null, [QueryParams.gallery.photo]: null},
        queryParamsHandling: 'merge',
      }).catch(console.error);
    } else {
      this.store.reset();
      PageHelper.ScrollY = 0;
      this.loadMore();
    }
    this.store.loadSummary().catch(console.error);
  }

  private onQueryParams(params: Params, initial: boolean): void {
    const raw = params[TimelineComponent.AT_PARAM];
    const month = parseTimelineMonth(raw);
    if (raw !== undefined && !month) {
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: {[TimelineComponent.AT_PARAM]: null},
        queryParamsHandling: 'merge',
        replaceUrl: true,
      }).catch(console.error);
      return;
    }
    this.atMonth = month;
    this.atMonthName = month ? this.formatMonth(month, 'MMMM y') : null;
    const before = month ? getTimelineMonthEnd(month) : null;
    if (before !== this.store.startBefore) {
      this.store.reset(before);
      this.revealMediaId = null;
      this.currentMonthKey = month ? formatTimelineMonth(month) : null;
      PageHelper.ScrollY = 0;
      this.loadMore();
    } else if (initial) {
      if (this.store.items.length === 0) {
        this.loadMore();
      } else {
        this.restoreScroll();
      }
    }
  }

  private formatMonth(month: TimelineMonth, format: string): string {
    return formatDate(getTimelineMonthEnd({year: month.year, month: month.month - 1}), format, this.locale, 'UTC');
  }

  private updateRail(): void {
    if (this.railSummary === this.store.summary) {
      return;
    }
    this.railSummary = this.store.summary;
    this.railYears = (this.store.summary?.years ?? [])
      .map((y): TimelineRailYear => ({
        year: y.year,
        months: y.months
          .filter((m): boolean => m.count > 0)
          .map((m): TimelineRailMonth => ({
            key: formatTimelineMonth({year: y.year, month: m.month}),
            month: m.month,
            count: m.count,
            shortName: this.formatMonth({year: y.year, month: m.month}, 'MMM'),
            longName: this.formatMonth({year: y.year, month: m.month}, 'MMMM y'),
          }))
          .reverse(),
      }))
      .filter((y): boolean => y.months.length > 0)
      .reverse();
  }

  private updateCurrentMonth(): void {
    const photos = this.grid?.gridPhotoQL?.toArray() || [];
    for (const photo of photos) {
      if (photo.container.nativeElement.getBoundingClientRect().bottom > 0) {
        const key = formatTimelineMonth(
          getTimelineMonth(photo.gridMedia.media, Config.Gallery.ignoreTimestampOffset)
        );
        if (key !== this.currentMonthKey) {
          this.currentMonthKey = key;
          this.changeDetector.markForCheck();
        }
        return;
      }
    }
  }

  private isAvailable(): boolean {
    const user = this.authService.user.value;
    return Config.Timeline.enabled &&
      !!user &&
      !user.usedSharingKey &&
      user.role >= Config.Timeline.readAccessMinRole;
  }

  private onStoreChange(): void {
    this.updateRail();
    if (this.renderedItems !== this.store.items || this.store.items.length !== this.groupedCount()) {
      this.renderedItems = this.store.items;
      this.mediaGroups = groupTimelineByDay(
        this.store.items,
        Config.Gallery.ignoreTimestampOffset,
        (dayStart): string => formatDate(dayStart, 'longDate', this.locale, 'UTC')
      );
    }
    if (!this.store.loading) {
      this.scheduleSentinelCheck();
    }
  }

  private groupedCount(): number {
    return this.mediaGroups.reduce((count, group): number => count + group.media.length, 0);
  }

  private loadMore(retry = false): void {
    if (this.store.loading || !this.store.hasMore || (this.store.error && !retry)) {
      return;
    }
    this.store.loadNextPage().catch(console.error);
  }

  private observeSentinel(): void {
    if (typeof IntersectionObserver === 'undefined') {
      return;
    }
    this.observer = new IntersectionObserver((entries): void => {
      if (entries.some((e): boolean => e.isIntersecting)) {
        this.loadMore();
      }
    }, {rootMargin: `0px 0px ${TimelineComponent.PRELOAD_MARGIN_PX}px 0px`});
    this.observer.observe(this.sentinel.nativeElement);
  }

  // The observer only fires on transitions, so re-check once the grid rendered a new page.
  private scheduleSentinelCheck(): void {
    if (this.recheckTimer !== null) {
      clearTimeout(this.recheckTimer);
    }
    this.recheckTimer = window.setTimeout((): void => {
      this.recheckTimer = null;
      this.updateCurrentMonth();
      const top = this.sentinel.nativeElement.getBoundingClientRect().top;
      if (top < window.innerHeight + TimelineComponent.PRELOAD_MARGIN_PX) {
        this.loadMore();
      }
    }, 100);
  }

  private getScrollAnchor(): TimelineStore['scrollAnchor'] {
    const photos = this.grid?.gridPhotoQL?.toArray() || [];
    for (const photo of photos) {
      const rect = photo.container.nativeElement.getBoundingClientRect();
      if (rect.bottom > 0) {
        return {mediaId: getTimelineMediaId(photo.gridMedia.media), offset: rect.top};
      }
    }
    return null;
  }

  private restoreScroll(): void {
    const anchor = this.store.scrollAnchor;
    if (!anchor) {
      return;
    }
    let attempts = 0;
    let stableFrames = 0;
    const tryRestore = (): void => {
      this.restoreTimer = null;
      const photo = this.grid.gridPhotoQL.find(
        (p): boolean => getTimelineMediaId(p.gridMedia.media) === anchor.mediaId
      );
      if (photo) {
        const top = photo.container.nativeElement.getBoundingClientRect().top;
        // the grid keeps rendering rows below, which can clamp the first scroll; repeat until it holds
        if (Math.abs(top - anchor.offset) < 2) {
          if (++stableFrames >= 3) {
            return;
          }
        } else {
          stableFrames = 0;
          PageHelper.ScrollY = top + PageHelper.ScrollY - anchor.offset;
        }
      }
      if (++attempts < 120) {
        this.restoreTimer = requestAnimationFrame(tryRestore);
      }
    };
    this.restoreTimer = requestAnimationFrame(tryRestore);
  }
}
