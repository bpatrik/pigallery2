import {Component, Input, OnDestroy, OnInit} from '@angular/core';
import {RouterLink} from '@angular/router';
import {PersonDTO} from '../../../../../common/entities/PersonDTO';
import {DomSanitizer, SafeStyle} from '@angular/platform-browser';
import {PersonThumbnail, ThumbnailManagerService,} from '../../gallery/thumbnailManager.service';
import {FacesService} from '../faces.service';
import {AuthenticationService} from '../../../model/network/authentication.service';
import {Config} from '../../../../../common/config/public/Config';
import {SearchQueryTypes, TextSearch, TextSearchQueryMatchTypes,} from '../../../../../common/entities/SearchQueryDTO';

@Component({
  selector: 'app-face',
  templateUrl: './face.component.html',
  styleUrls: ['./face.component.css'],
  providers: [RouterLink],
})
export class FaceComponent implements OnInit, OnDestroy {
  @Input() person: PersonDTO;
  @Input() size: number;

  public thumbnail: PersonThumbnail = null;
  public searchQueryDTOstr: string;

  constructor(
      private thumbnailService: ThumbnailManagerService,
      private sanitizer: DomSanitizer,
      private faceService: FacesService,
      public authenticationService: AuthenticationService
  ) {
  }

  get CanUpdate(): boolean {
    return (
        this.authenticationService.user.getValue().role >=
        Config.Faces.writeAccessMinRole
    );
  }

  ngOnInit(): void {
    this.thumbnail = this.thumbnailService.getPersonThumbnail(this.person);
    this.searchQueryDTOstr = JSON.stringify({
      type: SearchQueryTypes.person,
      text: this.person.name,
      matchType: TextSearchQueryMatchTypes.exact_match,
    } as TextSearch);
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

  async toggleFavourite($event: MouseEvent): Promise<void> {
    $event.preventDefault();
    $event.stopPropagation();
    await this.faceService
        .setFavourite(this.person, !this.person.isFavourite)
        .catch(console.error);
  }
}

