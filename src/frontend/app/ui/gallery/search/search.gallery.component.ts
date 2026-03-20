import {Component, OnDestroy, TemplateRef} from '@angular/core';
import {AutoCompleteService} from './autocomplete.service';
import {ActivatedRoute, Params, Router, RouterLink} from '@angular/router';
import {Subscription} from 'rxjs';
import {QueryParams} from '../../../../../common/QueryParams';
import {MetadataSearchQueryTypes, SearchQueryDTO, SearchQueryTypes, TextSearch,} from '../../../../../common/entities/SearchQueryDTO';
import {BsModalService} from 'ngx-bootstrap/modal';
import {BsModalRef} from 'ngx-bootstrap/modal/bs-modal-ref.service';
import {SearchQueryParserService} from './search-query-parser.service';
import {AlbumsService} from '../../albums/albums.service';
import {Config} from '../../../../../common/config/public/Config';
import {UserRoles} from '../../../../../common/entities/UserDTO';
import {AuthenticationService} from '../../../model/network/authentication.service';
import {Utils} from '../../../../../common/Utils';
import {FormsModule} from '@angular/forms';
import {GallerySearchFieldBaseComponent} from './search-field-base/search-field-base.gallery.component';
import {NgIconComponent} from '@ng-icons/core';
import {GallerySearchQueryBuilderComponent} from './query-builder/query-bulder.gallery.component';
import {NgIf} from '@angular/common';
import {SavedSearchPopupComponent} from '../../albums/saved-search-popup/saved-search-popup.component';
import {SearchQueryUtils} from '../../../../../common/SearchQueryUtils';

@Component({
  selector: 'app-gallery-search',
  templateUrl: './search.gallery.component.html',
  styleUrls: ['./search.gallery.component.css'],
  providers: [AutoCompleteService],
  imports: [
    FormsModule,
    GallerySearchFieldBaseComponent,
    RouterLink,
    NgIconComponent,
    GallerySearchQueryBuilderComponent,
    NgIf,
    SavedSearchPopupComponent,
  ]
})
export class GallerySearchComponent implements OnDestroy {
  public searchQueryDTO: SearchQueryDTO = {
    type: SearchQueryTypes.any_text,
    value: '',
  } as TextSearch;
  public rawSearchText = '';
  mouseOverAutoComplete = false;
  readonly SearchQueryTypes: typeof SearchQueryTypes;
  public readonly MetadataSearchQueryTypes: {
    value: string;
    key: SearchQueryTypes;
  }[];
  public saveSearchName = '';
  private searchModalRef: BsModalRef;
  private readonly subscription: Subscription = null;
  private saveSearchModalRef: BsModalRef;

  constructor(
    private searchQueryParserService: SearchQueryParserService,
    private albumService: AlbumsService,
    private route: ActivatedRoute,
    public router: Router,
    private modalService: BsModalService,
    public authenticationService: AuthenticationService
  ) {
    this.SearchQueryTypes = SearchQueryTypes;
    this.MetadataSearchQueryTypes = MetadataSearchQueryTypes.map((v) => ({
      key: v,
      value: SearchQueryTypes[v],
    }));

    this.subscription = this.route.params.subscribe((params: Params): void => {
      if (!params[QueryParams.gallery.search.query]) {
        return;
      }
      const searchQuery: string = params[QueryParams.gallery.search.query];
      if (searchQuery) {
        this.searchQueryDTO = SearchQueryUtils.parseURLifiedQuery(searchQuery);
        this.onQueryChange();
      }
    });
  }

  get CanCreateAlbum(): boolean {
    return (
      Config.Album.enabled &&
      this.authenticationService.user.getValue().role >= UserRoles.Admin
    );
  }

  get HTMLSearchQuery(): string {
    return SearchQueryUtils.urlify(this.searchQueryDTO);
  }

  ngOnDestroy(): void {
    if (this.subscription !== null) {
      this.subscription.unsubscribe();
    }
  }

  public async openSearchModal(template: TemplateRef<unknown>): Promise<void> {
    this.searchModalRef = this.modalService.show(template, {
      class: 'modal-lg',
    });
    document.body.style.paddingRight = '0px';
  }

  public hideSearchModal(): void {
    this.searchModalRef.hide();
    this.searchModalRef = null;
  }

  public async openSaveSearchModal(template: TemplateRef<unknown>): Promise<void> {
    this.saveSearchModalRef = this.modalService.show(template, {
      class: 'modal-lg',
    });
    document.body.style.paddingRight = '0px';
  }

  public hideSaveSearchModal(): void {
    this.saveSearchModalRef.hide();
    this.saveSearchModalRef = null;
  }

  public onQueryChange(): void {
    if (Utils.equalsFilter(this.searchQueryParserService.parse(this.rawSearchText), this.searchQueryDTO)) {
      return;
    }

    this.rawSearchText = this.searchQueryParserService.stringify(
      this.searchQueryDTO
    );
  }

  validateRawSearchText(): void {
    try {
      this.searchQueryDTO = this.searchQueryParserService.parse(
        this.rawSearchText
      );
    } catch (e) {
      console.error(e);
    }
  }

  Search(): void {
    this.router
      .navigate(['/search', this.HTMLSearchQuery])
      .catch(console.error);
  }

  async saveSearch(): Promise<void> {
    await this.albumService.addSavedSearch(
      this.saveSearchName,
      SearchQueryUtils.stripDefault(this.searchQueryDTO)
    );
    this.hideSaveSearchModal();
  }
}


