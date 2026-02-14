import {Component, ElementRef, OnInit, TemplateRef, ViewChild,} from '@angular/core';
import {AlbumsService} from './albums.service';
import {BsModalService} from 'ngx-bootstrap/modal';
import {BsModalRef} from 'ngx-bootstrap/modal/bs-modal-ref.service';
import {SearchQueryTypes, TextSearch,} from '../../../../common/entities/SearchQueryDTO';
import {UserRoles} from '../../../../common/entities/UserDTO';
import {AuthenticationService} from '../../model/network/authentication.service';
import {PiTitleService} from '../../model/pi-title.service';
import {FrameComponent} from '../frame/frame.component';
import {AsyncPipe, NgFor, NgIf} from '@angular/common';
import {AlbumComponent} from './album/album.component';
import {NgIconComponent} from '@ng-icons/core';
import {FormsModule} from '@angular/forms';
import {GallerySearchQueryBuilderComponent} from '../gallery/search/query-builder/query-bulder.gallery.component';
import {SavedSearchPopupComponent} from './saved-search-popup/saved-search-popup.component';
import {ShareService} from '../gallery/share.service';
import {NavigationService} from '../../model/navigation.service';

@Component({
  selector: 'app-albums',
  templateUrl: './albums.component.html',
  styleUrls: ['./albums.component.css'],
  imports: [
    FrameComponent,
    NgFor,
    AlbumComponent,
    NgIf,
    NgIconComponent,
    FormsModule,
    GallerySearchQueryBuilderComponent,
    SavedSearchPopupComponent,
    AsyncPipe,
  ]
})
export class AlbumsComponent implements OnInit {
  @ViewChild('container', {static: true}) container: ElementRef;
  public size: number;
  public savedSearch = {
    name: '',
    searchQuery: {type: SearchQueryTypes.any_text, value: ''} as TextSearch,
  };
  private modalRef: BsModalRef;

  constructor(
    public albumsService: AlbumsService,
    private modalService: BsModalService,
    public authenticationService: AuthenticationService,
    private piTitleService: PiTitleService,
    private shareService: ShareService,
    private authService: AuthenticationService,
    private navigation: NavigationService,
  ) {
    this.albumsService.getAlbums().catch(console.error);
  }

  get CanCreateAlbum(): boolean {
    return this.authenticationService.user.getValue()?.user?.role >= UserRoles.Admin;
  }

  async ngOnInit() {
    await this.shareService.wait();
    if (!this.authService.isAuthenticated()) {
      return this.navigation.toLogin();
    }
    this.piTitleService.setTitle($localize`Albums`);
    this.updateSize();
  }

  public async openModal(template: TemplateRef<any>): Promise<void> {
    this.modalRef = this.modalService.show(template, {class: 'modal-lg'});
    document.body.style.paddingRight = '0px';
  }

  public hideModal(): void {
    this.modalRef.hide();
    this.modalRef = null;
  }

  async saveSearch(): Promise<void> {
    await this.albumsService.addSavedSearch(
      this.savedSearch.name,
      this.savedSearch.searchQuery
    );
    this.hideModal();
  }

  private updateSize(): void {
    const size = 220 + 5;
    // body - container margin
    const containerWidth = this.container.nativeElement.clientWidth - 30;
    this.size = containerWidth / Math.round(containerWidth / size) - 5;
  }
}

