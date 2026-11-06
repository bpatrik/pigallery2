import { Component, OnDestroy, OnInit, computed, inject, input } from '@angular/core';
import {RouterLink} from '@angular/router';
import {PersonDTO} from '../../../../../common/entities/PersonDTO';
import {PersonThumbnail, ThumbnailManagerService,} from '../../gallery/thumbnailManager.service';
import {FacesService} from '../faces.service';
import {AuthenticationService} from '../../../model/network/authentication.service';
import {Config} from '../../../../../common/config/public/Config';
import {SearchQueryTypes, TextSearch, TextSearchQueryMatchTypes,} from '../../../../../common/entities/SearchQueryDTO';

import { NgIconComponent } from '@ng-icons/core';
import {CssUrlPipe} from '../../../pipes/CssUrlPipe';
import {SearchQueryUtils} from '../../../../../common/SearchQueryUtils';

@Component({
    selector: 'app-face',
    templateUrl: './face.component.html',
    styleUrl: './face.component.css',
    imports: [
    RouterLink,
    NgIconComponent,
    CssUrlPipe
]
})
export class FaceComponent implements OnInit, OnDestroy {
  private thumbnailService = inject(ThumbnailManagerService);
  private faceService = inject(FacesService);
  authenticationService = inject(AuthenticationService);

  readonly person = input.required<PersonDTO>();
  readonly size = input.required<number>();

  public thumbnail: PersonThumbnail | null = null;
  public searchQueryDTOstr: string;

  public readonly canUpdate = computed((): boolean =>
    this.authenticationService.isAuthorized(Config.Faces.writeAccessMinRole)
  );

  ngOnInit(): void {
    this.thumbnail = this.thumbnailService.getPersonThumbnail(this.person());
    this.searchQueryDTOstr = SearchQueryUtils.urlify({
      type: SearchQueryTypes.person,
      value: this.person().name,
      matchType: TextSearchQueryMatchTypes.exact_match,
    } as TextSearch);
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
        .setFavourite(this.person(), !this.person().isFavourite)
        .catch(console.error);
  }
}

