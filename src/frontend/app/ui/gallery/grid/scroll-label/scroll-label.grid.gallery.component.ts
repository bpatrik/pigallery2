import {Component, OnDestroy, computed, inject, input, output, signal} from '@angular/core';
import {NgIconComponent} from '@ng-icons/core';
import {GridLayout} from '../GridLayout';
import {GridScroller} from '../GridScroller';
import {GallerySortingService, ScrollLabelFn} from '../../navigator/sorting.service';
import {GroupByTypes, SortByDirectionalTypes} from '../../../../../../common/entities/SortingMethods';
import {PageHelper} from '../../../../model/page.helper';
import {ScrollRestorationService} from '../../../../model/scroll-restoration.service';

/**
 * The label of the first visible photo of the grid (e.g. its month), next to the scrollbar thumb while the page scrolls (#1209).
 * On a touch screen it is also a handle to drag the page with, like the thumb of a scrollbar.
 */
@Component({
  selector: 'app-gallery-grid-scroll-label',
  host: {
    '(window:scroll)': 'onScroll()'
  },
  templateUrl: './scroll-label.grid.gallery.component.html',
  styleUrl: './scroll-label.grid.gallery.component.css',
  imports: [NgIconComponent]
})
export class GalleryGridScrollLabelComponent implements OnDestroy {
  private sortingService = inject(GallerySortingService);
  private scrollRestoration = inject(ScrollRestorationService);

  readonly layout = input.required<GridLayout | null>();
  readonly scroller = input.required<GridScroller>();
  /** The handle got grabbed (true) or released (false). */
  readonly dragChange = output<boolean>();

  public readonly GroupByTypes = GroupByTypes;
  // no scrollbar thumb to drag on a phone: the label is a handle there
  readonly touchOnly = typeof window.matchMedia === 'function' && window.matchMedia('(hover: none)').matches;
  readonly scrollLabel = signal<ScrollLabel | null>(null);
  // the top of the dragged handle on the screen; null if it is not dragged
  readonly dragTop = signal<number | null>(null);
  readonly dragging = computed(() => this.dragTop() !== null);
  // the dragged handle: where the finger holds it, and where the handle and the page were when it was grabbed
  private drag: { pointerId: number, offset: number, startTop: number, startScrollY: number } | null = null;
  private frame: number | null = null;
  private hideTimer: number | null = null;

  ngOnDestroy(): void {
    if (this.frame !== null) {
      cancelAnimationFrame(this.frame);
      this.frame = null;
    }
    if (this.hideTimer !== null) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
  }

  onScroll(): void {
    if (this.frame !== null) {
      return;
    }
    // a browser back or forward scrolls the page itself (#1308), the user did not scroll
    if (this.scrollRestoration.restoreTarget() !== null || (!this.touchOnly && !this.labelFn())) {
      this.scrollLabel.set(null);
      return;
    }
    this.frame = window.requestAnimationFrame((): void => {
      this.frame = null;
      this.update();
    });
  }

  onHandlePointerDown(event: PointerEvent): void {
    const label = this.scrollLabel();
    if (!label?.handle) {
      return;
    }
    event.preventDefault();
    const handle = event.currentTarget as HTMLElement;
    handle.setPointerCapture?.(event.pointerId);
    const top = handle.getBoundingClientRect().top;
    const startTop = Math.min(window.innerHeight - handle.offsetHeight, Math.max(label.navbarBottom, top));
    // the drag is a big jump of the page: it starts from where a big jump shows what the screen shows
    this.drag = {pointerId: event.pointerId, offset: event.clientY - top, startTop, startScrollY: this.scroller().bigJumpStart()};
    this.dragTop.set(startTop);
    this.dragChange.emit(true);
  }

  /** The handle follows the finger and scrolls the page, like the thumb of a scrollbar. */
  onHandlePointerMove(event: PointerEvent): void {
    const label = this.scrollLabel();
    if (!this.drag || event.pointerId !== this.drag.pointerId || !label) {
      return;
    }
    event.preventDefault();
    const handle = event.currentTarget as HTMLElement;
    const track = {top: label.navbarBottom, bottom: window.innerHeight - handle.offsetHeight};
    if (track.bottom <= track.top) {
      return;
    }
    const top = Math.min(track.bottom, Math.max(track.top, event.clientY - this.drag.offset));
    this.dragTop.set(top);
    this.scroller().bigJumpTo(GalleryGridScrollLabelComponent.dragScrollY(top, track, this.drag, PageHelper.MaxScrollY));
  }

