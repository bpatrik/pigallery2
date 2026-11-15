import {
  AfterViewInit,
  Component,
  ElementRef,
  Injector,
  OnChanges,
  OnDestroy,
  afterNextRender,
  afterRenderEffect,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  signal,
  untracked,
  viewChild,
  viewChildren
} from '@angular/core';
import type {LightboxGrid, LightboxGridTile} from '../lightbox/lightbox.gallery.component';
import {GridMedia} from './GridMedia';
import {GridLayout, GridLayoutParams, GridSegment} from './GridLayout';
import {GridScrollWindow} from './GridScrollWindow';
import {GalleryPhotoComponent} from './photo/photo.grid.gallery.component';
import {OverlayService} from '../overlay.service';
import {Config} from '../../../../../common/config/public/Config';
import {PageHelper} from '../../../model/page.helper';
import {QueryService} from '../../../model/query.service';
import {MediaDTO} from '../../../../../common/entities/MediaDTO';
import {GallerySortingService, MediaGroup} from '../navigator/sorting.service';
import {GroupByTypes, SortByDirectionalTypes} from '../../../../../common/entities/SortingMethods';
import {GalleryNavigatorService} from '../navigator/navigator.service';
import {GridSizes} from '../../../../../common/entities/GridSizes';
import {NgIconComponent} from '@ng-icons/core';
import {GalleryBlogComponent} from '../blog/blog.gallery.component';
import {ParseIntPipe} from '../../../pipes/ParseIntPipe';
import {ScrollRestorationService} from '../../../model/scroll-restoration.service';
import {NavigationEnd, Router, RouterLink} from '@angular/router';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-gallery-grid',
  host: {
    '(window:resize)': 'onResize()',
    '(window:scroll)': 'onScroll()'
  },
  templateUrl: './grid.gallery.component.html',
  styleUrl: './grid.gallery.component.css',
  imports: [
    NgIconComponent,
    GalleryBlogComponent,
    GalleryPhotoComponent,
    ParseIntPipe,
    RouterLink
  ]
})
export class GalleryGridComponent
  implements OnChanges, AfterViewInit, OnDestroy, LightboxGrid {
  private overlayService = inject(OverlayService);
  private injector = inject(Injector);
  queryService = inject(QueryService);
  sortingService = inject(GallerySortingService);
  navigatorService = inject(GalleryNavigatorService);
  private scrollRestoration = inject(ScrollRestorationService);
  private router = inject(Router);

  readonly gridContainer = viewChild.required<ElementRef<HTMLElement>>('gridContainer');
  private readonly linesContainer = viewChild.required<ElementRef<HTMLElement>>('linesContainer');
  // only read imperatively (revealMedia, onScroll), never in a template, computed or effect
  private readonly photoComponents = viewChildren(GalleryPhotoComponent);
  readonly mediaGroups = input.required<MediaGroup[]>();
  // all media in grid order, also the ones that are not rendered; null while the content loads
  readonly media = computed((): MediaDTO[] => this.mediaGroups()?.flatMap(g => g.media) ?? null);

  // the width of the rows and the height of the screen they are sized to
  readonly containerWidth = signal(0);
  readonly screenHeight = signal(0);
  readonly pinnedWidth = signal<number | null>(null); // keeps the grid width while a resize is waiting to rerender
  // follows the grid size of the navigator, see the constructor
  private readonly gridSize = signal(GridSizes.medium);
  private readonly gridParams = computed(() => GRID_PARAMS[this.gridSize()] ?? GRID_PARAMS[GridSizes.medium]);
  readonly IMAGE_MARGIN = computed(() => this.gridParams().imageMargin);

  /**
   * Where all lines of the grid are. It is rebuilt when the media, the width or the grid size changes,
   * and changed in place when the rendered lines are measured: layoutVersion tells that.
   */
  readonly layout = computed((): GridLayout | null => {
    // no width before ngAfterViewInit, when the inputs are set
    const width = this.containerWidth();
    if (width <= 0) {
      return null;
    }
    const groups = this.mediaGroups();
    if (!groups) {
      return null;
    }
    return new GridLayout(groups, {
      ...this.gridParams(),
      width: width - this.overlayService.getPhantomScrollbarWidth(),
      screenHeight: this.screenHeight(),
      headerHeight: GalleryGridComponent.headerHeight
    }, GalleryGridComponent.heightCache);
  });
  private readonly layoutVersion = signal(0);
  // a huge grid is higher than a page can be: the page holds a window of it, see GridScrollWindow
  private readonly scrollWindow = new GridScrollWindow();
  // the shown part of the grid (0 is the top of the grid, in the layout: with the offset of the window)
  private readonly viewport = signal<{ top: number, height: number }>({top: 0, height: window.innerHeight});
  // the lines on and near the screen, only these are rendered
  private readonly range = computed((): { first: number, last: number } => {
    const layout = this.layout();
    this.layoutVersion();
    if (!layout || layout.length === 0) {
      return {first: 0, last: -1};
    }
    const {top, height} = this.viewport();
    return {
      first: layout.lineAt(top - height * RENDER_BUFFER_SCREENS),
      last: layout.lineAt(top + height * (1 + RENDER_BUFFER_SCREENS))
    };
  }, {equal: (a, b) => a.first === b.first && a.last === b.last});
  // the space of the not rendered lines above and below the rendered ones
  readonly padding = computed((): { top: number, bottom: number } => {
    const layout = this.layout();
    this.layoutVersion();
    const {first, last} = this.range();
    if (!layout || last < first) {
      return {top: 0, bottom: 0};
    }
    const offset = this.scrollWindow.offset(layout.totalHeight);
    return {
      top: Math.max(0, layout.top(first) - offset),
      bottom: Math.max(0, this.scrollWindow.height(layout.totalHeight) - (layout.top(last) + layout.height(last) - offset))
    };
  });
  private readonly openBlogs = signal<ReadonlyMap<number, boolean>>(new Map());
  /**
   * The rendered lines. An unchanged media keeps its GridMedia (so its tile) of the previous lines:
   * a reload of the content (e.g. the server's answer after the cached one) does not render the tiles again.
   */
  readonly renderedLines = linkedSignal<{ layout: GridLayout | null, first: number, last: number, openBlogs: ReadonlyMap<number, boolean> }, RenderedLine[]>({
    source: () => ({layout: this.layout(), ...this.range(), openBlogs: this.openBlogs()}),
    computation: ({layout, first, last, openBlogs}, previous): RenderedLine[] => {
      const previousTiles = new Map<string, GridMedia>();
      previous?.value.forEach(l => l.segments.forEach(s => s.tiles.forEach(t => previousTiles.set(GalleryGridComponent.tileKey(t.gridMedia.media), t.gridMedia))));
      const tile = (gm: GridMedia): RenderedTile => {
        const key = GalleryGridComponent.tileKey(gm.media);
        const old = previousTiles.get(key);
        return {
          gridMedia: old && old.renderWidth === gm.renderWidth && old.renderHeight === gm.renderHeight && old.equals(gm.media) ? old : gm,
          shownBefore: this.shownTiles.has(key)
        };
      };
      if (!layout) {
        return [];
      }
      return layout.lines.slice(first, last + 1).map((line, i) => ({
        key: line.key,
        index: first + i,
        layout,
        segments: line.segments.map((s: GridSegment): RenderedSegment => ({
          key: s.key,
          group: s.group,
          header: s.header,
          blogOpen: (s.group.date && openBlogs.get(s.group.date.getTime())) ?? Config.Gallery.InlineBlogStartsOpen,
          tiles: s.media.map(tile)
        }))
      }));
    }
  });

  isAfterViewInit = false;
  public readonly GroupByTypes = GroupByTypes;
  // the estimated height of a group header, until one is rendered and measured; kept for the next grid (e.g. after a browser back)
  private static headerHeight = 56;
  // the measured heights of the lines, also for the next grid
  private static readonly heightCache = new Map<string, number>();
  private renderDelayTimer: number | null = null; // delays render on resize
  private scrollFrame: number | null = null;
  private destroyed = false;
  // the waits for the next render: a removed grid never renders again, so they end on destroy
  private readonly pendingRenders = new Set<() => void>();
  private resizeObserver: ResizeObserver | null = null;
  private scrollLabelFrame: number | null = null;
  private scrollLabelHideTimer: number | null = null;
  // no hover on a phone to see the whole path of a directory group header: its first tap shows it (only this one at a time)
  readonly touchOnly = typeof window.matchMedia === 'function' && window.matchMedia('(hover: none)').matches;
  readonly expandedDirectory = signal<string | null>(null);
  // the label of the first visible photo, in the middle of the screen next to the scrollbar, while scrolling
  readonly scrollLabel = signal<ScrollLabel | null>(null);
  // dragging the scroll label on a touch screen: where the finger holds it, and where the handle and the page were when it was grabbed
  private drag: { pointerId: number, offset: number, startTop: number, startScrollY: number } | null = null;
  // the top of the dragged handle on the screen; null if it is not dragged
  readonly dragTop = signal<number | null>(null);
  readonly dragging = computed(() => this.dragTop() !== null);
  private lastDragRender = 0;
  // the lines in the DOM, set after each render: a resize can be observed before the render of new lines
  private linesInDom: RenderedLine[] = [];
  // the photos this grid rendered on this page: they show up at once when they are rendered again (e.g. scrolled back), only new ones fade in.
  // A new page fades in all of its photos, also the ones seen before.
  private readonly shownTiles = new Set<string>();
  private shownTilesPath: string | null = null;
  private dragRenderTimer: number | null = null;
  // where to scroll after the next render, see scrollToLineAfterRender()
  private pendingScroll: { layout: GridLayout, line: number, offset: number } | null = null;
  // the page's scroll position the window followed last, see followScroll()
  private lastScrollY = 0;
  // the scroll that keeps the screen after the window got a new offset: it is done after the render of the new offset
  private pendingShift = 0;
  private readonly scrollOffset = (): number => this.offset();

  constructor() {
    // a browser back comes back to the same place of a huge grid
    this.scrollRestoration.setScrollOffset(this.scrollOffset);
    // a new grid size keeps the first photo of the screen on the screen
    effect(() => {
      const size = this.navigatorService.girdSize();
      untracked(() => this.keepFirstVisibleMedia(() => this.gridSize.set(size)));
    });
    this.router.events.pipe(takeUntilDestroyed()).subscribe(e => {
      if (!(e instanceof NavigationEnd)) {
        return;
      }
      const path = e.urlAfterRedirects.split(/[?#]/)[0];
      if (path !== this.shownTilesPath) {
        this.shownTilesPath = path;
        this.shownTiles.clear();
      }
    });
    // the lines are as high as they are rendered: a header, an inline blog or a cut directory path can differ from the estimate
    afterRenderEffect({
      read: () => {
        this.linesInDom = this.renderedLines();
        this.linesInDom.forEach(l => l.segments.forEach(s => s.tiles.forEach(t => this.shownTiles.add(GalleryGridComponent.tileKey(t.gridMedia.media)))));
        this.measureLines();
      }
    });
  }

  private static tileKey(m: MediaDTO): string {
    return m.directory?.path + '/' + m.directory?.name + '/' + m.name;
  }

  // the content can change the scrollbar and so the width
  ngOnChanges(): void {
    if (this.isAfterViewInit === false) {
      return;
    }
    this.updateContainerDimensions();
    this.restoreScroll();
  }

  /**
   * On a phone, the first tap on a directory group header shows its whole path if it was cut, the next one opens the directory.
   * Otherwise (or with a mouse) the header is a plain link.
   */
  onDirectoryHeaderClick(event: MouseEvent, directoryPath: string | undefined): void {
    if (!this.touchOnly || !directoryPath || this.expandedDirectory() === directoryPath) {
      return; // the routerLink opens it
    }
    const link = event.currentTarget as HTMLElement;
    if (link.scrollWidth > link.clientWidth) {
      this.expandedDirectory.set(directoryPath);
      return;
    }
    this.router.navigate(['/gallery', directoryPath], {queryParams: this.queryService.params()}).catch(console.error);
  }

  // the line of a blog is rendered again when it is scrolled back: it keeps whether it was open
  onBlogOpenChange(date: Date | undefined, open: boolean): void {
    if (!date) {
      return;
    }
    this.openBlogs.update(m => new Map(m).set(date.getTime(), open));
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.scrollRestoration.clearScrollOffset(this.scrollOffset);
    this.pendingRenders.forEach(resolve => resolve());
    this.pendingRenders.clear();
    this.resizeObserver?.disconnect();
    if (this.renderDelayTimer) {
      clearTimeout(this.renderDelayTimer);
      this.renderDelayTimer = null;
    }
    if (this.scrollFrame !== null) {
      cancelAnimationFrame(this.scrollFrame);
      this.scrollFrame = null;
    }
    if (this.scrollLabelFrame !== null) {
      cancelAnimationFrame(this.scrollLabelFrame);
      this.scrollLabelFrame = null;
    }
    if (this.scrollLabelHideTimer != null) {
      clearTimeout(this.scrollLabelHideTimer);
      this.scrollLabelHideTimer = null;
    }
    if (this.dragRenderTimer != null) {
      clearTimeout(this.dragRenderTimer);
      this.dragRenderTimer = null;
    }
  }

  onResize(): void {
    if (this.isAfterViewInit === false) {
      return;
    }
    if (this.renderDelayTimer) {
      clearTimeout(this.renderDelayTimer);
      this.renderDelayTimer = null;
    }
    this.pinnedWidth.set(this.containerWidth());
    this.renderDelayTimer = window.setTimeout(() => {
      this.renderDelayTimer = null;
      this.pinnedWidth.set(null);
      this.keepFirstVisibleMedia(() => this.updateContainerDimensions());
      this.updateViewport();
    }, 100);
  }

  ngAfterViewInit(): void {
    this.lastScrollY = PageHelper.ScrollY;
    this.updateContainerDimensions();
    this.updateViewport();
    this.isAfterViewInit = true;
    // An inline blog opens or closes, a directory path is shown whole: the rendered lines change their height.
    // The page changes its height when something above the grid does (e.g. the blog of the folder closes):
    // the grid moves without a scroll, other lines are on the screen.
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => {
        this.measureLines();
        this.renderVisibleLines();
      });
      this.resizeObserver.observe(this.linesContainer().nativeElement);
      this.resizeObserver.observe(document.body);
    }
    this.restoreScroll();
  }

  /**
   * Renders the line of this media and scrolls its tile into view.
   * Resolves after that render with the tile's position and its GridMedia, or null if the media is not in the grid.
   */
  async revealMedia(media: MediaDTO): Promise<LightboxGridTile | null> {
    // the grid measures its width in ngAfterViewInit, it has no layout before that
    if (!this.isAfterViewInit) {
      await this.afterRender();
    }
    if (this.destroyed) {
      return null;
    }
    const layout = this.layout();
    const id = this.queryService.getMediaStringId(media);
    let line = layout?.lineOf(media) ?? -1;
    if (line === -1 && layout) {
      // the same media in a reloaded content is a new object
      line = layout.lines.findIndex(l => l.segments.some(s => s.media.some(m => this.queryService.getMediaStringId(m.media) === id)));
    }
    if (!layout || line === -1) {
      return null;
    }
    const lineTop = this.getGridTop() + layout.top(line) - this.offset();
    if (this.scrollY() > lineTop || this.scrollY() + window.innerHeight < lineTop + layout.height(line)) {
      this.scrollToLineAfterRender(layout, line, 0);
    }
    await this.afterRender();
    if (this.destroyed) {
      return null;
    }
    const tile = this.photoComponents().find(p => this.queryService.getMediaStringId(p.gridMedia().media) === id);
    if (!tile) {
      return null;
    }
    const rect = tile.getDimension();
    // if the tile is out of the screen -> scroll to there.
    // Instantly (the page has smooth scrolling): the lightbox animates from the tile's place right away.
    if (PageHelper.ScrollY > rect.top || PageHelper.ScrollY + window.innerHeight < rect.top) {
      this.scrollToInstantly(rect.top);
    }
    return {rect, gridMedia: tile.gridMedia()};
  }

  /**
   * Resolves after the next render, or right away when the grid is (or gets) removed: it then never renders again.
   */
  private afterRender(): Promise<void> {
    if (this.destroyed) {
      return Promise.resolve();
    }
    return new Promise<void>(resolve => {
      const done = (): void => {
        this.pendingRenders.delete(done);
        resolve();
      };
      this.pendingRenders.add(done);
      afterNextRender(done, {injector: this.injector});
    });
  }

  onScroll(): void {
    this.requestScrollLabelUpdate();
    if (this.scrollFrame !== null) {
      return;
    }
    this.scrollFrame = window.requestAnimationFrame((): void => {
      this.scrollFrame = null;
      this.renderVisibleLines();
      if (Config.Gallery.enableOnScrollThumbnailPrioritising === true) {
        for (const pc of this.photoComponents()) {
          if (pc.ScrollListener) {
            pc.onScroll();
          }
        }
      }
    });
  }

  /**
   * Renders the lines of the shown part of the page.
   * While the scroll label is dragged (e.g. across thousands of photos), only every few frames:
   * the photos it passes would not even show up, but would ask for their thumbnails.
   */
  private renderVisibleLines(): void {
    if (!this.drag) {
      this.updateViewport();
      return;
    }
    const wait = this.lastDragRender + DRAG_RENDER_INTERVAL_MS - performance.now();
    if (wait <= 0) {
      this.lastDragRender = performance.now();
      this.updateViewport();
      return;
    }
    if (this.dragRenderTimer === null) {
      this.dragRenderTimer = window.setTimeout(() => {
        this.dragRenderTimer = null;
        this.renderVisibleLines();
      }, wait);
    }
  }

  private updateViewport(): void {
    if (!this.isAfterViewInit && this.containerWidth() === 0) {
      return;
    }
    if (this.pendingScroll === null) {
      this.followScroll();
    }
    const y = this.pendingScrollTop() ?? this.scrollY();
    this.viewport.set({top: y - this.getGridTop() + this.offset(), height: window.innerHeight});
  }

  /** The window of a huge grid follows the scroll of the page, see GridScrollWindow. */
  private followScroll(): void {
    const scrollY = this.scrollY();
    // the scroll handle is dragged like the scrollbar thumb: the page goes to the same ratio of the grid
    const scrolled = this.drag ? Infinity : scrollY - this.lastScrollY;
    this.lastScrollY = scrollY;
    const layout = this.layout();
    if (!layout) {
      return;
    }
    const shift = this.scrollWindow.follow(layout.totalHeight, scrollY - this.getGridTop(), scrolled, window.innerHeight);
    if (Math.abs(shift) < 0.5) {
      return;
    }
    // the page scrolls with the render of the new offset (the paddings): not before, not a frame later, or the screen jumps.
    // Relative: the page may scroll on until then (e.g. a fling)
    const queued = this.pendingShift !== 0;
    this.pendingShift += shift;
    this.lastScrollY += shift;
    if (queued) {
      return;
    }
    afterNextRender(() => {
      const pending = this.pendingShift;
      this.pendingShift = 0;
      if (pending !== 0 && !this.destroyed) {
        window.scrollBy({left: 0, top: pending, behavior: 'instant'});
      }
    }, {injector: this.injector});
  }

  /** The offset of the window of a huge grid: the not rendered part of the grid above the page, 0 if the page has the whole grid. */
  private offset(): number {
    const layout = this.layout();
    return layout ? this.scrollWindow.offset(layout.totalHeight) : 0;
  }

  /** The scroll position of the page, also with the scroll that waits for the render of a new offset. */
  private scrollY(): number {
    return PageHelper.ScrollY + this.pendingShift;
  }

  /**
   * Renders the lines at a line, then scrolls there (offset px below its top).
   * The page may not be high enough to scroll there before that render (e.g. when the grid just got its content).
   */
  private scrollToLineAfterRender(layout: GridLayout, line: number, offset: number): void {
    // a huge grid shows the part of the line in the page
    this.scrollWindow.jumpTo(layout.totalHeight, layout.top(line) + offset);
    this.pendingShift = 0;
    this.pendingScroll = {layout, line, offset};
    this.updateViewport();
    afterNextRender(() => {
      const top = this.pendingScrollTop();
      this.pendingScroll = null;
      if (top !== null && !this.destroyed) {
        this.scrollToInstantly(top);
      }
    }, {injector: this.injector});
  }

  /** Where scrollToLineAfterRender() scrolls to, in the page. The line can move until then: the lines above it are measured. */
  private pendingScrollTop(): number | null {
    const p = this.pendingScroll;
    if (!p || p.layout !== this.layout()) {
      return null;
    }
    return this.getGridTop() + p.layout.top(p.line) + p.offset - this.offset();
  }

  /** The top of the grid in the page. */
  private getGridTop(): number {
    return this.gridContainer().nativeElement.getBoundingClientRect().top + PageHelper.ScrollY;
  }

  private scrollToInstantly(top: number): void {
    window.scrollTo({left: window.scrollX, top, behavior: 'instant'});
    // it is in the page of the current offset: not a scroll the window follows
    this.pendingShift = 0;
    this.lastScrollY = PageHelper.ScrollY;
    // the lines of the new position render right away, not on the next scroll event
    this.updateViewport();
  }

  /**
   * Corrects the estimated heights of the rendered lines with their real ones. The lines below move with it, so
   * the page scrolls by the change of the lines above the screen: what is on the screen stays where it is.
   */
  private measureLines(): void {
    const layout = this.layout();
    if (!layout || this.destroyed) {
      return;
    }
    const container = this.linesContainer().nativeElement;
    const elements = container.children;
    const lines = this.linesInDom;
    if (elements.length !== lines.length) {
      return;
    }
    const header = container.querySelector<HTMLElement>('.group-header');
    const headerHeight = header?.getBoundingClientRect().height ?? 0;

    const offset = this.offset();
    const viewTop = this.scrollY() - this.getGridTop() + offset;
    const anchor = layout.lineAt(viewTop);
    const anchorOffset = viewTop - layout.top(anchor);
    let changed = false;
    if (headerHeight > 0) {
      GalleryGridComponent.headerHeight = headerHeight;
      changed = layout.setHeaderHeight(headerHeight);
    }
    for (let i = 0; i < elements.length; ++i) {
      const height = elements[i].getBoundingClientRect().height;
      // 0: not laid out (e.g. the gallery is hidden)
      if (height > 0 && lines[i].layout === layout) {
        changed = layout.setHeight(lines[i].index, height) || changed;
      }
    }
    if (!changed) {
      return;
    }
    const oldTop = layout.top(anchor);
    layout.updateTops();
    this.layoutVersion.update(v => v + 1);
    // a lower grid can need a smaller offset of the window: the page scrolls by that too
    this.scrollWindow.fit(layout.totalHeight);
    const offsetShift = offset - this.offset();
    const shift = (viewTop > 0 && anchorOffset >= 0 ? layout.top(anchor) - oldTop : 0) + offsetShift;
    // a pending scroll goes to its line, wherever it moved
    if (Math.abs(shift) >= 0.5 && !this.pendingScroll) {
      window.scrollBy({left: 0, top: shift, behavior: 'instant'});
      this.lastScrollY += shift;
    }
    this.updateViewport();
  }

  /**
   * Relayouts the grid (e.g. a new width) so that the first photo on the screen stays on the top of the screen.
   */
  private keepFirstVisibleMedia(relayout: () => void): void {
    const navbarBottom = this.getNavbarBottom();
    const media = this.getFirstVisibleMedia(navbarBottom);
    const before = this.layout();
    relayout();
    const layout = this.layout();
    if (!media || !layout || layout === before) {
      return;
    }
    const line = layout.lineOf(media);
    if (line === -1) {
      return;
    }
    this.scrollToLineAfterRender(layout, line, -navbarBottom);
  }

  private requestScrollLabelUpdate(): void {
    if (this.scrollLabelFrame !== null) {
      return;
    }
    // a browser back or forward scrolls the page itself (#1308), the user did not scroll
    if (this.scrollRestoration.restoreTarget() !== null ||
      (!this.touchOnly && !this.sortingService.getScrollLabelFn(this.sortingService.sorting(), this.sortingService.grouping()))) {
      this.scrollLabel.set(null);
      return;
    }
    this.scrollLabelFrame = window.requestAnimationFrame((): void => {
      this.scrollLabelFrame = null;
      this.updateScrollLabel();
    });
  }

  private updateScrollLabel(): void {
    const maxScrollY = PageHelper.MaxScrollY;
    const labelFn = this.sortingService.getScrollLabelFn(this.sortingService.sorting(), this.sortingService.grouping());
    const navbarBottom = this.getNavbarBottom();
    const media = this.getFirstVisibleMedia(navbarBottom);
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
      thumbCenter: GalleryGridComponent.thumbCenter(PageHelper.ScrollY, maxScrollY),
      navbarBottom
    });
    this.hideScrollLabelLater();
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

  private hideScrollLabelLater(): void {
    if (this.scrollLabelHideTimer != null) {
      clearTimeout(this.scrollLabelHideTimer);
    }
    this.scrollLabelHideTimer = window.setTimeout((): void => {
      this.scrollLabelHideTimer = null;
      if (!this.drag) {
        this.scrollLabel.set(null);
      }
    }, this.touchOnly ? SCROLL_HANDLE_VISIBLE_MS : SCROLL_LABEL_VISIBLE_MS);
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
    this.drag = {pointerId: event.pointerId, offset: event.clientY - top, startTop, startScrollY: this.dragStartScrollY()};
    this.dragTop.set(startTop);
  }

  /**
   * Where the page has to be for the drag (a big jump of the window, see followScroll()) to show what the screen shows:
   * grabbing the handle does not move the page.
   */
  private dragStartScrollY(): number {
    const layout = this.layout();
    const scrollY = this.scrollY();
    const gridTop = this.getGridTop();
    const gridY = scrollY - gridTop + this.offset();
    if (!layout || gridY <= 0) {
      return scrollY;
    }
    return gridTop + this.scrollWindow.bigJumpPageY(layout.totalHeight, gridY, window.innerHeight);
  }

  /**
   * The handle follows the finger, like the thumb of a scrollbar. Grabbing it does not move the page, also where the
   * handle is not exactly where a scrollbar thumb would be (below the navbar, a huge grid, see dragStartScrollY()):
   * above where it was grabbed it scrolls the page up to the top, below it down to the end.
   */
  onHandlePointerMove(event: PointerEvent): void {
    const label = this.scrollLabel();
    if (!this.drag || event.pointerId !== this.drag.pointerId || !label) {
      return;
    }
    event.preventDefault();
    const handle = event.currentTarget as HTMLElement;
    const trackTop = label.navbarBottom;
    const trackBottom = window.innerHeight - handle.offsetHeight;
    if (trackBottom <= trackTop) {
      return;
    }
    const top = Math.min(trackBottom, Math.max(trackTop, event.clientY - this.drag.offset));
    const {startTop, startScrollY} = this.drag;
    const maxScrollY = PageHelper.MaxScrollY;
    let scrollY = startScrollY;
    if (top < startTop) {
      scrollY = startScrollY * (top - trackTop) / (startTop - trackTop);
    } else if (top > startTop) {
      scrollY = startScrollY + (maxScrollY - startScrollY) * (top - startTop) / (trackBottom - startTop);
    }
    this.dragTop.set(top);
    window.scrollTo({left: window.scrollX, top: scrollY, behavior: 'instant'});
  }

  onHandlePointerUp(event: PointerEvent): void {
    if (!this.drag || event.pointerId !== this.drag.pointerId) {
      return;
    }
    this.drag = null;
    this.dragTop.set(null);
    if (this.dragRenderTimer != null) {
      clearTimeout(this.dragRenderTimer);
      this.dragRenderTimer = null;
    }
    this.updateViewport();
    this.hideScrollLabelLater();
  }

  /** The bottom of the navbar on the screen, it is 0 if the navbar is hidden. */
  private getNavbarBottom(): number {
    const navbar = document.querySelector('.navbar-container');
    return navbar ? Math.max(0, navbar.getBoundingClientRect().bottom) : 0;
  }

  /** The first media of the first line that is not scrolled out at the top or hidden behind the navbar. Also if it is not rendered. */
  private getFirstVisibleMedia(navbarBottom: number): MediaDTO | null {
    const layout = this.layout();
    if (!layout || layout.length === 0) {
      return null;
    }
    const line = layout.lineAt(this.scrollY() + navbarBottom - this.getGridTop() + this.offset());
    return layout.lines[line].segments[0].media[0].media;
  }

  /**
   * Browser back or forward to this page: scrolls to its last scroll position.
   * The grid has the height of all its lines from the start, so it can scroll there right away.
   * Runs after every render until the user scrolls: the first one may still show the previous content (e.g. the search).
   */
  private restoreScroll(): void {
    if (!this.mediaGroups()?.length || this.scrollRestoration.restoreTarget() === null) {
      return;
    }
    afterNextRender(() => {
      const y = this.scrollRestoration.restoreTarget();
      if (y === null || this.destroyed) {
        return;
      }
      // y is in the whole grid (see ScrollRestorationService.setScrollOffset()): a huge grid shows that part first
      const layout = this.layout();
      const gridY = y - this.getGridTop();
      if (layout && gridY > 0 && layout.totalHeight > this.scrollWindow.height(layout.totalHeight)) {
        const line = layout.lineAt(gridY);
        this.scrollToLineAfterRender(layout, line, gridY - layout.top(line));
        return;
      }
      this.scrollToInstantly(y);
    }, {injector: this.injector});
  }

  private updateContainerDimensions(): void {
    const gridContainer = this.gridContainer();
    if (!gridContainer) {
      return;
    }

    const scrollY = PageHelper.OverflowY;
    PageHelper.showScrollY('grid');
    const width = gridContainer.nativeElement.parentElement?.clientWidth ?? 0;
    // if the width changed a bit or the height changed a lot
    if (
      this.containerWidth() !== width ||
      this.screenHeight() < window.innerHeight * 0.75 ||
      this.screenHeight() > window.innerHeight * 1.25
    ) {
      this.screenHeight.set(window.innerHeight);
      this.containerWidth.set(width);
    }
    PageHelper.OverflowY = scrollY;
  }
}

