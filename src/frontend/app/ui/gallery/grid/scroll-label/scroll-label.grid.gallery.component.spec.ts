import {ComponentFixture, TestBed} from '@angular/core/testing';
import {signal} from '@angular/core';
import {formatDate} from '@angular/common';
import {provideIcons} from '@ng-icons/core';

import {GalleryGridScrollLabelComponent} from './scroll-label.grid.gallery.component';
import {GridLayout} from '../GridLayout';
import {GridScroller} from '../GridScroller';
import {GallerySortingService, ScrollLabelFn} from '../../navigator/sorting.service';
import {GroupByTypes, SortByTypes} from '../../../../../../common/entities/SortingMethods';
import {PhotoDTO} from '../../../../../../common/entities/PhotoDTO';
import {MediaDTO} from '../../../../../../common/entities/MediaDTO';
import {PageHelper} from '../../../../model/page.helper';
import {ScrollRestorationService} from '../../../../model/scroll-restoration.service';
import {appIcons} from '../../../../icons';

class MockGallerySortingService {
  readonly sorting = signal({method: SortByTypes.Date, ascending: false});
  readonly grouping = signal({method: GroupByTypes.NoGrouping, ascending: true});
  // the real labels are tested with the sorting service
  scrollLabelFn: ScrollLabelFn | null = {
    order: SortByTypes.Date,
    label: (m: MediaDTO) => formatDate(m.metadata.creationDate, 'MMMM y', 'en-US', 'UTC')
  };

  getScrollLabelFn(): ScrollLabelFn | null {
    return this.scrollLabelFn;
  }
}

