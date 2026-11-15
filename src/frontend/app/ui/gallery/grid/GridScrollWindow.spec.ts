import {GridScrollWindow} from './GridScrollWindow';

describe('GridScrollWindow', () => {
  const SCREEN = 1000;
  // 200k photos in large tiles
  const TOTAL = 80_000_000;
  // the real limit, also if it is lowered to try it out
  const MAX = 15_000_000;
  const originalMax = GridScrollWindow.MAX_HEIGHT;
  const PART = TOTAL / GridScrollWindow.PARTS;
  // the offset grows by this much from part to part, the last one ends at the end of the window
  const STEP = (TOTAL - MAX) / (GridScrollWindow.PARTS - 1);
  let scrollWindow: GridScrollWindow;

  beforeEach(() => {
    GridScrollWindow.MAX_HEIGHT = MAX;
    scrollWindow = new GridScrollWindow();
  });

  afterEach(() => {
    GridScrollWindow.MAX_HEIGHT = originalMax;
    vi.restoreAllMocks();
  });

  describe('a grid lower than the limit', () => {
    it('should be in the page as it is', () => {
      expect(scrollWindow.height(MAX - 1)).toBe(MAX - 1);
      expect(scrollWindow.follow(MAX - 1, 5000, 100, SCREEN)).toBe(0);
      expect(scrollWindow.follow(MAX - 1, MAX - 1 - SCREEN, MAX, SCREEN)).toBe(0);
      scrollWindow.jumpTo(MAX - 1, MAX / 2);
      expect(scrollWindow.offset(MAX - 1)).toBe(0);
    });
  });

  describe('a grid higher than the limit', () => {
    it('should be as high as the limit in the page', () => {
      expect(scrollWindow.height(TOTAL)).toBe(MAX);
      expect(scrollWindow.offset(TOTAL)).toBe(0);
    });

    // Chrome's limit is in device px: an Android phone cut the end of a 15M px high page
    it('should be lower in the page on a screen of a high pixel ratio (a phone, a zoomed page)', () => {
      vi.spyOn(window, 'devicePixelRatio', 'get').mockReturnValue(2.625);
      const height = scrollWindow.height(TOTAL);
      expect(height * 2.625).toBeLessThan(33_554_432);
      expect(height).toBeGreaterThan(10_000_000);
      // the window still ends at the end of the grid
      scrollWindow.follow(TOTAL, height - SCREEN, Infinity, SCREEN);
      expect(scrollWindow.offset(TOTAL)).toBe(TOTAL - height);
    });

    it('should move the photos as much as the page on a small scroll, inside a part', () => {
      expect(scrollWindow.follow(TOTAL, 500, 500, SCREEN)).toBe(0);
      expect(scrollWindow.follow(TOTAL, PART - 1, SCREEN - 1, SCREEN)).toBe(0);
      expect(scrollWindow.offset(TOTAL)).toBe(0);
    });

    it('should keep the screen when a small scroll crosses into the next part, and scroll the page back', () => {
      // a screen into the second part
      const y = PART + SCREEN + 10;
      expect(scrollWindow.follow(TOTAL, y, 20, SCREEN)).toBeCloseTo(-STEP);
      expect(scrollWindow.offset(TOTAL)).toBeCloseTo(STEP);
      // the page scrolled back: the same place of the grid
      const pageY = y - STEP;
      expect(pageY + scrollWindow.offset(TOTAL)).toBeCloseTo(y);

      // and back up, a screen into the first part
      expect(scrollWindow.follow(TOTAL, pageY - 2 * SCREEN - 20, -20, SCREEN)).toBeCloseTo(STEP);
      expect(scrollWindow.offset(TOTAL)).toBe(0);
    });

    it('should not switch back and forth when a scroll rests on the border of two parts', () => {
      expect(scrollWindow.follow(TOTAL, PART + 10, 20, SCREEN), 'just over the border').toBe(0);
      expect(scrollWindow.follow(TOTAL, PART - 10, -20, SCREEN)).toBe(0);
      expect(scrollWindow.offset(TOTAL)).toBe(0);

      scrollWindow.follow(TOTAL, PART + SCREEN + 10, SCREEN, SCREEN);
      const pageY = PART - STEP;
      expect(scrollWindow.follow(TOTAL, pageY - 10, -SCREEN - 20, SCREEN), 'just back over the border').toBe(0);
      expect(scrollWindow.follow(TOTAL, pageY + 10, 20, SCREEN)).toBe(0);
      expect(scrollWindow.offset(TOTAL)).toBeCloseTo(STEP);
    });

    it('should keep the offset inside a part when the grid changes its height a bit (e.g. measured lines)', () => {
      const y = 50.5 * PART;
      scrollWindow.jumpTo(TOTAL, y);
      const offset = scrollWindow.offset(TOTAL);
      expect(scrollWindow.follow(TOTAL + 200, y - offset + 10, 10, SCREEN)).toBe(0);
      expect(scrollWindow.offset(TOTAL + 200)).toBe(offset);
    });

    it('should end the last part at the end of the grid, also when the grid gets higher', () => {
      scrollWindow.jumpTo(TOTAL, TOTAL - SCREEN);
      expect(scrollWindow.follow(TOTAL + 200, MAX - SCREEN, 10, SCREEN)).toBeCloseTo(-200);
      expect(scrollWindow.offset(TOTAL + 200)).toBeCloseTo(TOTAL + 200 - MAX);
    });

    it('should move the photos as much as the page on a fast scroll of a few screens in a frame (a fling)', () => {
      const y = PART + 2 * SCREEN;
      expect(scrollWindow.follow(TOTAL, y, 3 * SCREEN, SCREEN)).toBeCloseTo(-STEP);
      expect(y - STEP + scrollWindow.offset(TOTAL)).toBeCloseTo(y);
    });

    it('should reach the end of the grid at the end of the page with small scrolls', () => {
      scrollWindow.jumpTo(TOTAL, TOTAL - SCREEN);
      expect(scrollWindow.offset(TOTAL)).toBeCloseTo(TOTAL - MAX);
      expect(scrollWindow.follow(TOTAL, MAX - SCREEN, 100, SCREEN)).toBe(0);
      expect(MAX - SCREEN + scrollWindow.offset(TOTAL)).toBeCloseTo(TOTAL - SCREEN);
    });

    it('should keep the page inside the window in every part', () => {
      for (let part = 0; part < GridScrollWindow.PARTS; ++part) {
        for (const y of [part * PART, (part + 1) * PART - 1]) {
          scrollWindow.jumpTo(TOTAL, y);
          const pageY = y - scrollWindow.offset(TOTAL);
          expect(pageY).toBeGreaterThanOrEqual(0);
          expect(pageY).toBeLessThanOrEqual(MAX);
        }
      }
    });

    it('should go to the same ratio of the grid on a big jump, without scrolling the page', () => {
      // the scrollbar thumb dragged to the middle
      const pageY = (MAX - SCREEN) / 2;
      expect(scrollWindow.follow(TOTAL, pageY, pageY, SCREEN)).toBe(0);
      expect(pageY + scrollWindow.offset(TOTAL)).toBeCloseTo((TOTAL - SCREEN) / 2);

      // End
      expect(scrollWindow.follow(TOTAL, MAX - SCREEN, MAX / 2, SCREEN)).toBe(0);
      expect(MAX - SCREEN + scrollWindow.offset(TOTAL)).toBeCloseTo(TOTAL - SCREEN);

      // Home
      expect(scrollWindow.follow(TOTAL, 0, -(MAX - SCREEN), SCREEN)).toBe(0);
      expect(scrollWindow.offset(TOTAL)).toBe(0);
    });

    // the thumb moves by a device pixel: a third of a CSS pixel here
    it('should take a slow drag of the scrollbar thumb as a big jump on a high density screen', () => {
      vi.spyOn(window, 'devicePixelRatio', 'get').mockReturnValue(3);
      const height = scrollWindow.height(TOTAL);
      const pageY = (height - SCREEN) / 2;
      expect(scrollWindow.follow(TOTAL, pageY, height / SCREEN / 3, SCREEN)).toBe(0);
      expect(pageY + scrollWindow.offset(TOTAL)).toBeCloseTo((TOTAL - SCREEN) / 2);
    });

    // snapping to the offset of the part would scroll the page, e.g. under the held scrollbar thumb or a smooth scroll
    it('should keep the window of a big jump while the page does not scroll (e.g. its lines are measured)', () => {
      const pageY = (MAX - SCREEN) * 0.63;
      scrollWindow.follow(TOTAL, pageY, Infinity, SCREEN);
      const offset = scrollWindow.offset(TOTAL);
      expect(scrollWindow.follow(TOTAL, pageY, 0, SCREEN)).toBe(0);
      expect(scrollWindow.offset(TOTAL)).toBe(offset);

      // a small scroll gets the offset of its part, the screen stays
      const shift = scrollWindow.follow(TOTAL, pageY + 10, 10, SCREEN);
      expect(shift).not.toBe(0);
      expect(scrollWindow.offset(TOTAL) + shift).toBeCloseTo(offset);
    });

    it('should give where a big jump has to go to show a place of the grid', () => {
      for (const y of [0, PART / 2, TOTAL / 3, TOTAL - SCREEN]) {
        const pageY = scrollWindow.bigJumpPageY(TOTAL, y, SCREEN);
        scrollWindow.follow(TOTAL, pageY, Infinity, SCREEN);
        expect(pageY + scrollWindow.offset(TOTAL), String(y)).toBeCloseTo(y);
      }
      expect(scrollWindow.bigJumpPageY(MAX - 1, 5000, SCREEN), 'the page has the whole grid').toBeCloseTo(5000);
    });

    it('should show the top of the grid on a big jump above it (e.g. to its header)', () => {
      scrollWindow.jumpTo(TOTAL, TOTAL / 2);
      expect(scrollWindow.follow(TOTAL, -100, -MAX / 2, SCREEN)).toBe(0);
      expect(scrollWindow.offset(TOTAL)).toBe(0);
    });

    it('should snap to the offset of the part on the next small scroll after a big jump', () => {
      const pageY = (MAX - SCREEN) / 3;
      scrollWindow.follow(TOTAL, pageY, pageY, SCREEN);
      const y = pageY + scrollWindow.offset(TOTAL);

      const shift = scrollWindow.follow(TOTAL, pageY + 10, 10, SCREEN);
      // the same place of the grid on the screen
      expect(pageY + 10 + shift + scrollWindow.offset(TOTAL)).toBeCloseTo(y + 10);
      expect(scrollWindow.offset(TOTAL)).toBeCloseTo(Math.floor((y + 10) / PART) * STEP);
    });

    it('should keep a smaller offset for a lower grid', () => {
      scrollWindow.jumpTo(TOTAL, TOTAL - 1);
      const lower = MAX + 1000;
      expect(scrollWindow.offset(lower)).toBe(1000);
      scrollWindow.fit(lower);
      expect(scrollWindow.offset(TOTAL), 'not back once higher again').toBe(1000);

      scrollWindow.fit(MAX - 1);
      expect(scrollWindow.offset(TOTAL)).toBe(0);
    });
  });
});
