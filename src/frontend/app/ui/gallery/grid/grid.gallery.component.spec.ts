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
import {GridScrollWindow} from './GridScrollWindow';
import {GalleryPhotoComponent} from './photo/photo.grid.gallery.component';
import {GalleryGridScrollLabelComponent} from './scroll-label/scroll-label.grid.gallery.component';
import {By} from '@angular/platform-browser';

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
    window.dispatchEvent(new Event('scroll'));
    frames.splice(0).forEach(cb => cb(0));
    fixture.detectChanges();
  };
  const renderedMedia = (): MediaDTO[] => component.renderedLines().flatMap(l => l.segments.flatMap(s => s.tiles.map(t => t.gridMedia.media)));
  const layout = (): GridLayout => component.layout()!;
  const scrollLabel = (): GalleryGridScrollLabelComponent =>
    fixture.debugElement.query(By.directive(GalleryGridScrollLabelComponent)).componentInstance;

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
      const first = component.renderedLines()[0].index;
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

    // e.g. 200k photos: a page can't be that high, it holds a window of the grid, see GridScrollWindow
    describe('of a grid higher than a page can be', () => {
      const originalMax = GridScrollWindow.MAX_HEIGHT;
      const originalParts = GridScrollWindow.PARTS;
      let max: number;
      let scrollTo: ReturnType<typeof vi.spyOn>;
      // the not rendered part of the grid above the page
      const offset = (): number => layout().top(component.renderedLines()[0].index) - component.padding().top;
      // the top of the screen in the grid
      const screenTop = (): number => scrollY + offset();

      beforeEach(() => {
        for (let i = photos.length; i < 2000; ++i) {
          photos.push(photo(i + '.jpg'));
        }
        fixture.componentRef.setInput('mediaGroups', [{name: '', media: [...photos]}]);
        fixture.detectChanges();
        max = Math.round(layout().totalHeight / 2);
        GridScrollWindow.MAX_HEIGHT = max;
        // a part is a few screens high in the page, like with the real limit
        GridScrollWindow.PARTS = 4;
        expect(max / 6).toBeGreaterThan(3 * window.innerHeight);
        fixture.componentRef.setInput('mediaGroups', [{name: '', media: [...photos]}]);
        fixture.detectChanges();
        scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation((options) => {
          scrollY = (options as ScrollToOptions).top!;
        });
        vi.spyOn(window, 'scrollBy').mockImplementation((options) => {
          scrollY += (options as ScrollToOptions).top!;
        });
      });

      afterEach(() => {
        GridScrollWindow.MAX_HEIGHT = originalMax;
        GridScrollWindow.PARTS = originalParts;
      });

      it('should make the page only as high as the limit', () => {
        expect(pageHeight()).toBeCloseTo(max);
        expect(renderedMedia()[0]).toBe(photos[0]);
      });

      it('should move the photos as much as the page on small scrolls, through the whole grid', async () => {
        const step = window.innerHeight / 2;
        let expected = 0;
        while (expected + step < layout().totalHeight - window.innerHeight) {
          scroll(scrollY + step);
          expected += step;
          // the page scrolls back with the render of a new offset
          await fixture.whenStable();
          expect(screenTop()).toBeCloseTo(expected, 0);
          expect(scrollY).toBeGreaterThanOrEqual(0);
          expect(scrollY).toBeLessThanOrEqual(max);
        }
        expect(offset(), 'the window moved').toBeGreaterThan(0);
        expect(renderedMedia()).toContain(photos[1999]);
      });

      it('should go to the same ratio of the grid on a big jump, e.g. with the scrollbar thumb', () => {
        scroll((max - window.innerHeight) / 2);
        expect(screenTop()).toBeCloseTo((layout().totalHeight - window.innerHeight) / 2, 0);
        expect(renderedMedia()).toContain(layout().lines[layout().lineAt(screenTop())].segments[0].media[0].media);

        scroll(max - window.innerHeight);
        expect(screenTop()).toBeCloseTo(layout().totalHeight - window.innerHeight, 0);
        expect(renderedMedia()).toContain(photos[1999]);
        expect(component.padding().bottom).toBe(0);

        scroll(0);
        expect(offset()).toBe(0);
        expect(renderedMedia()).toContain(photos[0]);
      });

      it('should not move the photos when the scroll handle is grabbed while the page still scrolls', async () => {
        (scrollLabel() as unknown as { touchOnly: boolean }).touchOnly = true;
        const handle = {getBoundingClientRect: () => ({top: 100}), offsetHeight: 40} as unknown as HTMLElement;
        const pointer = (clientY: number): PointerEvent => ({pointerId: 1, clientY, currentTarget: handle, preventDefault: () => undefined} as unknown as PointerEvent);
        for (let i = 0; i < 6; ++i) {
          scroll(scrollY + window.innerHeight / 2);
        }
        await fixture.whenStable();
        const top = screenTop();
        expect(top).toBeCloseTo(3 * window.innerHeight, 0);

        scrollLabel().onHandlePointerDown(pointer(110));
        // the last scroll event of the page, the finger did not move yet
        scroll(scrollY);
        expect(screenTop(), 'grabbed').toBeCloseTo(top, 0);

        // the drag itself is a big jump: from the same photos
        scrollLabel().onHandlePointerMove(pointer(110));
        scrollLabel().onHandlePointerUp(pointer(110));
        fixture.detectChanges();
        expect(screenTop(), 'dragged').toBeCloseTo(top, 0);
      });

      it('should scroll to a photo far down for the lightbox', async () => {
        const target = photos[1800];
        // jsdom has no layout: the tile is on the screen
        vi.spyOn(GalleryPhotoComponent.prototype, 'getDimension').mockImplementation(() => ({top: scrollY + 10, left: 0, width: 0, height: 0}));
        const revealed = component.revealMedia(target);
        fixture.detectChanges();
        await fixture.whenStable();

        expect(renderedMedia()).toContain(target);
        const top = (scrollTo.mock.calls[0][0] as ScrollToOptions).top!;
        expect(top).toBeLessThanOrEqual(max);
        expect(top + offset()).toBeCloseTo(layout().top(layout().lineOf(target)), 0);
        expect((await revealed)?.gridMedia.media).toBe(target);
      });

      it('should come back to the same place of the grid on a browser back', async () => {
        // saved in the whole grid, see ScrollRestorationService.setScrollOffset()
        const target = Math.round(layout().totalHeight * 0.8);
        vi.spyOn(TestBed.inject(ScrollRestorationService), 'restoreTarget').mockReturnValue(target);

        fixture.componentRef.setInput('mediaGroups', [{name: '', media: [...photos]}]);
        component.ngOnChanges();
        fixture.detectChanges();
        await fixture.whenStable();

        expect(scrollY).toBeLessThanOrEqual(max);
        expect(screenTop()).toBeCloseTo(target, 0);
      });
    });
  });

  // the label itself is tested with the GalleryGridScrollLabelComponent
  describe('scroll label', () => {
    let photos: PhotoDTO[];
    const label = (): HTMLElement | null => fixture.nativeElement.querySelector('.scroll-label');

    beforeEach(() => {
      // newest first, a month each
      photos = [];
      for (let i = 0; i < 500; ++i) {
        photos.push(photo(i + '.jpg', Date.UTC(2021, 11 - Math.floor(i / 50), 15, 12)));
      }
      setUp([{name: '', media: photos}]);
    });

    it('should show the label of the first visible photo, also if it was not rendered before', () => {
      expect(label()).toBeNull();
      const line = layout().lineOf(photos[420]);
      scroll(layout().top(line) + 1);
      expect(label()?.textContent?.trim()).toBe('April 2021');
    });

    it('should render the lines less often while the scroll handle is dragged', async () => {
      vi.useFakeTimers({toFake: ['setTimeout', 'clearTimeout', 'performance']});
      scroll(layout().top(layout().lineOf(photos[100])));
      expect(renderedMedia()).toContain(photos[100]);
      // the page is open for a while
      await vi.advanceTimersByTimeAsync(1000);

      // dragged across the photos: they would not even show up
      scrollLabel().dragChange.emit(true);
      scroll(layout().top(layout().lineOf(photos[250])));
      await vi.advanceTimersByTimeAsync(10);
      scroll(layout().top(layout().lineOf(photos[400])));
      expect(renderedMedia()).toContain(photos[250]);
      expect(renderedMedia(), 'passed by').not.toContain(photos[400]);

      await vi.advanceTimersByTimeAsync(200);
      fixture.detectChanges();
      expect(renderedMedia(), 'where the drag is now').toContain(photos[400]);

      // released: right away
      scroll(layout().top(layout().lineOf(photos[100])));
      expect(renderedMedia()).not.toContain(photos[100]);
      scrollLabel().dragChange.emit(false);
      fixture.detectChanges();
      expect(renderedMedia()).toContain(photos[100]);
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
