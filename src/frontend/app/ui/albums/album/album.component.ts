import { Component, OnDestroy, OnInit, inject, input } from '@angular/core';
import {RouterLink} from '@angular/router';
import {DomSanitizer, SafeStyle} from '@angular/platform-browser';
import {Thumbnail, ThumbnailManagerService,} from '../../gallery/thumbnailManager.service';
import {AuthenticationService} from '../../../model/network/authentication.service';
import {AlbumsService} from '../albums.service';
import {AlbumBaseDTO} from '../../../../../common/entities/album/AlbumBaseDTO';
import {Media} from '../../gallery/Media';
import {SavedSearchDTO} from '../../../../../common/entities/album/SavedSearchDTO';
import {UserRoles} from '../../../../../common/entities/UserDTO';
import {Config} from '../../../../../common/config/public/Config';
import {SearchQueryUtils} from '../../../../../common/SearchQueryUtils';

import { IconComponent } from '../../../icon.component';
import { NgIconComponent } from '@ng-icons/core';

@Component({
    selector: 'app-album',
    templateUrl: './album.component.html',
    styleUrl: './album.component.css',
    imports: [
    RouterLink,
    IconComponent,
    NgIconComponent
]
})
export class AlbumComponent implements OnInit, OnDestroy {
  private thumbnailService = inject(ThumbnailManagerService);
  private sanitizer = inject(DomSanitizer);
  private albumService = inject(AlbumsService);
  authenticationService = inject(AuthenticationService);

  readonly album = input<AlbumBaseDTO>(undefined);
  readonly size = input<number>(undefined);
  public readonly svgIcon = Config.Server.svgIcon;

  public thumbnail: Thumbnail = null;

  get IsSavedSearch(): boolean {
    return this.album() && !!this.AsSavedSearch.searchQuery;
  }

  get AsSavedSearch(): SavedSearchDTO {
    return this.album() as SavedSearchDTO;
  }

  get CanUpdate(): boolean {
    return this.authenticationService.user.getValue().role >= UserRoles.Admin;
  }

  get RouterLink(): any[] {
    if (this.IsSavedSearch) {
      return ['/search', SearchQueryUtils.urlify(this.AsSavedSearch.searchQuery)];
    }
    // TODO: add "normal" albums here once they are ready, see: https://github.com/bpatrik/pigallery2/issues/301
    return null;
  }

  ngOnInit(): void {
    const album = this.album();
    if (album?.cache?.cover) {
      this.thumbnail = this.thumbnailService.getThumbnail(
          new Media(album.cache?.cover, this.size(), this.size())
      );
    }
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

  ngOnDestroy(): void {
    if (this.thumbnail != null) {
      this.thumbnail.destroy();
    }
  }

  async deleteAlbum($event: MouseEvent): Promise<void> {
    $event.preventDefault();
    $event.stopPropagation();
    await this.albumService.deleteAlbum(this.album()).catch(console.error);
  }
}

