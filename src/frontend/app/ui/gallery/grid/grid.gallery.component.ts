import {AfterViewInit, ChangeDetectorRef, Component, ElementRef, Injector, OnChanges, OnDestroy, afterNextRender, computed, effect, inject, input, signal, untracked, viewChild, viewChildren} from '@angular/core';
import {GridRowBuilder} from './GridRowBuilder';
import type {LightboxGrid, LightboxGridTile} from '../lightbox/lightbox.gallery.component';
import {GridMedia} from './GridMedia';
import {GalleryPhotoComponent} from './photo/photo.grid.gallery.component';
import {OverlayService} from '../overlay.service';
import {Config} from '../../../../../common/config/public/Config';
import {PageHelper} from '../../../model/page.helper';
import {Router} from '@angular/router';
import {QueryService} from '../../../model/query.service';
import {MediaDTO, MediaDTOUtils,} from '../../../../../common/entities/MediaDTO';
import {GallerySortingService, MediaGroup} from '../navigator/sorting.service';
import {GroupByTypes} from '../../../../../common/entities/SortingMethods';
import {GalleryNavigatorService} from '../navigator/navigator.service';
import {GridSizes} from '../../../../../common/entities/GridSizes';
import {NgIconComponent} from '@ng-icons/core';
import {GalleryBlogComponent} from '../blog/blog.gallery.component';
import {ParseIntPipe} from '../../../pipes/ParseIntPipe';

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
    ParseIntPipe
]
})
export class GalleryGridComponent
  implements OnChanges, AfterViewInit, OnDestroy, LightboxGrid {
  private overlayService = inject(OverlayService);
  private changeDetector = inject(ChangeDetectorRef);
  private injector = inject(Injector);
  queryService = inject(QueryService);
  private router = inject(Router);
  sortingService = inject(GallerySortingService);
  navigatorService = inject(GalleryNavigatorService);

  readonly gridContainer = viewChild.required<ElementRef>('gridContainer');
  // only read imperatively (revealMedia, onScroll), never in a template, computed or effect
  private readonly photoComponents = viewChildren(GalleryPhotoComponent);
  readonly mediaGroups = input.required<MediaGroup[]>();
  // all media in grid order, also the ones that are not rendered yet; null while the content loads
  readonly media = computed((): MediaDTO[] => this.mediaGroups()?.flatMap(g => g.media) ?? null);
  readonly mediaToRender = signal<GridMediaGroup[]>([]);
  containerWidth = 0;
  readonly containerMinHeight = signal(0); // used to fix container height while updating photos to prevent flickering
  readonly pinnedWidth = signal<number | null>(null); // keeps the grid width while a resize is waiting to rerender
  screenHeight = 0;
  isAfterViewInit = false;
  public IMAGE_MARGIN = 2;
  private renderDelayTimer: number | null = null; // delays render on resize
  public readonly GroupByTypes = GroupByTypes;
  public readonly blogOpen = Config.Gallery.InlineBlogStartsOpen;
  private TARGET_COL_COUNT = 5;
  private MIN_ROW_COUNT = 2;
  private MAX_ROW_COUNT = 5;
  private onScrollFired = false;
  private helperTime: number | null = null;

  constructor() {
    effect(() => {
      const gs = this.navigatorService.girdSize();
      untracked(() => this.onGridSizeChange(gs));
    });
  }

  // Side effect: merges the new media into the rendered grid after the view settled.
  ngOnChanges(): void {
    if (this.isAfterViewInit === false) {
      return;
    }

    this.containerMinHeight.set(Math.min(PageHelper.ScrollY + window.innerHeight, this.gridContainer().nativeElement.clientHeight)); // reduce flickering
    setTimeout(() => {
      this.updateContainerDimensions();
      this.mergeNewPhotos();
      this.renderMinimalPhotos();
      setTimeout(() => {
        this.containerMinHeight.set(0); // remove min height after new photos are rendered
      }, 0);
    }, 0);
  }

  private onGridSizeChange(gs: GridSizes): void {
    switch (gs) {
      case GridSizes.extraSmall:
        this.TARGET_COL_COUNT = 12;
        this.MIN_ROW_COUNT = 5;
        this.MAX_ROW_COUNT = 10;
        this.IMAGE_MARGIN = 1;
        break;
      case GridSizes.small:
        this.TARGET_COL_COUNT = 8;
        this.MIN_ROW_COUNT = 3;
        this.MAX_ROW_COUNT = 8;
        this.IMAGE_MARGIN = 1.5;
        break;
      case GridSizes.medium:
        this.TARGET_COL_COUNT = 5;
        this.MIN_ROW_COUNT = 2;
        this.MAX_ROW_COUNT = 5;
        this.IMAGE_MARGIN = 2;
        break;
      case GridSizes.large:
        this.TARGET_COL_COUNT = 2;
        this.MIN_ROW_COUNT = 1;
        this.MAX_ROW_COUNT = 3;
        this.IMAGE_MARGIN = 2;
        break;
      case GridSizes.extraLarge:
        this.TARGET_COL_COUNT = 1;
        this.MIN_ROW_COUNT = 1;
        this.MAX_ROW_COUNT = 2;
        this.IMAGE_MARGIN = 2;
        break;
    }
    // the first render happens in ngAfterViewInit
    if (!this.isAfterViewInit) {
      return;
    }
    this.clearRenderedPhotos();
    this.renderMinimalPhotos();
  }

  ngOnDestroy(): void {
    if (this.helperTime != null) {
      clearTimeout(this.helperTime);
    }
    if (this.renderDelayTimer) {
      clearTimeout(this.renderDelayTimer);
      this.renderDelayTimer = null;
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
    this.pinnedWidth.set(this.containerWidth);
    this.renderDelayTimer = window.setTimeout(() => {
      this.renderDelayTimer = null;
      this.pinnedWidth.set(null);
      // render the same amount of images after resize
      const renderedCount = this.getNumberOfRenderedMedia();
      // do not rerender if container is not changes
      if (this.updateContainerDimensions() === false) {
        return;
      }
      this.renderPhotos(renderedCount);
    }, 100);
  }

  photoClicked(media: MediaDTO): void {
    this.router.navigate([], {
      queryParams: this.queryService.getParams({media}),
    });
  }

  ngAfterViewInit(): void {
    this.updateContainerDimensions();
    this.clearRenderedPhotos();
    this.renderMinimalPhotos();
    this.isAfterViewInit = true;
  }

  /**
   * Renders the rows up to this media plus one more and scrolls its tile into view.
   * Resolves after that render with the tile's position and its GridMedia, or null if the media is not in the grid.
   */
  async revealMedia(media: MediaDTO): Promise<LightboxGridTile | null> {
    // the grid measures its width in ngAfterViewInit, it can't render rows before that
    if (!this.isAfterViewInit) {
      await this.afterRender();
    }
    const id = this.queryService.getMediaStringId(media);
    if (!this.renderUpToMedia(id)) {
      return null;
    }
    await this.afterRender();
    const tile = this.photoComponents().find(p => this.queryService.getMediaStringId(p.gridMedia().media) === id);
    if (!tile) {
      return null;
    }
    const rect = tile.getDimension();
    // if the tile is out of the screen -> scroll to there.
    // Instantly (the page has smooth scrolling): the lightbox animates from the tile's place right away.
    if (PageHelper.ScrollY > rect.top || PageHelper.ScrollY + window.innerHeight < rect.top) {
      window.scrollTo({left: window.scrollX, top: rect.top, behavior: 'instant'});
    }
    return {rect, gridMedia: tile.gridMedia()};
  }

  private afterRender(): Promise<void> {
    return new Promise<void>(resolve => afterNextRender(() => resolve(), {injector: this.injector}));
  }

  private static hasSameLayout(m1: MediaDTO, m2: MediaDTO): boolean {
    return m1.name === m2.name &&
      m1.directory?.name === m2.directory?.name &&
      m1.directory?.path === m2.directory?.path &&
      m1.metadata?.size?.width === m2.metadata?.size?.width &&
      m1.metadata?.size?.height === m2.metadata?.size?.height;
  }

  // Merging photos after new sorting and filter was applied
  public mergeNewPhotos(): void {
    const rendered = this.mediaToRender();
    if (rendered.length === 0) {
      return;
    }
    const mediaGroups = this.mediaGroups();
    if (mediaGroups?.length === 0) {
      this.clearRenderedPhotos();
      return;
    }
    // a copy of the rendered groups: an unchanged group keeps its object, a changed one gets a new one
    const groups = [...rendered];
    // merge new data with old one
    const firstDeleteIndex = {
      groups: 0,
      media: 0
    };
    const lastOkIndex = {
      groups: 0,
      media: 0
    };
    let diffFound = false;
    let i = 0;
    let j = 0;

    for (; i < mediaGroups.length && i < groups.length; ++i) {

      if (diffFound) {
        break;
      }

      if (groups[i].name !== mediaGroups[i].name) {
        groups[i] = {...groups[i], name: mediaGroups[i].name}; // update name if only this changed
      }

      let lastRowId = null;
      j = 0;
      for (; j < mediaGroups[i].media.length && j < groups[i].media.length; ++j) {
        const media = mediaGroups[i].media[j];
        const gridMedia = groups[i].media[j];

        // If a media changed the whole row has to be removed
        if (gridMedia.rowId !== lastRowId) {
          firstDeleteIndex.groups = i;
          firstDeleteIndex.media = j;
          lastRowId = gridMedia.rowId;
        }

        if (gridMedia.equals(media) === false) {
          // Same file with the same size: only its metadata changed (e.g. an
          // extension button edited its keywords). Swap it in: the rows
          // and the scroll position are kept, only this tile is re-rendered.
          if (GalleryGridComponent.hasSameLayout(gridMedia.media, media)) {
            const groupMedia = [...groups[i].media];
            groupMedia[j] = new GridMedia(media, gridMedia.renderWidth, gridMedia.renderHeight, gridMedia.rowId);
            groups[i] = {...groups[i], media: groupMedia};
          } else {
            // we go no further. Found the first bad media
            diffFound = true;
            break;
          }
        }
        // save the last media that was checked and was ok
        lastOkIndex.groups = i;
        lastOkIndex.media = j;
      }
      if (mediaGroups[i].media.length != groups[i].media.length) {
        break;
      }
    }

    // if all check passed, nothing to delete from the last group
    if (!diffFound &&
      lastOkIndex.media == mediaGroups[lastOkIndex.groups].media.length - 1) {
      firstDeleteIndex.groups = lastOkIndex.groups; // delete last ok group as we might want to add more photos
      firstDeleteIndex.media = lastOkIndex.media + 1;
    }

    if (firstDeleteIndex.media < 0 && firstDeleteIndex.groups < 0) {
      this.clearRenderedPhotos();
      return;
    }
    // only delete the whole group if all media is different
    if (firstDeleteIndex.media === 0) {
      this.mediaToRender.set(groups.slice(0, firstDeleteIndex.groups));
      return;
    }
    const kept = groups.slice(0, firstDeleteIndex.groups + 1);
    const lastGroup = kept[firstDeleteIndex.groups];
    if (lastGroup.media.length > firstDeleteIndex.media) {
      kept[firstDeleteIndex.groups] = {...lastGroup, media: lastGroup.media.slice(0, firstDeleteIndex.media)};
    }
    this.mediaToRender.set(kept);
  }

  public renderARow(): number | null {
    if (
      !this.isMoreToRender() ||
      this.containerWidth === 0
    ) {
      return null;
    }

    const groups = [...this.mediaToRender()];
    // step group
    const mediaGroups = this.mediaGroups();
    if (groups.length == 0 ||
      groups[groups.length - 1].media.length >=
      mediaGroups[groups.length - 1].media.length) {
      groups.push({
        name: mediaGroups[groups.length].name,
        date: mediaGroups[groups.length].date,
        media: []
      } as GridMediaGroup);
    }
    const lastIndex = groups.length - 1;

    const baseMaxRowHeight = this.getMaxRowHeight();
    let maxRowHeight = baseMaxRowHeight;
    const minRowHeight = this.screenHeight / this.MAX_ROW_COUNT;

    const photoRowBuilder = new GridRowBuilder(
      mediaGroups[lastIndex].media,
      groups[lastIndex].media.length,
      this.IMAGE_MARGIN,
      this.containerWidth - this.overlayService.getPhantomScrollbarWidth()
    );

    photoRowBuilder.addPhotos(this.TARGET_COL_COUNT);
    photoRowBuilder.adjustRowHeightBetween(minRowHeight, maxRowHeight);

    // little trick: We don't want too big single images. But if a little extra height helps fit the row, its ok
    if (photoRowBuilder.getPhotoRow().length > 1) {
      maxRowHeight *= 1.2;
    }
    const noFullRow = photoRowBuilder.calcRowHeight() > maxRowHeight;
    // if the row is not full, make it average sized.
    // Use the base max height, so not full rows of different groups that share a line have the same height
    const rowHeight = noFullRow ? (minRowHeight + baseMaxRowHeight) / 2 :
      Math.min(photoRowBuilder.calcRowHeight(), maxRowHeight);
    const imageHeight = rowHeight - this.IMAGE_MARGIN * 2;

    const rowId = groups[lastIndex].media.length;
    const row = photoRowBuilder.getPhotoRow().map((media): GridMedia => {
      const imageWidth = imageHeight * MediaDTOUtils.calcAspectRatio(media);
      return new GridMedia(media, imageWidth, imageHeight, rowId);
    });
    groups[lastIndex] = {...groups[lastIndex], media: [...groups[lastIndex].media, ...row]};
    this.mediaToRender.set(groups);

    return rowHeight;
  }

  onScroll(): void {
    const prioritiseThumbnails = Config.Gallery.enableOnScrollThumbnailPrioritising === true;
    if (
      !this.onScrollFired &&
      this.mediaGroups() &&
      // should we trigger this at all?
      (this.isMoreToRender() || prioritiseThumbnails)
    ) {
      window.requestAnimationFrame((): void => {
        this.renderPhotos();

        if (prioritiseThumbnails) {
          for (const pc of this.photoComponents()) {
            if (pc.ScrollListener) {
              pc.onScroll();
            }
          }
        }

        this.onScrollFired = false;
      });
      this.onScrollFired = true;
    }
  }

  getNumberOfRenderedMedia(): number {
    return this.mediaToRender().reduce((c, mg) => c + mg.media.length, 0);
  }

  /*
  Renders some photos. If nothing is specified, this amount should be enough
  * */
  private renderMinimalPhotos(): void {
    this.helperTime = window.setTimeout((): void => {
      this.renderPhotos();
    }, 0);
  }

  private getMaxRowHeight(): number {
    return this.screenHeight / this.MIN_ROW_COUNT;
  }

  /**
   * Renders the rows up to the media with the given string id, plus one more row.
   * Returns false if the media is not in the grid.
   */
  private renderUpToMedia(mediaStringId: string): boolean {
    const mediaGroups = this.mediaGroups();
    if (!mediaGroups) {
      return false;
    }
    let groupIndex = -1;
    let mediaIndex = -1;

    for (let i = 0; i < mediaGroups.length; ++i) {
      mediaIndex = mediaGroups[i].media.findIndex(
        (p): boolean => this.queryService.getMediaStringId(p) === mediaStringId
      );
      if (mediaIndex !== -1) {
        groupIndex = i;
        break;
      }
    }
    if (groupIndex === -1) {
      return false;
    }
    // Make sure that at least one more row is rendered
    // It is possible that only the last few pixels of a photo are visible,
    // so not required to render more. However, the scrollbar does not trigger more photos to render
    // (on lightbox navigation)
    const needsMore = (): boolean => {
      const rendered = this.mediaToRender();
      if (rendered.length - 1 < groupIndex) {
        return true; // the group of the media is not rendered yet
      }
      if (rendered.length - 1 > groupIndex) {
        return false; // the next group already has a row
      }
      const groupMedia = rendered[groupIndex].media;
      if (groupMedia.length <= mediaIndex) {
        return true; // the media is not rendered yet
      }
      // is there a row after the row of the media?
      return groupMedia[groupMedia.length - 1].rowId === groupMedia[mediaIndex].rowId;
    };
    while (needsMore() && this.renderARow() !== null) {
      // renders a row in each step
    }
    return true;
  }

  private clearRenderedPhotos(): void {
    this.mediaToRender.set([]);
    this.changeDetector.detectChanges();
  }

  /**
   * Returns true, if scroll is >= 70% to render more images.
   * Or of onscroll rendering is off: return always to render all the images at once
   * @param offset Add height to the client height (content is not yet added to the dom, but calculate with it)
   * @returns boolean
   */
  private shouldRenderMore(offset = 0): boolean {
    const bottomOffset = this.getMaxRowHeight() * 2;
    const maxScroll = PageHelper.MaxScrollY + offset;
    return (
      Config.Gallery.enableOnScrollRendering === false ||
      PageHelper.ScrollY >= maxScroll - bottomOffset || // too close to the bottom
      maxScroll * 0.85 < window.innerHeight
    );
  }

  private renderPhotos(numberOfPhotos = 0): void {
    if (!this.mediaGroups()) {
      return;
    }
    if (
      this.containerWidth === 0 ||
      !this.isMoreToRender() ||
      !this.shouldRenderMore()
    ) {
      return;
    }
    let renderedContentHeight = 0;

    while (
      this.isMoreToRender() &&
      (this.shouldRenderMore(renderedContentHeight) === true ||
        this.getNumberOfRenderedMedia() < numberOfPhotos)
      ) {
      const ret = this.renderARow();
      if (ret === null) {
        throw new Error('Grid media rendering failed');
      }
      renderedContentHeight += ret;
    }
  }

  private isMoreToRender(): boolean {
    const rendered = this.mediaToRender();
    const mediaGroups = this.mediaGroups();
    return rendered.length < mediaGroups.length ||
      (rendered[rendered.length - 1]?.media.length || 0) < mediaGroups[rendered.length - 1]?.media.length;
  }

  private updateContainerDimensions(): boolean {
    const gridContainer = this.gridContainer();
    if (!gridContainer) {
      return false;
    }

    const scrollY = PageHelper.OverflowY;
    PageHelper.showScrollY('grid');
    // if the width changed a bit or the height changed a lot
    if (
      this.containerWidth !== gridContainer.nativeElement.parentElement.clientWidth ||
      this.screenHeight < window.innerHeight * 0.75 ||
      this.screenHeight > window.innerHeight * 1.25
    ) {
      this.screenHeight = window.innerHeight;
      this.containerWidth = gridContainer.nativeElement.parentElement.clientWidth;
      this.clearRenderedPhotos();
      PageHelper.OverflowY = scrollY;
      return true;
    }

    PageHelper.OverflowY = scrollY;
    return false;
  }
}

interface GridMediaGroup {
  media: GridMedia[];
  name: string;
  date?: Date;
}