// rendered above and below the screen, so a scroll shows rendered photos
const RENDER_BUFFER_SCREENS = 1;
const SCROLL_LABEL_VISIBLE_MS = 1000;
// longer on a touch screen: it is there to be grabbed
const SCROLL_HANDLE_VISIBLE_MS = 2000;
// a page shorter than this many screens scrolls well without the handle
const HANDLE_MIN_SCREENS = 3;
const DRAG_RENDER_INTERVAL_MS = 150;

const GRID_PARAMS: Record<GridSizes, Omit<GridLayoutParams, 'width' | 'screenHeight' | 'headerHeight'>> = {
  [GridSizes.extraSmall]: {targetColCount: 12, minRowCount: 5, maxRowCount: 10, imageMargin: 1},
  [GridSizes.small]: {targetColCount: 8, minRowCount: 3, maxRowCount: 8, imageMargin: 1.5},
  [GridSizes.medium]: {targetColCount: 5, minRowCount: 2, maxRowCount: 5, imageMargin: 2},
  [GridSizes.large]: {targetColCount: 2, minRowCount: 1, maxRowCount: 3, imageMargin: 2},
  [GridSizes.extraLarge]: {targetColCount: 1, minRowCount: 1, maxRowCount: 2, imageMargin: 2},
};

interface ScrollLabel {
  text: string;
  order: SortByDirectionalTypes | null;
  handle: boolean; // it can be dragged
  stars: boolean[]; // filled or not, for the rating order
  thumbCenter: number; // px from the top of the screen, the middle of the scrollbar thumb
  navbarBottom: number; // px, the label stays below the navbar
}

interface RenderedTile {
  gridMedia: GridMedia;
  shownBefore: boolean; // this grid rendered it already
}

interface RenderedSegment extends Omit<GridSegment, 'media'> {
  blogOpen: boolean;
  tiles: RenderedTile[];
}

interface RenderedLine {
  key: string;
  index: number; // in the layout
  layout: GridLayout;
  segments: RenderedSegment[];
}
