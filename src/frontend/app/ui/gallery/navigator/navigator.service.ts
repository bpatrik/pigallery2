import { Injectable, inject } from '@angular/core';
import {GalleryCacheService} from '../cache.gallery.service';
import {BehaviorSubject} from 'rxjs';
import {Config} from '../../../../../common/config/public/Config';
import {ContentLoaderService} from '../contentLoader.service';
import {GridSizes} from '../../../../../common/entities/GridSizes';
import {Utils} from '../../../../../common/Utils';

@Injectable({providedIn: 'root'})
export class GalleryNavigatorService {
  private galleryCacheService = inject(GalleryCacheService);
  private galleryService = inject(ContentLoaderService);

  public girdSize: BehaviorSubject<GridSizes>;

  constructor() {

    // TODO load def instead
    this.girdSize = new BehaviorSubject(this.getDefaultGridSize());
    this.galleryService.content.subscribe((c) => {
      if (c) {
        const gs = this.galleryCacheService.getGridSize(c) ?? this.getDefaultGridSize();
        this.nextGridSize(gs);
      }
    });
  }

  nextGridSize(value: GridSizes): void {
    if (!Utils.equalsFilter(this.girdSize.value, value)) {
      this.girdSize.next(value);
    }
  }

  setGridSize(gs: GridSizes) {
    this.nextGridSize(gs);
    if (this.galleryService.content.value) {
      if (
        !this.isDefaultGridSize()
      ) {
        this.galleryCacheService.setGridSize(
          this.galleryService.content.value,
          gs
        );
      } else {
        this.galleryCacheService.removeGridSize(
          this.galleryService.content.value
        );
      }
    }
  }

  isDefaultGridSize(): boolean {
    return this.girdSize.value === this.getDefaultGridSize();
  }


  getDefaultGridSize(): GridSizes {
    return Config.Gallery.NavBar.defaultGidSize;
  }

}
