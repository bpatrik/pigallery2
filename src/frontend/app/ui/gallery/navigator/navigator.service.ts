import { Injectable, computed, inject, linkedSignal } from '@angular/core';
import {GalleryCacheService} from '../cache.gallery.service';
import {Config} from '../../../../../common/config/public/Config';
import {ContentLoaderService} from '../contentLoader.service';
import {GridSizes} from '../../../../../common/entities/GridSizes';
import {Utils} from '../../../../../common/Utils';

@Injectable({providedIn: 'root'})
export class GalleryNavigatorService {
  private galleryCacheService = inject(GalleryCacheService);
  private galleryService = inject(ContentLoaderService);

  // the grid size saved for the content, until the user changes it
  public readonly girdSize = linkedSignal<GridSizes>(() =>
    this.galleryCacheService.getGridSize(this.galleryService.content()) ?? this.getDefaultGridSize()
  );

  nextGridSize(value: GridSizes): void {
    if (!Utils.equalsFilter(this.girdSize(), value)) {
      this.girdSize.set(value);
    }
  }

  setGridSize(gs: GridSizes) {
    this.nextGridSize(gs);
    if (this.galleryService.content()) {
      if (
        !this.isDefaultGridSize()
      ) {
        this.galleryCacheService.setGridSize(
          this.galleryService.content(),
          gs
        );
      } else {
        this.galleryCacheService.removeGridSize(
          this.galleryService.content()
        );
      }
    }
  }

  public readonly isDefaultGridSize = computed((): boolean => this.girdSize() === this.getDefaultGridSize());


  getDefaultGridSize(): GridSizes {
    return Config.Gallery.NavBar.defaultGidSize;
  }

}
