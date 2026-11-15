import {signal} from '@angular/core';
import {GridScrollWindow} from './GridScrollWindow';
import {PageHelper} from '../../../model/page.helper';

// a scroll that comes this soon after a big jump is still a part of it (e.g. the next frame of a smooth scroll)
const BIG_JUMP_REST_MS = 150;
// the scrolls this long after the wheel, a key or a finger moved are theirs (e.g. their smooth scroll, a fling)
const DIRECT_SCROLL_MS = 1000;
const DIRECT_SCROLL_EVENTS = ['wheel', 'keydown', 'touchstart', 'touchmove'];

/** What the scroller has to know of the grid it scrolls. */
export interface ScrolledGrid {
  /** The height of the whole grid; 0 while it has no layout. */
  height(): number;

  /** The top of the grid in the page. */
  top(): number;

  /** Runs the callback after the next render of the grid; never after the grid is removed. */
  afterRender(callback: () => void): void;
}

/**
 * The scroll position of the grid: the only place that reads and sets the scroll position of the page for the grid.
 *
 * There are two kinds of positions:
 * - in the page (pageY): what window.scrollTo() takes
 * - in the grid (gridY): 0 is the top of the grid, what the GridLayout takes
 *
 *   pageY = top of the grid in the page + gridY - offset
 *
 * The offset is 0, except for a huge grid: the page holds only a window of it, see GridScrollWindow.
 * The users of the scroller only use positions in the grid, they don't have to know of the window.
 */
export class GridScroller {
  /** The shown part of the grid (in the grid): the lines on and near it are rendered. Set by update(). */
  readonly viewport = signal<{ top: number, height: number }>({top: 0, height: window.innerHeight});
  private readonly scrollWindow = new GridScrollWindow();
  // the scroll position of the page the window followed last
  private followedScrollY = PageHelper.ScrollY;
  // the scroll that keeps the screen after the window got a new offset: it is done after the render of the new offset
  private pendingShift = 0;
  // the next scroll is a big jump, see bigJumpTo()
  private bigJump = false;
  // the scrolls until then are parts of the last big jump, see BIG_JUMP_REST_MS
  private bigJumpUntil = 0;
  // the scrolls until then are of the wheel, the keys or a finger: never a big jump, however fast they are
  private directScrollUntil = 0;
  private readonly onDirectInput = (event: Event): void => {
    const key = (event as KeyboardEvent).key;
    // Home and End go to the start and the end of the grid
    this.directScrollUntil = key === 'Home' || key === 'End' ? 0 : performance.now() + DIRECT_SCROLL_MS;
  };
  // where the page scrolls after the next render (in the grid), see scrollToAfterRender()
  private pendingTarget: (() => number | null) | null = null;

  constructor(private readonly grid: ScrolledGrid) {
    DIRECT_SCROLL_EVENTS.forEach(e => window.addEventListener(e, this.onDirectInput, {capture: true, passive: true}));
  }

  /** The grid is removed. */
  destroy(): void {
    DIRECT_SCROLL_EVENTS.forEach(e => window.removeEventListener(e, this.onDirectInput, {capture: true}));
  }

  /** The height of the grid in the page: lower than the grid if it is huge. */
  pageHeight(): number {
    return this.scrollWindow.height(this.grid.height());
  }

  /** The not rendered part of a huge grid above the page; 0 if the page has the whole grid. */
  offset(): number {
    return this.scrollWindow.offset(this.grid.height());
  }

  /** The page holds only a window of the grid. */
  isWindowed(): boolean {
    return this.grid.height() > this.pageHeight();
  }

  /** The top of the screen in the grid; negative above the grid. */
  screenTop(): number {
    return this.scrollY() - this.grid.top() + this.offset();
  }

  /** The page scrolled, or the grid moved in it: the window of a huge grid follows it, and the viewport is where the screen is. */
  update(): void {
    // the page did not scroll to its target yet: it is not a scroll to follow
    if (this.pendingTarget === null) {
      this.follow();
    }
    this.viewport.set({top: this.pendingTarget?.() ?? this.screenTop(), height: window.innerHeight});
  }

  /** Scrolls the page to pageY (in the page) at once, also if the page has smooth scrolling. */
  scrollTo(pageY: number): void {
    window.scrollTo({left: window.scrollX, top: pageY, behavior: 'instant'});
    // it is in the page of the current offset: not a scroll the window follows
    this.pendingShift = 0;
    this.bigJumpUntil = 0;
    this.followedScrollY = PageHelper.ScrollY;
    // the lines of the new position render right away, not on the next scroll event
    this.update();
  }

