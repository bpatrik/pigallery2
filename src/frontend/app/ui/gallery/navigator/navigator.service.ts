import {Injectable} from '@angular/core';
import {GalleryCacheService} from '../cache.gallery.service';
import {BehaviorSubject} from 'rxjs';
import {Config} from '../../../../../common/config/public/Config';
import {ContentLoaderService} from '../contentLoader.service';
import {GridSizes} from '../../../../../common/entities/GridSizes';

@Injectable()
export class GalleryNavigatorService {
  public girdSize: BehaviorSubject<GridSizes>;

  constructor(
      private galleryCacheService: GalleryCacheService,
      private galleryService: ContentLoaderService,
  ) {

    // TODO load def instead
    this.girdSize = new BehaviorSubject(this.getDefaultGridSize());
    this.galleryService.content.subscribe((c) => {
      if (c) {
        if (c) {
          const gs = this.galleryCacheService.getGridSize(c);
          if (gs !== null) {
            this.girdSize.next(gs);
          } else {
            this.girdSize.next(this.getDefaultGridSize());
          }
        }
      }
    });
  }


  setGridSize(gs: GridSizes) {
    this.girdSize.next(gs);
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
