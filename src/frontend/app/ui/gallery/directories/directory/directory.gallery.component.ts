import {Component, Input, type OnDestroy, type OnInit, ChangeDetectionStrategy} from '@angular/core';
import {DomSanitizer, type SafeStyle} from '@angular/platform-browser';
import {type SubDirectoryDTO} from '../../../../../../common/entities/DirectoryDTO';
import {RouterLink} from '@angular/router';
import {Utils} from '../../../../../../common/Utils';
import {Media} from '../../Media';
import {Thumbnail, ThumbnailManagerService,} from '../../thumbnailManager.service';
import {QueryService} from '../../../../model/query.service';
import {type CoverPhotoDTO} from '../../../../../../common/entities/PhotoDTO';

import { IconComponent } from '../../../../icon.component';

@Component({
    selector: 'app-gallery-directory',
    templateUrl: './directory.gallery.component.html',
    styleUrls: ['./directory.gallery.component.css'],
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [
    RouterLink,
    IconComponent
]
})
export class GalleryDirectoryComponent implements OnInit, OnDestroy {
  @Input() directory: SubDirectoryDTO;
  @Input() size: number;
  thumbnail: Thumbnail = null;

  constructor(
      private thumbnailService: ThumbnailManagerService,
      private sanitizer: DomSanitizer,
      public queryService: QueryService
  ) {
  }

  public get SamplePhoto(): CoverPhotoDTO {
    return this.directory.cache?.cover;
  }

  getSanitizedThUrl(): SafeStyle {
    return this.sanitizer.bypassSecurityTrustStyle(
        'url(' +
        this.thumbnail.Src.replace(/\(/g, '%28')
            .replace(/'/g, '%27')
            .replace(/\)/g, '%29') +
        ')'
    );
  }

  // TODO: implement scroll
  /* isInView(): boolean {
     return document.body.scrollTop < this.container.nativeElement.offsetTop + this.container.nativeElement.clientHeight
       && document.body.scrollTop + window.innerHeight > this.container.nativeElement.offsetTop;
   }*/

  getDirectoryPath(): string {
    return Utils.concatUrls(this.directory.path, this.directory.name);
  }

  ngOnDestroy(): void {
    if (this.thumbnail != null) {
      this.thumbnail.destroy();
    }
  }

  ngOnInit(): void {
    if (this.directory.cache?.cover) {
      this.thumbnail = this.thumbnailService.getThumbnail(
          new Media(this.SamplePhoto, this.size, this.size)
      );
    }
  }
}