  /**
   * Renders the lines at gridY() (in the grid), then scrolls there.
   * The page may not be high enough to scroll there before that render (e.g. when the grid just got its content).
   * gridY() is asked again after the render: the place can move until then (the lines above it are measured);
   * null if there is nowhere to scroll anymore (e.g. the grid got another layout).
   */
  scrollToAfterRender(gridY: () => number | null): void {
    const y = gridY();
    if (y === null) {
      return;
    }
    // a huge grid shows that part of it in the page
    this.scrollWindow.jumpTo(this.grid.height(), y);
    this.pendingShift = 0;
    this.pendingTarget = gridY;
    this.update();
    this.grid.afterRender(() => {
      const target = this.pendingTarget?.() ?? null;
      this.pendingTarget = null;
      if (target !== null) {
        this.scrollTo(this.grid.top() + target - this.offset());
      }
    });
  }

  /**
   * The grid changed its height (e.g. the rendered lines were measured), what was on the screen moved:
   * scrolls the page so that the top of the screen is at gridY (in the grid) again.
   */
  restoreScreenTop(gridY: number): void {
    // a lower grid can need a smaller offset of the window
    this.scrollWindow.fit(this.grid.height());
    const shift = gridY - this.screenTop();
    // a pending scroll goes to its target, wherever it moved
    if (Math.abs(shift) < 0.5 || this.pendingTarget !== null) {
      return;
    }
    window.scrollBy({left: 0, top: shift, behavior: 'instant'});
    this.followedScrollY += shift;
  }

  /**
   * Scrolls the page to pageY (in the page) like the scrollbar thumb does: to the same ratio of the grid as of the page,
   * see GridScrollWindow. E.g. the scroll handle of a touch screen.
   */
  bigJumpTo(pageY: number): void {
    // only the scroll of this jump: the page can still scroll on its own until then (e.g. the handle is grabbed in a fling)
    this.bigJump = true;
    window.scrollTo({left: window.scrollX, top: pageY, behavior: 'instant'});
  }

  /** Where bigJumpTo() has to go (in the page) to show what the screen shows now: a jump that starts from there does not move the photos. */
  bigJumpStart(): number {
    const gridY = this.screenTop();
    if (this.grid.height() <= 0 || gridY <= 0) {
      return this.scrollY();
    }
    return this.grid.top() + this.scrollWindow.bigJumpPageY(this.grid.height(), gridY, window.innerHeight);
  }

  /** The scroll position of the page, also with the scroll that waits for the render of a new offset. */
  private scrollY(): number {
    return PageHelper.ScrollY + this.pendingShift;
  }

  /** The window of a huge grid follows the scroll of the page, see GridScrollWindow. */
  private follow(): void {
    const scrollY = this.scrollY();
    const scrolled = scrollY - this.followedScrollY;
    const now = performance.now();
    const total = this.grid.height();
    // The slow end of a smooth scroll (e.g. End) is still that jump: as a small scroll it could get into another part,
    // and the scroll that keeps the screen then would stop the smooth scroll before its target
    // A burst of PageDown or a free spinning wheel is as fast as the scrollbar thumb, but moves the photos as much as the page
    const bigJump = this.bigJump || (now >= this.directScrollUntil && (
      (scrolled !== 0 && now < this.bigJumpUntil) || (total > 0 && this.scrollWindow.isBigJump(total, scrolled, window.innerHeight))));
    this.bigJump = false;
    this.followedScrollY = scrollY;
    if (total <= 0) {
      return;
    }
    if (bigJump) {
      this.bigJumpUntil = now + BIG_JUMP_REST_MS;
    }
    // not a big jump: at most a screen, whatever it scrolled
    const followed = bigJump ? Infinity : Math.sign(scrolled) * Math.min(Math.abs(scrolled), window.innerHeight - 1);
    const shift = this.scrollWindow.follow(total, scrollY - this.grid.top(), followed, window.innerHeight);
    if (Math.abs(shift) < 0.5) {
      return;
    }
    // the page scrolls with the render of the new offset (the paddings): not before, not a frame later, or the screen jumps.
    // Relative: the page may scroll on until then (e.g. a fling)
    const queued = this.pendingShift !== 0;
    this.pendingShift += shift;
    this.followedScrollY += shift;
    if (queued) {
      return;
    }
    this.grid.afterRender(() => {
      const pending = this.pendingShift;
      this.pendingShift = 0;
      if (pending !== 0) {
        window.scrollBy({left: 0, top: pending, behavior: 'instant'});
      }
    });
  }
}
