import {signal} from '@angular/core';

/**
 * Browsers can't lay out a page higher than about 17.9M px (Firefox) or 33.5M px (Chrome, Safari),
 * but the grid of a huge gallery is higher (e.g. 80M px for 200k photos in large tiles).
 * So the page holds at most MAX_HEIGHT px of the grid: a window that slides over the grid.
 * The offset is where the window starts in the grid:
 *
 *   position in the grid (layout) = position in the page's grid + offset
 *
 * The grid is cut into PARTS parts, each has a fixed offset; the last one ends at the end of the window.
 * - A small scroll (wheel, keys, a finger) moves the photos as much as the page: the offset stays.
 *   Crossing into the next part changes the offset, and the page scrolls back by the same amount
 *   (see follow()): the screen stays, only the scrollbar thumb jumps back a bit.
 * - A big jump (the scrollbar thumb, the scroll handle, End) goes to the same ratio of the grid as of the page.
 *
 * A grid lower than MAX_HEIGHT has no offset: the page has the whole grid.
 * All positions here are relative to the top of the grid.
 */
export class GridScrollWindow {
  // below the lowest limit (Firefox), also with what is above the grid (e.g. a long blog); the tests set a lower one
  static MAX_HEIGHT = 15_000_000;
  // more parts: smaller but more frequent jumps of the scrollbar thumb.
  // A part has to be a few screens high in the page (about MAX_HEIGHT / PARTS): the lines rendered above the screen
  // have to fit between the start of the window and the screen. The tests set fewer parts for their lower limit.
  static PARTS = 100;

  private readonly offsetValue = signal(0);

  /** The height of the grid in the page. */
  height(total: number): number {
    return Math.min(total, GridScrollWindow.MAX_HEIGHT);
  }

  /** The offset of the window for a grid of this height (it may have been set for a higher one). */
  offset(total: number): number {
    return Math.min(this.offsetValue(), this.maxOffset(total));
  }

  /**
   * The page scrolled by `scrolled` px to `pageY` (in the page's grid).
   * Returns how many px the page has to scroll (after the render of the new offset) to keep the screen where it is; 0 if nothing.
   */
  follow(total: number, pageY: number, scrolled: number, screenHeight: number): number {
    const offset = this.offset(total);
    // A fast scroll (a fling, a smooth scroll) can move more than a screen in a frame, the scrollbar thumb moves the page
    // by about height / screenHeight per px: a big jump is at least half of that (only a degenerate low limit makes these close)
    if (Math.abs(scrolled) < Math.max(screenHeight, this.height(total) / screenHeight / 2)) {
      return this.setOffset(this.partOffset(total, pageY + offset), offset);
    }
    // a big jump: to the same ratio of the grid
    const range = this.height(total) - screenHeight;
    const ratio = range > 0 ? Math.min(1, Math.max(0, pageY / range)) : 0;
    const y = ratio * Math.max(0, total - screenHeight);
    // the screen does not stay: the photos of y are shown where the page is
    // (above the grid, e.g. its header on the screen: the top of the grid)
    this.offsetValue.set(pageY <= 0 ? 0 : Math.min(this.maxOffset(total), Math.max(0, y - pageY)));
    return 0;
  }

  /** Where the page (in the page's grid) has to be for a big jump to show y (in the grid): the inverse of the big jump of follow(). */
  bigJumpPageY(total: number, y: number, screenHeight: number): number {
    const range = this.height(total) - screenHeight;
    const gridRange = total - screenHeight;
    return range > 0 && gridRange > 0 ? Math.min(1, Math.max(0, y / gridRange)) * range : 0;
  }

  /** Sets the offset of the part of y (in the grid), e.g. before scrolling to a photo there. */
  jumpTo(total: number, y: number): void {
    this.offsetValue.set(this.partOffset(total, y));
  }

  /** The grid got lower (e.g. measured lines): keeps the smaller offset it has, so it does not come back once the grid is higher again. */
  fit(total: number): void {
    this.offsetValue.set(this.offset(total));
  }

  private setOffset(offset: number, previous: number): number {
    this.offsetValue.set(offset);
    return previous - offset;
  }

  private maxOffset(total: number): number {
    return Math.max(0, total - GridScrollWindow.MAX_HEIGHT);
  }

  private partOffset(total: number, y: number): number {
    const maxOffset = this.maxOffset(total);
    if (maxOffset === 0) {
      return 0;
    }
    const parts = GridScrollWindow.PARTS;
    const part = Math.min(parts - 1, Math.max(0, Math.floor(y / (total / parts))));
    return part * maxOffset / (parts - 1);
  }
}
