import {QueryList} from '@angular/core';
import {Params} from '@angular/router';
import {merge, Observable} from 'rxjs';
import {LightboxLoadState, LightboxSource} from '../gallery/lightbox/LightboxSource';
import {GridMedia} from '../gallery/grid/GridMedia';
import {GalleryPhotoComponent} from '../gallery/grid/photo/photo.grid.gallery.component';
import {Dimension} from '../../model/IRenderable';
import {MediaDTO, MediaDTOUtils} from '../../../../common/entities/MediaDTO';
import {QueryParams} from '../../../../common/QueryParams';
import {TimelineStore} from './timeline.store';
import {getTimelineMediaId} from './timeline-grouping';

/**
 * Timeline adapter: navigates every loaded item, rendered or not, and loads the next page at the end.
 */
export class TimelineLightboxSource implements LightboxSource {
  private static readonly PREVIEW_HEIGHT = 300;
  readonly changes: Observable<unknown>;
  private gridMedia = new WeakMap<MediaDTO, GridMedia>();

  constructor(
    private store: TimelineStore,
    private photos: QueryList<GalleryPhotoComponent>
  ) {
    this.changes = merge(store.changes, photos.changes);
  }

  get length(): number {
    return this.store.items.length;
  }

  get loadState(): LightboxLoadState {
    if (this.store.loading) {
      return 'loading';
    }
    return this.store.error ? 'error' : 'idle';
  }

  get(index: number): GridMedia {
    const media = this.store.items[index];
    if (!media) {
      return undefined;
    }
    let gridMedia = this.gridMedia.get(media);
    if (!gridMedia) {
      // reuse the grid's instance when rendered, so the viewer previews the already loaded thumbnail
      gridMedia = this.findPhoto(media)?.gridMedia ?? new GridMedia(
        media,
        TimelineLightboxSource.PREVIEW_HEIGHT * MediaDTOUtils.calcAspectRatio(media),
        TimelineLightboxSource.PREVIEW_HEIGHT,
        0
      );
      this.gridMedia.set(media, gridMedia);
    }
    return gridMedia;
  }

  getMediaId(media: MediaDTO): string {
    return getTimelineMediaId(media);
  }

  indexOfId(id: string): number {
    return this.store.items.findIndex((m): boolean => getTimelineMediaId(m) === id);
  }

  animationTarget(index: number): Dimension | null {
    const media = this.store.items[index];
    return media ? this.findPhoto(media)?.getDimension() ?? null : null;
  }

  queryParams(media?: MediaDTO): Params {
    return media ? {[QueryParams.gallery.photo]: getTimelineMediaId(media)} : {};
  }

  hasMore(): boolean {
    return this.store.hasMore;
  }

  loadMore(): Promise<void> {
    return this.store.loadNextPage();
  }

  private findPhoto(media: MediaDTO): GalleryPhotoComponent {
    return this.photos.find((p): boolean => p.gridMedia.media === media);
  }
}
