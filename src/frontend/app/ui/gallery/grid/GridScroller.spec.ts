import {GridScroller} from './GridScroller';
import {GridScrollWindow} from './GridScrollWindow';
import {PageHelper} from '../../../model/page.helper';

describe('GridScroller', () => {
  const SCREEN = window.innerHeight;
  // above the grid in the page, e.g. the directories
  const GRID_TOP = 300;
  const originalMax = GridScrollWindow.MAX_HEIGHT;
  const originalParts = GridScrollWindow.PARTS;
  let scrollY: number;
  let gridHeight: number;
  let afterRender: (() => void)[];
  let scroller: GridScroller;
  let scrollTo: ReturnType<typeof vi.spyOn>;
  let scrollBy: ReturnType<typeof vi.spyOn>;

  const render = (): void => afterRender.splice(0).forEach(cb => cb());
  // the page scrolls, then the next frame and its render
  const scroll = (y: number): void => {
    scrollY = y;
    scroller.update();
    render();
  };

  beforeEach(() => {
    scrollY = 0;
    gridHeight = 20 * SCREEN;
    afterRender = [];
    vi.spyOn(PageHelper, 'ScrollY', 'get').mockImplementation(() => scrollY);
    scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation((options) => {
      scrollY = (options as ScrollToOptions).top!;
    });
    scrollBy = vi.spyOn(window, 'scrollBy').mockImplementation((options) => {
      scrollY += (options as ScrollToOptions).top!;
    });
    scroller = new GridScroller({
      height: () => gridHeight,
      top: () => GRID_TOP,
      afterRender: cb => afterRender.push(cb)
    });
  });

  afterEach(() => {
    GridScrollWindow.MAX_HEIGHT = originalMax;
    GridScrollWindow.PARTS = originalParts;
    vi.restoreAllMocks();
  });

  it('should give the top of the screen in the grid', () => {
    expect(scroller.screenTop(), 'above the grid').toBe(-GRID_TOP);
    scrollY = GRID_TOP + 500;
    expect(scroller.screenTop()).toBe(500);
    expect(scroller.offset()).toBe(0);
    expect(scroller.pageHeight()).toBe(gridHeight);
    expect(scroller.isWindowed()).toBe(false);
  });

  it('should set the viewport to where the screen is', () => {
    scroll(GRID_TOP + 500);
    expect(scroller.viewport()).toEqual({top: 500, height: SCREEN});
  });

  it('should scroll the page at once and set the viewport there', () => {
    scroller.scrollTo(GRID_TOP + 2000);
    expect(scrollTo).toHaveBeenCalledWith({left: window.scrollX, top: GRID_TOP + 2000, behavior: 'instant'});
    expect(scroller.viewport().top).toBe(2000);
  });

  describe('scrolling after the render', () => {
    it('should render there right away and scroll after the render', () => {
      scroller.scrollToAfterRender(() => 5000);
      expect(scroller.viewport().top, 'rendered there').toBe(5000);
      expect(scrollTo).not.toHaveBeenCalled();

      render();
      expect(scrollY).toBe(GRID_TOP + 5000);
      expect(scroller.viewport().top).toBe(5000);
    });

    it('should scroll to where the target moved until the render (e.g. measured lines)', () => {
      let target = 5000;
      scroller.scrollToAfterRender(() => target);
      target = 5200;
      // the lines were measured: the page does not scroll for them, it goes to its target
      scroller.restoreScreenTop(100);
      expect(scrollBy).not.toHaveBeenCalled();
      scroller.update();
      expect(scroller.viewport().top).toBe(5200);

      render();
      expect(scrollY).toBe(GRID_TOP + 5200);
    });

    it('should not scroll if there is no target anymore (e.g. another layout)', () => {
      let target: number | null = 5000;
      scroller.scrollToAfterRender(() => target);
      target = null;
      render();
      expect(scrollTo).not.toHaveBeenCalled();

      scroller.scrollToAfterRender(() => null);
      expect(afterRender.length).toBe(0);
    });

    it('should scroll to the last target only', () => {
      scroller.scrollToAfterRender(() => 5000);
      scroller.scrollToAfterRender(() => 7000);
      render();
      expect(scrollTo).toHaveBeenCalledTimes(1);
      expect(scrollY).toBe(GRID_TOP + 7000);
    });
  });

  it('should keep the top of the screen where it was in the grid when the grid changes', () => {
    scroll(GRID_TOP + 3000);
    // the lines above the screen got 120px higher
    scroller.restoreScreenTop(3120);
    expect(scrollBy).toHaveBeenCalledWith({left: 0, top: 120, behavior: 'instant'});
    expect(scroller.screenTop()).toBe(3120);

    scrollBy.mockClear();
    scroller.restoreScreenTop(3120.2);
    expect(scrollBy, 'nothing to see').not.toHaveBeenCalled();
  });

  it('should do nothing while the grid has no layout', () => {
    gridHeight = 0;
    scroll(500);
    scroller.bigJumpTo(400);
    scroll(scrollY);
    expect(scroller.offset()).toBe(0);
    expect(scroller.bigJumpStart()).toBe(400);
    expect(afterRender.length).toBe(0);
  });

  // the page can't be this high: it holds a window of the grid, see GridScrollWindow
  describe('of a huge grid', () => {
    let max: number;

    beforeEach(() => {
      gridHeight = 300 * SCREEN;
      max = 100 * SCREEN;
      GridScrollWindow.MAX_HEIGHT = max;
      GridScrollWindow.PARTS = 4;
    });

    it('should have only a window of the grid in the page', () => {
      expect(scroller.pageHeight()).toBe(max);
      expect(scroller.isWindowed()).toBe(true);
    });

    it('should move the grid as much as the page on small scrolls, through the whole grid', () => {
      const step = SCREEN / 2;
      let expected = -GRID_TOP;
      while (expected + step < gridHeight - SCREEN) {
        scroll(scrollY + step);
        expected += step;
        expect(scroller.screenTop()).toBeCloseTo(expected);
        expect(scroller.viewport().top).toBeCloseTo(expected);
        expect(scrollY).toBeLessThanOrEqual(GRID_TOP + max);
      }
      expect(scroller.offset(), 'the window moved').toBeCloseTo(gridHeight - max);
    });

    it('should scroll the page back only with the render of the new offset', () => {
      // a screen into the second part of the grid: the window moves there
      const border = gridHeight / 4 + SCREEN;
      while (scroller.screenTop() + SCREEN / 2 < border) {
        scroll(scrollY + SCREEN / 2);
      }
      expect(scroller.offset()).toBe(0);
      scrollY += border + 10 - scroller.screenTop();
      scroller.update();
      const offset = scroller.offset();
      expect(offset).toBeGreaterThan(0);
      expect(scrollBy, 'not before the render').not.toHaveBeenCalled();
      expect(scroller.screenTop(), 'the screen stays').toBeCloseTo(gridHeight / 4 + SCREEN + 10);

      // the page scrolls on until the render
      scrollY += 20;
      render();
      expect(scrollBy).toHaveBeenCalledWith({left: 0, top: -offset, behavior: 'instant'});
      expect(scroller.screenTop()).toBeCloseTo(gridHeight / 4 + SCREEN + 30);
    });

    it('should go to the same ratio of the grid on a big jump (e.g. the scrollbar thumb)', () => {
      scroll(GRID_TOP + (max - SCREEN) / 2);
      expect(scroller.screenTop()).toBeCloseTo((gridHeight - SCREEN) / 2);
      expect(scrollBy).not.toHaveBeenCalled();
    });

    it('should scroll to a place far down in the page of its part', () => {
      const target = gridHeight * 0.8;
      scroller.scrollToAfterRender(() => target);
      expect(scroller.viewport().top).toBe(target);
      render();
      expect(scrollY).toBeLessThanOrEqual(GRID_TOP + max);
      expect(scroller.screenTop()).toBeCloseTo(target);

      // a scroll of the page itself is not a jump of the window
      scroll(scrollY + 10);
      expect(scroller.screenTop()).toBeCloseTo(target + 10);
    });

    it('should keep the top of the screen when the grid gets lower than the offset of the window allows', () => {
      scroller.scrollToAfterRender(() => gridHeight - SCREEN);
      render();
      const offset = scroller.offset();
      gridHeight -= 500;
      scroller.restoreScreenTop(gridHeight - SCREEN);
      expect(scroller.offset()).toBeCloseTo(offset - 500);
      expect(scroller.screenTop()).toBeCloseTo(gridHeight - SCREEN);
    });

    it('should start a big jump from where it does not move the grid', () => {
      for (let i = 0; i < 6; ++i) {
        scroll(scrollY + SCREEN / 2);
      }
      const top = scroller.screenTop();
      const start = scroller.bigJumpStart();
      expect(start, 'not where the page is').not.toBeCloseTo(scrollY);

      // the page still scrolls on its own: not a big jump
      scroll(scrollY + 10);
      expect(scroller.screenTop()).toBeCloseTo(top + 10);

      scroller.bigJumpTo(start);
      scroll(scrollY);
      expect(scroller.screenTop()).toBeCloseTo(top, 0);

      scroller.bigJumpTo(GRID_TOP + max - SCREEN);
      scroll(scrollY);
      expect(scroller.screenTop(), 'the end').toBeCloseTo(gridHeight - SCREEN);
    });
  });
});