  onHandlePointerUp(event: PointerEvent): void {
    if (!this.drag || event.pointerId !== this.drag.pointerId) {
      return;
    }
    this.drag = null;
    this.dragTop.set(null);
    this.dragChange.emit(false);
    this.hideLater();
  }

  /**
   * Where the page is when the handle is at top, between the ends of its track.
   * Grabbing the handle does not move the page, also where the handle is not exactly where a scrollbar thumb would be
   * (below the navbar, a huge grid): at its start the page is where it was, above it the page scrolls up to its top,
   * below it down to its end.
   */
  private static dragScrollY(top: number, track: { top: number, bottom: number }, start: { startTop: number, startScrollY: number }, maxScrollY: number): number {
    const {startTop, startScrollY} = start;
    if (top < startTop) {
      return startScrollY * (top - track.top) / (startTop - track.top);
    }
    if (top > startTop) {
      return startScrollY + (maxScrollY - startScrollY) * (top - startTop) / (track.bottom - startTop);
    }
    return startScrollY;
  }

  /**
   * The middle of the scrollbar thumb on the screen. A classic scrollbar (Windows) has an arrow button at both ends,
   * about as high as the bar is wide, and the thumb is at least a bit higher (measured on Chrome on Windows: 20px of a 15px bar);
   * an overlay scrollbar has no width.
   * Between the buttons, the thumb is as much of the track as the screen is of the page.
   */
  private static thumbCenter(scrollY: number, maxScrollY: number): number {
    const screen = window.innerHeight;
    const width = document.documentElement.clientWidth;
    const bar = width > 0 ? Math.max(0, window.innerWidth - width) : 0;
    const track = screen - 2 * bar;
    const thumb = Math.max(bar * 4 / 3, track * screen / (maxScrollY + screen));
    return bar + Math.min(1, Math.max(0, scrollY / maxScrollY)) * (track - thumb) + thumb / 2;
  }

  private labelFn(): ScrollLabelFn | null {
    return this.sortingService.getScrollLabelFn(this.sortingService.sorting(), this.sortingService.grouping());
  }

  private update(): void {
    const maxScrollY = PageHelper.MaxScrollY;
    const labelFn = this.labelFn();
    const navbarBottom = PageHelper.NavbarBottom;
    // the first photo that is not scrolled out at the top or hidden behind the navbar
    const media = this.layout()?.firstMediaAt(this.scroller().screenTop() + navbarBottom) ?? null;
    const text = labelFn && media?.metadata ? labelFn.label(media) : '';
    // on a touch screen it is the handle to drag the page, also without a label; only for long pages
    const handle = this.touchOnly && maxScrollY > window.innerHeight * HANDLE_MIN_SCREENS;
    if (maxScrollY <= 0 || (!text && !handle)) {
      this.scrollLabel.set(null);
      return;
    }
    const order = labelFn?.order ?? null;
    const rating = text && order === GroupByTypes.Rating ? parseInt(text, 10) : null;
    this.scrollLabel.set({
      text,
      order,
      handle,
      // like the group header of the rating
      stars: rating === null ? [] : [0, 1, 2, 3, 4].map(i => i < rating),
      thumbCenter: GalleryGridScrollLabelComponent.thumbCenter(PageHelper.ScrollY, maxScrollY),
      navbarBottom
    });
    this.hideLater();
  }

  private hideLater(): void {
    if (this.hideTimer !== null) {
      clearTimeout(this.hideTimer);
    }
    this.hideTimer = window.setTimeout((): void => {
      this.hideTimer = null;
      if (!this.drag) {
        this.scrollLabel.set(null);
      }
    }, this.touchOnly ? HANDLE_VISIBLE_MS : LABEL_VISIBLE_MS);
  }
}

const LABEL_VISIBLE_MS = 1000;
// longer on a touch screen: it is there to be grabbed
const HANDLE_VISIBLE_MS = 2000;
// a page shorter than this many screens scrolls well without the handle
const HANDLE_MIN_SCREENS = 3;

interface ScrollLabel {
  text: string;
  order: SortByDirectionalTypes | null;
  handle: boolean; // it can be dragged
  stars: boolean[]; // filled or not, for the rating order
  thumbCenter: number; // px from the top of the screen, the middle of the scrollbar thumb
  navbarBottom: number; // px, the label stays below the navbar
}
