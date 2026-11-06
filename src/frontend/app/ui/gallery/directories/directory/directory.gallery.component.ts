import { Component, OnDestroy, OnInit, computed, inject, input } from '@angular/core';
import {SubDirectoryDTO} from '../../../../../../common/entities/DirectoryDTO';
import {RouterLink} from '@angular/router';
import {Utils} from '../../../../../../common/Utils';
import {Media} from '../../Media';
import {Thumbnail, ThumbnailManagerService,} from '../../thumbnailManager.service';
import {QueryService} from '../../../../model/query.service';
import {CoverPhotoDTO} from '../../../../../../common/entities/PhotoDTO';

import { IconComponent } from '../../../../icon.component';
import {CssUrlPipe} from '../../../../pipes/CssUrlPipe';

@Component({
    selector: 'app-gallery-directory',
    templateUrl: './directory.gallery.component.html',
    styleUrl: './directory.gallery.component.css',
    imports: [
    RouterLink,
    IconComponent,
    CssUrlPipe
]
})
export class GalleryDirectoryComponent implements OnInit, OnDestroy {
  private thumbnailService = inject(ThumbnailManagerService);
  queryService = inject(QueryService);

  readonly directory = input.required<SubDirectoryDTO>();
  readonly size = input.required<number>();
  thumbnail: Thumbnail | null = null;

  public get SamplePhoto(): CoverPhotoDTO | undefined {
    return this.directory().cache?.cover;
  }

  // TODO: implement scroll
  /* isInView(): boolean {
     return document.body.scrollTop < this.container.nativeElement.offsetTop + this.container.nativeElement.clientHeight
       && document.body.scrollTop + window.innerHeight > this.container.nativeElement.offsetTop;
   }*/

  public readonly directoryPath = computed((): string => Utils.concatUrls(this.directory().path, this.directory().name));

  ngOnDestroy(): void {
    if (this.thumbnail != null) {
      this.thumbnail.destroy();
    }
  }

  ngOnInit(): void {
    const cover = this.SamplePhoto;
    if (cover) {
      this.thumbnail = this.thumbnailService.getThumbnail(
          new Media(cover, this.size(), this.size())
      );
    }
  }
}

