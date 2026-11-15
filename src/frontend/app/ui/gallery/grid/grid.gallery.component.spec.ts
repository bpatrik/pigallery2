import {ComponentFixture, TestBed} from '@angular/core/testing';
import {signal} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';

import {GalleryGridComponent} from './grid.gallery.component';
import {OverlayService} from '../overlay.service';
import {ContentService} from '../content.service';
import {GallerySortingService, MediaGroup, ScrollLabelFn} from '../navigator/sorting.service';
import {QueryService} from '../../../model/query.service';
import {of} from 'rxjs';
import {formatDate} from '@angular/common';
import {provideHttpClientTesting} from '@angular/common/http/testing';
import {PhotoDTO} from '../../../../../common/entities/PhotoDTO';
import {MediaDTO} from '../../../../../common/entities/MediaDTO';
import {GalleryNavigatorService} from '../navigator/navigator.service';
import {GridSizes} from '../../../../../common/entities/GridSizes';
import {GroupByTypes, SortByTypes} from '../../../../../common/entities/SortingMethods';
import {provideHttpClient, withXhr} from '@angular/common/http';
import {BlogService, GroupedMarkdown} from '../blog/blog.service';
import {provideIcons} from '@ng-icons/core';
import {appIcons} from '../../../icons';
import {ThumbnailManagerService} from '../thumbnailManager.service';
import {ExtensionService} from '../../../model/extension.service';
import {MediaButtonModalService} from './photo/media-button-modal/media-button-modal.service';
import {AuthenticationService} from '../../../model/network/authentication.service';
import {PageHelper} from '../../../model/page.helper';
import {ScrollRestorationService} from '../../../model/scroll-restoration.service';
import {GridLayout} from './GridLayout';

class MockQueryService {
  getMediaStringId(media: MediaDTO): string {
    return media.name;
  }

  params(): Record<string, string> {
    return {};
  }

  getLightboxLink(): { queryParams: Record<string, string>, state: Record<string, boolean> } {
    return {queryParams: {}, state: {}};
  }
}

class MockOverlayService {
  getPhantomScrollbarWidth(): number {
    return 0;
  }
}

class MockContentService {
}

class MockGallerySortingService {
  readonly sorting = signal({method: SortByTypes.Date, ascending: false});
  readonly grouping = signal({method: GroupByTypes.NoGrouping, ascending: true});
  // the label of the scroll indicator, the real logic is tested with the sorting service
  scrollLabelFn: ScrollLabelFn | null = {
    order: SortByTypes.Date,
    label: (m: MediaDTO) => formatDate(m.metadata.creationDate, 'MMMM y', 'en-US', 'UTC')
  };

  getScrollLabelFn(): ScrollLabelFn | null {
    return this.scrollLabelFn;
  }
}

class MockGalleryNavigatorService {
  readonly girdSize = signal(GridSizes.medium);
}


class MockBlogService {
  readonly groupedMarkdowns = signal<GroupedMarkdown[]>([]);

  getMarkDowns(): GroupedMarkdown[] {
    return [];
  }
}

const photo = (name: string, date = 0): PhotoDTO => ({
  name,
  directory: {name: 'd', path: 'p'},
  metadata: {size: {width: 3000, height: 2000}, creationDate: date}
} as PhotoDTO);

