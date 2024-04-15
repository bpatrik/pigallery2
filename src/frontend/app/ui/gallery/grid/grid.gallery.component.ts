import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  QueryList,
  ViewChild,
  ViewChildren,
} from '@angular/core';
import {GridRowBuilder} from './GridRowBuilder';
import {GalleryLightboxComponent} from '../lightbox/lightbox.gallery.component';
import {GridMedia} from './GridMedia';
import {GalleryPhotoComponent} from './photo/photo.grid.gallery.component';
import {OverlayService} from '../overlay.service';
import {Config} from '../../../../../common/config/public/Config';
import {PageHelper} from '../../../model/page.helper';
import {Subscription} from 'rxjs';
import {ActivatedRoute, Params, Router} from '@angular/router';
import {QueryService} from '../../../model/query.service';
import {MediaDTO, MediaDTOUtils,} from '../../../../../common/entities/MediaDTO';
import {QueryParams} from '../../../../../common/QueryParams';
import {GallerySortingService, MediaGroup} from '../navigator/sorting.service';
import {GroupByTypes} from '../../../../../common/entities/SortingMethods';
import {GalleryNavigatorService} from '../navigator/navigator.service';
import {GridSizes} from '../../../../../common/entities/GridSizes';

@Component({
  selector: 'app-gallery-grid',
  templateUrl: './grid.gallery.component.html',
  styleUrls: ['./grid.gallery.component.css'],
})
export class GalleryGridComponent
  implements OnInit, OnChanges, AfterViewInit, OnDestroy {
  @ViewChild('gridContainer', {static: false}) gridContainer: ElementRef;
  @ViewChildren(GalleryPhotoComponent)
  gridPhotoQL: QueryList<GalleryPhotoComponent>;
  @Input() lightbox: GalleryLightboxComponent;
  @Input() mediaGroups: MediaGroup[];
  mediaToRender: GridMediaGroup[] = [];
  containerWidth = 0;
  screenHeight = 0;
  isAfterViewInit = false;
  subscriptions: {
    girdSize: Subscription;
    route: Subscription;
  } = {
    route: null,
    girdSize: null
  };
  delayedRenderUpToPhoto: string = null;
  private scrollListenerPhotos: GalleryPhotoComponent[] = [];
  private TARGET_COL_COUNT = 5;
  private MIN_ROW_COUNT = 2;
  private MAX_ROW_COUNT = 5;
  public IMAGE_MARGIN = 2;
  private onScrollFired = false;
  private helperTime: number = null;
  public renderDelayTimer: number = null; // delays render on resize
  public readonly GroupByTypes = GroupByTypes;
  public readonly blogOpen = Config.Gallery.InlineBlogStartsOpen;

  constructor(
    private overlayService: OverlayService,
    private changeDetector: ChangeDetectorRef,
    public queryService: QueryService,
    private router: Router,
    public sortingService: GallerySortingService,
    public navigatorService: GalleryNavigatorService,
    private route: ActivatedRoute
  ) {
  }

  ngOnChanges(): void {
    if (this.isAfterViewInit === false) {
      return;
    }
    this.updateContainerDimensions();
    this.mergeNewPhotos();
    this.renderMinimalPhotos();
  }

  ngOnInit(): void {
    this.subscriptions.route = this.route.queryParams.subscribe(
      (params: Params): void => {
        if (
          params[QueryParams.gallery.photo] &&
          params[QueryParams.gallery.photo] !== ''
        ) {
          this.delayedRenderUpToPhoto = params[QueryParams.gallery.photo];
          if (!this.mediaGroups?.length) {
            return;
          }

          this.renderUpToMedia(params[QueryParams.gallery.photo]);
        }
      }
    );

    this.subscriptions.girdSize = this.navigatorService.girdSize.subscribe(gs => {
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
      this.clearRenderedPhotos();
      this.renderMinimalPhotos();
    });
  }

  ngOnDestroy(): void {
    if (this.helperTime != null) {
      clearTimeout(this.helperTime);
    }
    if (this.renderDelayTimer) {
      clearTimeout(this.renderDelayTimer);
      this.renderDelayTimer = null;
    }
    if (this.subscriptions.route !== null) {
      this.subscriptions.route.unsubscribe();
      this.subscriptions.route = null;
    }
    if (this.subscriptions.girdSize !== null) {
      this.subscriptions.girdSize.unsubscribe();
      this.subscriptions.girdSize = null;
    }
  }

  @HostListener('window:resize')
  onResize(): void {
    if (this.isAfterViewInit === false) {
      return;
    }
    if (this.renderDelayTimer) {
      clearTimeout(this.renderDelayTimer);
      this.renderDelayTimer = null;
    }
    this.renderDelayTimer = window.setTimeout(() => {
      this.renderDelayTimer = null;
      // render the same amount of images after resize
      const renderedCount = this.mediaToRender.reduce((c, mg) => c + mg.media.length, 0);
      // do not rerender if container is not changes
      if (this.updateContainerDimensions() === false) {
        return;
      }
      this.renderPhotos(renderedCount);
    }, 100);
  }

  /*
  Renders some photos. If nothing specified, this amount should be enough
  * */
  private renderMinimalPhotos() {
    this.helperTime = window.setTimeout((): void => {
      this.renderPhotos();
      if (this.delayedRenderUpToPhoto) {
        this.renderUpToMedia(this.delayedRenderUpToPhoto);
      }
    }, 0);
  }

  photoClicked(media: MediaDTO): void {
    this.router.navigate([], {
      queryParams: this.queryService.getParams({media}),
    });
  }

  ngAfterViewInit(): void {
    this.lightbox.setGridPhotoQL(this.gridPhotoQL);

    if (Config.Gallery.enableOnScrollThumbnailPrioritising === true) {
      this.gridPhotoQL.changes.subscribe((): void => {
        this.scrollListenerPhotos = this.gridPhotoQL.filter(
          (pc): boolean => pc.ScrollListener
        );
      });
    }

    this.updateContainerDimensions();
    this.clearRenderedPhotos();
    this.renderMinimalPhotos();
    this.isAfterViewInit = true;
  }


  // Merging photos after new sorting and filter was applied
  public mergeNewPhotos(): void {
    if (this.mediaToRender.length === 0) {
      return;
    }
    if (this.mediaGroups?.length === 0) {
      this.clearRenderedPhotos();
      return;
    }
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

    for (; i < this.mediaGroups.length && i < this.mediaToRender.length; ++i) {

      if (diffFound) {
        break;
      }

      this.mediaToRender[i].name = this.mediaGroups[i].name; // update name if only this changed

      let lastRowId = null;
      j = 0;
      for (; j < this.mediaGroups[i].media.length && j < this.mediaToRender[i].media.length; ++j) {
        const media = this.mediaGroups[i].media[j];
        const gridMedia = this.mediaToRender[i].media[j];

        // If a media changed the whole row has to be removed
        if (gridMedia.rowId !== lastRowId) {
          firstDeleteIndex.groups = i;
          firstDeleteIndex.media = j;
          lastRowId = gridMedia.rowId;
        }

        // we go no further. Found the first bad media
        if (gridMedia.equals(media) === false) {
          diffFound = true;
          break;
        }
        // save the last media that was checked and was ok
        lastOkIndex.groups = i;
        lastOkIndex.media = j;
      }
      if (this.mediaGroups[i].media.length != this.mediaToRender[i].media.length) {
        break;
      }
    }

    // if all check passed, nothing to delete from the last group
    if (!diffFound &&
      lastOkIndex.media == this.mediaGroups[lastOkIndex.groups].media.length - 1) {
      firstDeleteIndex.groups = lastOkIndex.groups;
      firstDeleteIndex.media = lastOkIndex.media + 1;
    }

    if (firstDeleteIndex.media < 0 && firstDeleteIndex.groups < 0) {
      this.clearRenderedPhotos();
      return;
    }
    // only delete the whole group if all media is different
    if (firstDeleteIndex.media === 0) {
      this.mediaToRender.splice(firstDeleteIndex.groups);
      return;
    }
    this.mediaToRender.splice(firstDeleteIndex.groups + 1);
    const media = this.mediaToRender[firstDeleteIndex.groups].media;
    media.splice(firstDeleteIndex.media);


  }

  public renderARow(): number {
    if (
      !this.isMoreToRender() ||
      this.containerWidth === 0
    ) {
      return null;
    }

    // step group
    if (this.mediaToRender.length == 0 ||
      this.mediaToRender[this.mediaToRender.length - 1].media.length >=
      this.mediaGroups[this.mediaToRender.length - 1].media.length) {
      this.mediaToRender.push({
        name: this.mediaGroups[this.mediaToRender.length].name,
        date: this.mediaGroups[this.mediaToRender.length].date,
        media: []
      } as GridMediaGroup);
    }

    let maxRowHeight = this.getMaxRowHeight();
    const minRowHeight = this.screenHeight / this.MAX_ROW_COUNT;

    const photoRowBuilder = new GridRowBuilder(
      this.mediaGroups[this.mediaToRender.length - 1].media,
      this.mediaToRender[this.mediaToRender.length - 1].media.length,
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
    // if the row is not full, make it average sized
    const rowHeight = noFullRow ? (minRowHeight + maxRowHeight) / 2 :
      Math.min(photoRowBuilder.calcRowHeight(), maxRowHeight);
    const imageHeight = rowHeight - this.IMAGE_MARGIN * 2;

    const rowId = this.mediaToRender[this.mediaToRender.length - 1].media.length;
    photoRowBuilder.getPhotoRow().forEach((media): void => {
      const imageWidth = imageHeight * MediaDTOUtils.calcAspectRatio(media);
      this.mediaToRender[this.mediaToRender.length - 1].media.push(
        new GridMedia(media, imageWidth, imageHeight, rowId)
      );
    });

    //this.renderedPhotoIndex += photoRowBuilder.getPhotoRow().length;
    return rowHeight;
  }

  @HostListener('window:scroll')
  onScroll(): void {
    if (
      !this.onScrollFired &&
      this.mediaGroups &&
      // should we trigger this at all?
      (this.isMoreToRender() ||
        this.scrollListenerPhotos.length > 0)
    ) {
      window.requestAnimationFrame((): void => {
        this.renderPhotos();

        if (Config.Gallery.enableOnScrollThumbnailPrioritising === true) {
          this.scrollListenerPhotos.forEach(
            (pc: GalleryPhotoComponent): void => {
              pc.onScroll();
            }
          );
          this.scrollListenerPhotos = this.scrollListenerPhotos.filter(
            (pc): boolean => pc.ScrollListener
          );
        }

        this.onScrollFired = false;
      });
      this.onScrollFired = true;
    }
  }

  private getMaxRowHeight(): number {
    return this.screenHeight / this.MIN_ROW_COUNT;
  }

  /**
   * Makes sure that the photo with the given mediaString is visible on the screen
   */
  private renderUpToMedia(mediaStringId: string): void {
    if (!this.mediaGroups) {
      return;
    }
    let groupIndex = -1;
    let mediaIndex = -1;
    for (let i = 0; i < this.mediaGroups.length; ++i) {
      mediaIndex = this.mediaGroups[i].media.findIndex(
        (p): boolean => this.queryService.getMediaStringId(p) === mediaStringId
      );
      if (mediaIndex !== -1) {
        groupIndex = i;
        break;
      }
    }
    if (groupIndex === -1) {
      this.router.navigate([], {queryParams: this.queryService.getParams()});
      return;
    }
    // Make sure that at leas one more row is rendered
    // It is possible that only the last few pixels of a photo is visible,
    // so not required to render more, but the scrollbar does not trigger more photos to render
    // (on lightbox navigation)
    while (
      (this.mediaToRender.length - 1 <= groupIndex ||
        this.mediaToRender[this.mediaToRender.length - 1]?.media?.length < mediaIndex) &&
      this.renderARow() !== null
      // eslint-disable-next-line no-empty
      ) {
    }
  }

  private clearRenderedPhotos(): void {
    this.mediaToRender = [];
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
    return (
      Config.Gallery.enableOnScrollRendering === false ||
      PageHelper.ScrollY >=
      document.body.clientHeight +
      offset -
      window.innerHeight -
      bottomOffset ||
      (document.body.clientHeight + offset) * 0.85 < window.innerHeight
    );
  }

  private renderPhotos(numberOfPhotos = 0): void {
    if (!this.mediaGroups) {
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

  private isMoreToRender() {
    return this.mediaToRender.length < this.mediaGroups.length ||
      (this.mediaToRender[this.mediaToRender.length - 1]?.media.length || 0) < this.mediaGroups[this.mediaToRender.length - 1]?.media.length;
  }

  getNumberOfRenderedMedia() {
    return this.mediaToRender.reduce((c, mg) => c + mg.media.length, 0);
  }

  private updateContainerDimensions(): boolean {
    if (!this.gridContainer) {
      return false;
    }

    const pre = PageHelper.isScrollYVisible();
    PageHelper.showScrollY();
    // if the width changed a bit or the height changed a lot
    if (
      this.containerWidth !== this.gridContainer.nativeElement.parentElement.clientWidth ||
      this.screenHeight < window.innerHeight * 0.75 ||
      this.screenHeight > window.innerHeight * 1.25
    ) {
      this.screenHeight = window.innerHeight;
      this.containerWidth = this.gridContainer.nativeElement.parentElement.clientWidth;
      this.clearRenderedPhotos();
      if (!pre) {
        PageHelper.hideScrollY();
      }
      return true;
    }

    if (!pre) {
      PageHelper.hideScrollY();
    }
    return false;
  }
}

interface GridMediaGroup {
  media: GridMedia[];
  name: string;
  date?: Date;
}