// #1209: the month and year of the first visible photo next to the scrollbar
describe('GalleryGridScrollLabelComponent', () => {
  let sortingService: MockGallerySortingService;
  let component: GalleryGridScrollLabelComponent;
  let fixture: ComponentFixture<GalleryGridScrollLabelComponent>;
  let layout: GridLayout;
  let scroller: GridScroller;
  let scrollY: number;
  let restoreTarget: number | null;
  let frames: FrameRequestCallback[];

  // a scroll event, then the next frame
  const scroll = (y: number): void => {
    scrollY = y;
    window.dispatchEvent(new Event('scroll'));
    frames.splice(0).forEach(cb => cb(0));
    fixture.detectChanges();
  };
  const label = (): HTMLElement | null => fixture.nativeElement.querySelector('.scroll-label');
  // the line of the first March photo; its line has June photos too
  const marchLine = (): number => layout.lines.findIndex(l => l.segments[0].media.some(m => m.media.name === '30.jpg'));

  beforeEach(async () => {
    // timers only: the frames are counted by the test
    vi.useFakeTimers({toFake: ['setTimeout', 'clearTimeout']});
    scrollY = 0;
    restoreTarget = null;
    frames = [];
    vi.spyOn(PageHelper, 'ScrollY', 'get').mockImplementation(() => scrollY);
    vi.spyOn(PageHelper, 'MaxScrollY', 'get').mockImplementation(() => Math.max(0, layout.totalHeight - window.innerHeight));
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback): number => {
      frames.push(cb);
      return frames.length;
    });
    await TestBed.configureTestingModule({
      imports: [GalleryGridScrollLabelComponent],
      providers: [
        provideIcons(appIcons),
        {provide: GallerySortingService, useClass: MockGallerySortingService},
        {provide: ScrollRestorationService, useValue: {restoreTarget: () => restoreTarget}}
      ]
    }).compileComponents();
    sortingService = TestBed.inject(GallerySortingService) as unknown as MockGallerySortingService;

    // newest first, 30 photos of every month; the grid is at the top of the page
    const photos: PhotoDTO[] = [];
    for (let i = 0; i < 60; ++i) {
      photos.push({
        name: i + '.jpg',
        directory: {name: 'd', path: 'p'},
        metadata: {size: {width: 3000, height: 2000}, creationDate: Date.UTC(2021, i < 30 ? 5 : 2, 15, 12)}
      } as PhotoDTO);
    }
    layout = new GridLayout([{name: '', media: photos}], {
      width: 1000, screenHeight: window.innerHeight, targetColCount: 5, minRowCount: 2, maxRowCount: 5, imageMargin: 2, headerHeight: 56
    });
    scroller = new GridScroller({height: () => layout.totalHeight, top: () => 0, afterRender: () => undefined});

    fixture = TestBed.createComponent(GalleryGridScrollLabelComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('layout', layout);
    fixture.componentRef.setInput('scroller', scroller);
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should show the month and year of the first visible photo', () => {
    expect(label(), 'only while scrolling').toBeNull();
    scroll(layout.top(1) + 1);
    expect(label()?.textContent?.trim()).toBe('June 2021');
    expect(label()?.classList.contains('handle'), 'only on a touch screen').toBe(false);
    expect(label()?.style.top, 'the CSS puts it next to the thumb').toBe('');
    const thumb = innerHeight * innerHeight / (PageHelper.MaxScrollY + innerHeight);
    const thumbCenter = (): number => parseFloat(label()?.style.getPropertyValue('--thumb-center') ?? '');
    expect(thumbCenter()).toBeCloseTo(scrollY / PageHelper.MaxScrollY * (innerHeight - thumb) + thumb / 2);

    scroll(layout.top(marchLine() + 1));
    expect(label()?.textContent?.trim()).toBe('March 2021');

    scroll(PageHelper.MaxScrollY + 100);
    expect(thumbCenter(), 'the thumb at the bottom').toBeCloseTo(innerHeight - thumb / 2);
  });

  it('should be next to the thumb between the arrow buttons of a classic scrollbar', () => {
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(innerWidth - 15);
    const thumbCenter = (): number => parseFloat(label()?.style.getPropertyValue('--thumb-center') ?? '');
    scroll(0);
    scroll(1);
    const thumb = Math.max(20, (innerHeight - 30) * innerHeight / (PageHelper.MaxScrollY + innerHeight));
    expect(thumbCenter(), 'below the button at the top').toBeCloseTo(15 + 1 / PageHelper.MaxScrollY * (innerHeight - 30 - thumb) + thumb / 2);
    scroll(PageHelper.MaxScrollY + 100);
    expect(thumbCenter(), 'above the button at the bottom').toBeCloseTo(innerHeight - 15 - thumb / 2);
  });

  it('should hide after the scrolling stopped', async () => {
    scroll(250);
    expect(label()).not.toBeNull();
    await vi.advanceTimersByTimeAsync(1500);
    fixture.detectChanges();
    expect(label()).toBeNull();
  });

  it('should show the label of the sorting service', () => {
    sortingService.scrollLabelFn = {order: SortByTypes.Name, label: (m: MediaDTO) => m.name.at(0) ?? ''};
    scroll(layout.top(1) + 1);
    expect(label()?.textContent?.trim()).toBe(layout.lines[1].segments[0].media[0].media.name.at(0));
  });

  it('should not show when the sorting service has no label', () => {
    sortingService.scrollLabelFn = null;
    scroll(250);
    expect(label()).toBeNull();
  });

  it('should not show while the grid has no layout', () => {
    fixture.componentRef.setInput('layout', null);
    scroll(250);
    expect(label()).toBeNull();
  });

  it('should be hidden from assistive technologies', () => {
    scroll(250);
    expect(label()?.getAttribute('aria-hidden')).toBe('true');
  });

  it('should skip the photos behind the navbar', () => {
    const navbar = document.createElement('div');
    navbar.className = 'navbar-container';
    navbar.getBoundingClientRect = () => ({bottom: 100} as DOMRect);
    document.body.appendChild(navbar);
    try {
      // the line of the first March photo is behind the navbar, the next one is the first visible one
      scroll(layout.top(marchLine() + 1) - 50);
      expect(label()?.textContent?.trim()).toBe('March 2021');
      expect(label()?.style.getPropertyValue('--navbar-bottom'), 'the label stays below the navbar').toBe('100px');
    } finally {
      navbar.remove();
    }
  });

  it('should show the rating with stars like the group headers', () => {
    sortingService.scrollLabelFn = {order: SortByTypes.Rating, label: () => '3'};
    scroll(250);
    const stars = [...(label()?.querySelectorAll('ng-icon') ?? [])].map(i => i.innerHTML);
    expect(stars.length).toBe(5);
    expect(stars[0]).not.toBe('');
    // 3 filled, 2 outlined
    expect(stars.filter(s => s === stars[0]).length).toBe(3);
    expect(stars[3]).toBe(stars[4]);
    expect(stars[3]).not.toBe(stars[0]);
    expect(label()?.textContent?.trim()).toBe('');
  });

  it('should show the person count with the people icon like the group headers', () => {
    sortingService.scrollLabelFn = {order: SortByTypes.PersonCount, label: () => '2'};
    scroll(250);
    expect(label()?.textContent?.trim()).toBe('2');
    expect(label()?.querySelectorAll('ng-icon').length).toBe(1);
  });

  // #1308: browser back or forward scrolls the page itself
  it('should not show while the scroll position of a browser back is restored', () => {
    restoreTarget = 250;
    scroll(250);
    expect(label()).toBeNull();
    restoreTarget = null; // the user scrolls
    scroll(260);
    expect(label()).not.toBeNull();
  });

  it('should not update after it is removed', () => {
    const cancel = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
    scrollY = 250;
    const frame = frames.length + 1; // the label asks for the next frame
    component.onScroll();
    fixture.destroy();
    expect(cancel).toHaveBeenCalledWith(frame);
  });

  it('should not show when there is nothing to scroll', () => {
    vi.spyOn(PageHelper, 'MaxScrollY', 'get').mockReturnValue(0);
    scroll(0);
    expect(label()).toBeNull();
  });

  describe('on a touch screen', () => {
    let scrollTo: ReturnType<typeof vi.spyOn>;
    let drags: boolean[];
    // the handle on the screen: 40px high, 100px from the top
    const handle = {getBoundingClientRect: () => ({top: 100}), offsetHeight: 40} as unknown as HTMLElement;
    const pointer = (clientY: number, pointerId = 1): PointerEvent =>
      ({pointerId, clientY, currentTarget: handle, preventDefault: () => undefined} as unknown as PointerEvent);

    beforeEach(() => {
      (component as unknown as { touchOnly: boolean }).touchOnly = true;
      // a long page
      vi.spyOn(PageHelper, 'MaxScrollY', 'get').mockReturnValue(10000);
      scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
      drags = [];
      component.dragChange.subscribe(d => drags.push(d));
    });

    it('should be a handle to drag, also without a label', () => {
      sortingService.scrollLabelFn = null;
      scroll(250);
      expect(label()?.classList.contains('handle')).toBe(true);
      expect(label()?.textContent?.trim()).toBe('');
    });

    it('should scroll the page like the thumb of a scrollbar while dragged, from where it was grabbed', () => {
      scroll(250);
      const scrolledTo = (top: number): void =>
        expect(scrollTo).toHaveBeenLastCalledWith({left: window.scrollX, top, behavior: 'instant'});
      const bottom = window.innerHeight - 40;
      component.onHandlePointerDown(pointer(110)); // 10px below its top
      fixture.detectChanges();
      expect(label()?.style.top, 'at the finger').toBe('100px');
      expect(drags).toEqual([true]);

      component.onHandlePointerMove(pointer(110));
      scrolledTo(250);
      // below where it was grabbed: to the end
      component.onHandlePointerMove(pointer(10 + (100 + bottom) / 2));
      scrolledTo(250 + (PageHelper.MaxScrollY - 250) / 2);
      component.onHandlePointerMove(pointer(10 + bottom + 100));
      scrolledTo(PageHelper.MaxScrollY);
      // above it: to the top
      component.onHandlePointerMove(pointer(10 + 50));
      scrolledTo(125);
      fixture.detectChanges();
      expect(label()?.style.top).toBe('50px');
      component.onHandlePointerMove(pointer(-500));
      scrolledTo(0);

      component.onHandlePointerUp(pointer(-500));
      expect(drags).toEqual([true, false]);
      scrollTo.mockClear();
      component.onHandlePointerMove(pointer(300));
      expect(scrollTo, 'released').not.toHaveBeenCalled();
    });

    it('should follow only the finger that grabbed it', () => {
      scroll(250);
      component.onHandlePointerDown(pointer(110));
      component.onHandlePointerMove(pointer(400, 2));
      expect(scrollTo).not.toHaveBeenCalled();
      component.onHandlePointerUp(pointer(400, 2));
      expect(drags, 'still held').toEqual([true]);
    });

    it('should scroll the page as a big jump of the grid', () => {
      const bigJumpTo = vi.spyOn(scroller, 'bigJumpTo');
      vi.spyOn(scroller, 'bigJumpStart').mockReturnValue(1000);
      scroll(250);
      component.onHandlePointerDown(pointer(110));
      component.onHandlePointerMove(pointer(110));
      expect(bigJumpTo, 'from where a big jump shows the same photos').toHaveBeenLastCalledWith(1000);
    });

    it('should stay while dragged and hide after the release', async () => {
      scroll(250);
      component.onHandlePointerDown(pointer(110));
      await vi.advanceTimersByTimeAsync(5000);
      fixture.detectChanges();
      expect(label()?.classList.contains('dragging')).toBe(true);

      component.onHandlePointerUp(pointer(110));
      await vi.advanceTimersByTimeAsync(1000);
      fixture.detectChanges();
      expect(label(), 'longer than without touch: to be grabbed').not.toBeNull();
      await vi.advanceTimersByTimeAsync(1500);
      fixture.detectChanges();
      expect(label()).toBeNull();
    });

    it('should not be a handle on a short page', () => {
      vi.spyOn(PageHelper, 'MaxScrollY', 'get').mockReturnValue(window.innerHeight);
      scroll(250);
      expect(label()?.classList.contains('handle')).toBe(false);
    });
  });
});
