import { Component, Input, OnDestroy, OnInit, inject } from '@angular/core';
import {MediaDTO} from '../../../../../common/entities/MediaDTO';
import {IconThumbnail, ThumbnailManagerService,} from '../../gallery/thumbnailManager.service';
import {MediaIcon} from '../../gallery/MediaIcon';

import { PopoverDirective } from 'ngx-bootstrap/popover';

@Component({
    selector: 'app-duplicates-photo',
    templateUrl: './photo.duplicates.component.html',
    styleUrl: './photo.duplicates.component.css',
    imports: [PopoverDirective]
})
export class DuplicatesPhotoComponent implements OnInit, OnDestroy {
  private thumbnailService = inject(ThumbnailManagerService);

  @Input() media: MediaDTO;

  thumbnail: IconThumbnail;

  ngOnInit(): void {
    this.thumbnail = this.thumbnailService.getIcon(new MediaIcon(this.media));
  }

  ngOnDestroy(): void {
    this.thumbnail.destroy();
  }
}

