import {QueryList} from '@angular/core';
import {type Params} from '@angular/router';
import {Observable} from 'rxjs';
import {GridMedia} from '../grid/GridMedia';
import {type Dimension} from '../../../model/IRenderable';
import {type MediaDTO} from '../../../../../common/entities/MediaDTO';
import {QueryService} from '../../../model/query.service';
import type {GalleryPhotoComponent} from '../grid/photo/photo.grid.gallery.component';

export type LightboxLoadState = 'idle' | 'loading' | 'error';

export interface LightboxItem {
  gridMedia: GridMedia;
}

/**
 * Ordered media the lightbox navigates. It does not need to be rendered in a grid.
 */
export interface LightboxSource {
  readonly changes: Observable<unknown>;
  readonly length: number;
  readonly loadState: LightboxLoadState;

  get(index: number): GridMedia;

  getMediaId(media: MediaDTO): string;

  indexOfId(id: string): number;

  // Grid position in page coordinates; null when the item is not rendered.
  animationTarget(index: number): Dimension | null;

  queryParams(media?: MediaDTO): Params;

  hasMore(): boolean;

  loadMore(): Promise<void>;
}

/**
 * Folders adapter: navigates the photos rendered by the grid.
 */
export class GridLightboxSource implements LightboxSource {
  readonly loadState: LightboxLoadState = 'idle';

  constructor(
    private photos: QueryList<GalleryPhotoComponent>,
    private queryService: QueryService
  ) {
  }

  get changes(): Observable<unknown> {
    return this.photos.changes;
  }

  get length(): number {
    return this.photos.length;
  }

  get(index: number): GridMedia {
    return this.photos.get(index)?.gridMedia;
  }

  getMediaId(media: MediaDTO): string {
    return this.queryService.getMediaStringId(media);
  }

  indexOfId(id: string): number {
    return this.photos.toArray().findIndex(
      (p): boolean => this.getMediaId(p.gridMedia.media) === id
    );
  }

  animationTarget(index: number): Dimension | null {
    return this.photos.get(index)?.getDimension() ?? null;
  }

  queryParams(media?: MediaDTO): Params {
    return this.queryService.getParams(media ? {media} : undefined);
  }

  hasMore(): boolean {
    return false;
  }

  loadMore(): Promise<void> {
    return Promise.resolve();
  }
}
