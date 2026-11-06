import { Component, OnDestroy, OnInit, computed, inject, input } from '@angular/core';
import {RouterLink} from '@angular/router';
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
import {CssUrlPipe} from '../../../pipes/CssUrlPipe';

@Component({
    selector: 'app-album',
    templateUrl: './album.component.html',
    styleUrl: './album.component.css',
    imports: [
    RouterLink,
    IconComponent,
    NgIconComponent,
    CssUrlPipe
]
})
export class AlbumComponent implements OnInit, OnDestroy {
  private thumbnailService = inject(ThumbnailManagerService);
  private albumService = inject(AlbumsService);
  authenticationService = inject(AuthenticationService);

  readonly album = input.required<AlbumBaseDTO>();
  readonly size = input.required<number>();
  public readonly svgIcon = Config.Server.svgIcon;

  public thumbnail: Thumbnail | null = null;

  public readonly canUpdate = computed((): boolean => this.authenticationService.isAuthorized(UserRoles.Admin));

  public readonly routerLink = computed((): string[] | null => {
    const savedSearch = this.album() as SavedSearchDTO;
    if (savedSearch && !!savedSearch.searchQuery) {
      return ['/search', SearchQueryUtils.urlify(savedSearch.searchQuery)];
    }
    // TODO: add "normal" albums here once they are ready, see: https://github.com/bpatrik/pigallery2/issues/301
    return null;
  });

  ngOnInit(): void {
    const album = this.album();
    if (album?.cache?.cover) {
      this.thumbnail = this.thumbnailService.getThumbnail(
          new Media(album.cache?.cover, this.size(), this.size())
      );
    }
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

