import {Component, Input, OnDestroy, OnInit} from '@angular/core';
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

@Component({
  selector: 'app-album',
  templateUrl: './album.component.html',
  styleUrls: ['./album.component.css'],
  providers: [RouterLink],
})
export class AlbumComponent implements OnInit, OnDestroy {
  @Input() album: AlbumBaseDTO;
  @Input() size: number;
  public readonly svgIcon = Config.Server.svgIcon;

  public thumbnail: Thumbnail = null;

  constructor(
      private thumbnailService: ThumbnailManagerService,
      private sanitizer: DomSanitizer,
      private albumService: AlbumsService,
      public authenticationService: AuthenticationService
  ) {
  }

  get IsSavedSearch(): boolean {
    return this.album && !!this.AsSavedSearch.searchQuery;
  }

  get AsSavedSearch(): SavedSearchDTO {
    return this.album as SavedSearchDTO;
  }

  get CanUpdate(): boolean {
    return this.authenticationService.user.getValue().role >= UserRoles.Admin;
  }

  get RouterLink(): any[] {
    if (this.IsSavedSearch) {
      return ['/search', JSON.stringify(this.AsSavedSearch.searchQuery)];
    }
    // TODO: add "normal" albums here once they are ready, see: https://github.com/bpatrik/pigallery2/issues/301
    return null;
  }

  ngOnInit(): void {
    if (this.album.cover) {
      this.thumbnail = this.thumbnailService.getThumbnail(
          new Media(this.album.cover, this.size, this.size)
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
    await this.albumService.deleteAlbum(this.album).catch(console.error);
  }
}