describe('GalleryGridComponent', () => {
  let sortingService: MockGallerySortingService;
  let component: GalleryGridComponent;
  let fixture: ComponentFixture<GalleryGridComponent>;
  let scrollY: number;
  let frames: FrameRequestCallback[];

  // a 1000px wide grid at the top of the page; jsdom has no layout
  const setUp = (groups: MediaGroup[], width = 1000): void => {
    Object.defineProperty(component.gridContainer().nativeElement.parentElement, 'clientWidth', {value: width, configurable: true});
    fixture.componentRef.setInput('mediaGroups', groups);
    fixture.detectChanges();
  };
  // a scroll event, then the next frame
  const scroll = (y: number): void => {
    scrollY = y;
    component.onScroll();
    frames.splice(0).forEach(cb => cb(0));
    fixture.detectChanges();
  };
  const renderedMedia = (): MediaDTO[] => component.renderedLines().flatMap(l => l.segments.flatMap(s => s.tiles.map(t => t.gridMedia.media)));
  const layout = (): GridLayout => component.layout()!;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GalleryGridComponent],
      providers: [
        provideIcons(appIcons),
        Router,
        {provide: ContentService, useClass: MockContentService},
        {provide: QueryService, useClass: MockQueryService},
        {provide: OverlayService, useClass: MockOverlayService},
        {provide: BlogService, useClass: MockBlogService},
        {provide: GallerySortingService, useClass: MockGallerySortingService},
        {provide: GalleryNavigatorService, useClass: MockGalleryNavigatorService},
        // for the tiles
        {provide: ThumbnailManagerService, useValue: {getThumbnail: () => ({Available: true, Error: false, loading: false, Src: '', destroy: (): void => undefined})}},
        {provide: ExtensionService, useValue: {UIExtensionConfig: []}},
        {provide: MediaButtonModalService, useValue: {}},
        {provide: AuthenticationService, useValue: {canSearch: () => false}},
        {
          provide: ActivatedRoute,
          useValue: {
            queryParams: of([{id: 1}]),
            params: of([{id: 1}]),
          },
        },
        provideHttpClient(withXhr()),
        provideHttpClientTesting()
      ]
    })
      .compileComponents();

    sortingService = TestBed.inject(GallerySortingService) as unknown as MockGallerySortingService;
    fixture = TestBed.createComponent(GalleryGridComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('mediaGroups', []);
    fixture.detectChanges();
    scrollY = 0;
    frames = [];
    vi.spyOn(PageHelper, 'ScrollY', 'get').mockImplementation(() => scrollY);
    vi.spyOn(PageHelper, 'MaxScrollY', 'get').mockImplementation(() => Math.max(0, (component.layout()?.totalHeight ?? 0) - window.innerHeight));
    component.gridContainer().nativeElement.getBoundingClientRect = () => ({top: -scrollY} as DOMRect);
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback): number => {
      frames.push(cb);
      return frames.length;
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render the groups of a line together and break the line before a group that starts a new line', () => {
    setUp([
      {name: '2025', media: [photo('1.jpg')]},
      {name: '2022', startsNewLine: true, media: [photo('2.jpg')]},
      {name: '2022 too', media: [photo('3.jpg')]}
    ], 4000);
    const lines = [...fixture.nativeElement.querySelectorAll('.grid-line')] as HTMLElement[];
    expect(lines.map(l => [...l.querySelectorAll('h6')].map(h => h.textContent?.trim()))).toEqual([['2025'], ['2022', '2022 too']]);
  });

  it('should keep the tiles of unchanged media when the content is loaded again', () => {
    const photos = [photo('1.jpg'), photo('2.jpg'), photo('3.jpg')];
    setUp([{name: '', media: photos}]);
    const tiles = [...fixture.nativeElement.querySelectorAll('app-gallery-grid-photo')];
    expect(tiles.length).toBe(3);

    // the server's answer after the cached content: equal, but new objects
    const reloaded = photos.map(p => ({...p, metadata: {...p.metadata}}));
    reloaded[1].metadata.keywords = ['changed'];
    fixture.componentRef.setInput('mediaGroups', [{name: '', media: reloaded}]);
    fixture.detectChanges();
    const after = [...fixture.nativeElement.querySelectorAll('app-gallery-grid-photo')];
    expect(after[0]).toBe(tiles[0]);
    expect(after[1], 'its metadata changed').not.toBe(tiles[1]);
    expect(after[2]).toBe(tiles[2]);
  });

  // #1308, CUJ 6: a large folder renders only what is on the screen, but the page is as high as all of it
  describe('on scroll', () => {
    let photos: PhotoDTO[];

    beforeEach(() => {
      photos = [];
      for (let i = 0; i < 500; ++i) {
        photos.push(photo(i + '.jpg'));
      }
      setUp([{name: '', media: photos}]);
    });

    // the paddings stand for the not rendered lines
    const pageHeight = (): number => {
      const first = layout().lineAt(component.padding().top);
      const rendered = component.renderedLines().reduce((sum, _, i) => sum + layout().height(first + i), 0);
      return component.padding().top + rendered + component.padding().bottom;
    };

    it('should render only the lines on and near the screen, with the height of all', () => {
      const first = renderedMedia();
      expect(first[0]).toBe(photos[0]);
      expect(first.length).toBeGreaterThan(0);
      expect(first.length).toBeLessThan(100);
      expect(fixture.nativeElement.querySelectorAll('app-gallery-grid-photo').length).toBe(first.length);
      expect(pageHeight()).toBeCloseTo(layout().totalHeight);
      expect(layout().totalHeight).toBeGreaterThan(10 * window.innerHeight);
    });

    it('should render the lines of where it was scrolled, also far down, without the ones before', () => {
      scroll(layout().totalHeight / 2);
      const middle = renderedMedia();
      expect(middle).not.toContain(photos[0]);
      expect(middle).toContain(layout().lines[layout().lineAt(scrollY)].segments[0].media[0].media);
      expect(middle.length).toBeLessThan(100);
      expect(pageHeight()).toBeCloseTo(layout().totalHeight);

      scroll(layout().totalHeight - window.innerHeight);
      expect(renderedMedia()).toContain(photos[499]);
      expect(component.padding().bottom).toBe(0);
    });

    it('should fade in only the photos shown the first time, not the ones scrolled back to', () => {
      const fadingIn = (): string[] => [...fixture.nativeElement.querySelectorAll('app-gallery-grid-photo img')]
        .filter((img: HTMLImageElement) => img.classList.contains('fade-in')).map((img: HTMLImageElement) => img.alt);
      expect(fadingIn()).toContain('0.jpg');

      scroll(layout().totalHeight / 2);
      expect(fadingIn().length, 'new photos fade in').toBeGreaterThan(0);
      expect(renderedMedia()).not.toContain(photos[0]);

      scroll(0);
      expect(renderedMedia()).toContain(photos[0]);
      expect(fadingIn()).toEqual([]);
    });

    // #1308: back to a folder that was scrolled down: the page is high enough to scroll there right away
    it('should scroll to the scroll position of a browser back after the render', async () => {
      vi.spyOn(TestBed.inject(ScrollRestorationService), 'restoreTarget').mockReturnValue(5000);
      const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);

      fixture.componentRef.setInput('mediaGroups', [{name: '', media: [...photos]}]);
      component.ngOnChanges();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(scrollTo).toHaveBeenCalledWith({left: window.scrollX, top: 5000, behavior: 'instant'});
      expect(renderedMedia().length, 'not all at once').toBeLessThan(100);
    });

    it('should keep the first photo of the screen on the top of the screen with a new grid size', async () => {
      scroll(layout().top(30) + 1);
      const firstVisible = layout().lines[30].segments[0].media[0].media;
      const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation((options) => {
        scrollY = (options as ScrollToOptions).top!;
      });

      TestBed.inject(GalleryNavigatorService).girdSize.set(GridSizes.extraSmall);
      TestBed.tick();
      await fixture.whenStable();

      const line = layout().lineOf(firstVisible);
      expect(component.IMAGE_MARGIN(), 'the new grid size').toBe(1);
      expect(scrollTo).toHaveBeenCalledWith({left: window.scrollX, top: layout().top(line), behavior: 'instant'});
      expect(renderedMedia()).toContain(firstVisible);
    });
  });

  // #1209: the month and year of the first visible photo next to the scrollbar
  describe('scroll label', () => {
    beforeEach(() => {
      // timers only: the frames are counted by the test
      vi.useFakeTimers({toFake: ['setTimeout', 'clearTimeout']});
      // newest first, 30 photos of every month
      const photos: PhotoDTO[] = [];
      for (let i = 0; i < 60; ++i) {
        photos.push(photo(i + '.jpg', Date.UTC(2021, i < 30 ? 5 : 2, 15, 12)));
      }
      setUp([{name: '', media: photos}]);
    });

    const label = (): HTMLElement | null => fixture.nativeElement.querySelector('.scroll-label');
    // the line of the first March photo; its line has June photos too
    const marchLine = (): number => layout().lines.findIndex(l => l.segments[0].media.some(m => m.media.name === '30.jpg'));

    it('should show the month and year of the first visible photo at the thumb position, also if it is not rendered', () => {
      scroll(layout().top(1) + 1);
      expect(label()?.textContent?.trim()).toBe('June 2021');
      expect(label()?.style.getPropertyValue('--scroll-position')).toBe(String(scrollY / PageHelper.MaxScrollY));
      expect(label()?.classList.contains('handle'), 'only on a touch screen').toBe(false);

      scroll(layout().top(marchLine() + 1));
      expect(label()?.textContent?.trim()).toBe('March 2021');

      scroll(PageHelper.MaxScrollY + 100);
      expect(label()?.style.getPropertyValue('--scroll-position')).toBe('1');
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
      scroll(layout().top(1) + 1);
      expect(label()?.textContent?.trim()).toBe(layout().lines[1].segments[0].media[0].media.name.at(0));
    });

    it('should not show when the sorting service has no label', () => {
      sortingService.scrollLabelFn = null;
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
        scroll(layout().top(marchLine() + 1) - 50);
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
      const restoreTarget = vi.spyOn(TestBed.inject(ScrollRestorationService), 'restoreTarget').mockReturnValue(250);
      scroll(250);
      expect(label()).toBeNull();
      restoreTarget.mockReturnValue(null); // the user scrolls
      scroll(260);
      expect(label()).not.toBeNull();
    });

    it('should not update after the grid is removed', () => {
      const cancel = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
      scrollY = 250;
      const labelFrame = frames.length + 1; // the label asks for the first frame of the scroll
      component.onScroll();
      fixture.destroy();
      expect(cancel).toHaveBeenCalledWith(labelFrame);
    });

    it('should not show when there is nothing to scroll', () => {
      vi.spyOn(PageHelper, 'MaxScrollY', 'get').mockReturnValue(0);
      scroll(0);
      expect(label()).toBeNull();
    });

    describe('on a touch screen', () => {
      let scrollTo: ReturnType<typeof vi.spyOn>;
      // the handle on the screen: 40px high, 100px from the top
      const handle = {getBoundingClientRect: () => ({top: 100}), offsetHeight: 40} as unknown as HTMLElement;
      const pointer = (clientY: number): PointerEvent => ({pointerId: 1, clientY, currentTarget: handle, preventDefault: () => undefined} as unknown as PointerEvent);

      beforeEach(() => {
        (component as unknown as { touchOnly: boolean }).touchOnly = true;
        // a long page
        vi.spyOn(PageHelper, 'MaxScrollY', 'get').mockReturnValue(10000);
        scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
      });

      it('should be a handle to drag, also without a label', () => {
        sortingService.scrollLabelFn = null;
        scroll(250);
        expect(label()?.classList.contains('handle')).toBe(true);
        expect(label()?.textContent?.trim()).toBe('');
      });

      it('should scroll the page like the thumb of a scrollbar while dragged', () => {
        scroll(250);
        const track = window.innerHeight - 40;
        component.onHandlePointerDown(pointer(110)); // 10px below its top
        component.onHandlePointerMove(pointer(110 + track));
        expect(scrollTo).toHaveBeenLastCalledWith({left: window.scrollX, top: PageHelper.MaxScrollY, behavior: 'instant'});
        component.onHandlePointerMove(pointer(10 + track / 2));
        expect(scrollTo).toHaveBeenLastCalledWith({left: window.scrollX, top: PageHelper.MaxScrollY / 2, behavior: 'instant'});
        component.onHandlePointerMove(pointer(-500));
        expect(scrollTo).toHaveBeenLastCalledWith({left: window.scrollX, top: 0, behavior: 'instant'});

        component.onHandlePointerUp(pointer(-500));
        scrollTo.mockClear();
        component.onHandlePointerMove(pointer(300));
        expect(scrollTo, 'released').not.toHaveBeenCalled();
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

  describe('as the lightbox grid', () => {
    let photos: PhotoDTO[];

    beforeEach(() => {
      photos = [];
      for (let i = 0; i < 400; ++i) {
        photos.push(photo('p' + i + '.jpg'));
      }
      setUp([
        {name: 'first', media: photos.slice(0, 2)},
        {name: 'second', media: photos.slice(2)}
      ]);
    });

    it('should list all media in grid order, not only the rendered ones', () => {
      expect(renderedMedia().length).toBeLessThan(photos.length);
      expect(component.media()).toEqual(photos);
    });

    it('should list no media while the content loads', () => {
      fixture.componentRef.setInput('mediaGroups', undefined);
      expect(component.media()).toBeNull();
    });

    // e.g. a link to a photo far down: the page gets its height with the render, the grid scrolls to the tile after it
    it('should render the line of the media and resolve its tile after render', async () => {
      const target = photos[300];
      expect(renderedMedia()).not.toContain(target);

      // jsdom does not scroll
      vi.spyOn(window, 'scrollTo').mockImplementation((options) => {
        scrollY = (options as ScrollToOptions).top!;
      });
      const revealed = component.revealMedia(target);
      fixture.detectChanges();
      expect(renderedMedia()).toContain(target);
      expect(renderedMedia()).not.toContain(photos[0]);

      TestBed.tick();
      const tile = (await revealed)!;
      expect(tile.gridMedia.media).toBe(target);
      expect(tile.rect).toEqual({top: 0, left: 0, width: 0, height: 0}); // jsdom has no layout
    });

    // e.g. a face of the lightbox opens a search that is not cached yet: its empty content removes the grid,
    // while the closing lightbox waits for the tile of its photo
    it('should resolve null when the grid is removed before the next render', async () => {
      vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
      const revealed = component.revealMedia(photos[300]);
      fixture.destroy();

      const result = await Promise.race([revealed, new Promise(resolve => setTimeout(() => resolve('pending'), 100))]);
      expect(result).toBeNull();
    });

    it('should resolve null for a media that is not in the grid, without navigating', async () => {
      const router = TestBed.inject(Router);
      vi.spyOn(router, 'navigate');

      const tile = await component.revealMedia(photo('missing.jpg'));

      expect(tile).toBeNull();
      expect(router.navigate).not.toHaveBeenCalled();
    });
  });
});
