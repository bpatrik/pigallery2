import {Component, OnDestroy, OnInit, TemplateRef} from '@angular/core';
import {ContentWrapper} from '../../../../../common/entities/ContentWrapper';
import {Config} from '../../../../../common/config/public/Config';
import {NotificationService} from '../../../model/notification.service';
import {BsModalService} from 'ngx-bootstrap/modal';
import {BsModalRef} from 'ngx-bootstrap/modal/bs-modal-ref.service';
import {NetworkService} from '../../../model/network/network.service';
import {Subscription} from 'rxjs';
import {SearchQueryDTO, SearchQueryTypes, TextSearch, TextSearchQueryMatchTypes,} from '../../../../../common/entities/SearchQueryDTO';
import {ActivatedRoute, Params} from '@angular/router';
import {QueryParams} from '../../../../../common/QueryParams';
import {SearchQueryParserService} from '../search/search-query-parser.service';
import {ContentLoaderService} from '../contentLoader.service';
import { NgIconComponent } from '@ng-icons/core';
import { FormsModule } from '@angular/forms';
import { ClipboardModule } from 'ngx-clipboard';
import { GallerySearchQueryBuilderComponent } from '../search/query-builder/query-bulder.gallery.component';
import {SearchQueryUtils} from '../../../../../common/SearchQueryUtils';
import {Utils} from '../../../../../common/Utils';

@Component({
    selector: 'app-gallery-random-query-builder',
    templateUrl: './random-query-builder.gallery.component.html',
    styleUrls: ['./random-query-builder.gallery.component.css'],
    imports: [
        NgIconComponent,
        FormsModule,
        ClipboardModule,
        GallerySearchQueryBuilderComponent,
    ]
})
export class RandomQueryBuilderGalleryComponent implements OnInit, OnDestroy {
  public searchQueryDTO: SearchQueryDTO = {
    type: SearchQueryTypes.any_text,
    value: '',
  } as TextSearch;
  enabled = true;
  url = '';

  contentSubscription: Subscription = null;
  private prefilledDirectory: string = null;

  modalRef: BsModalRef;

  private readonly subscription: Subscription = null;

  constructor(
      public contentLoaderService: ContentLoaderService,
      private notification: NotificationService,
      private searchQueryParserService: SearchQueryParserService,
      private route: ActivatedRoute,
      private modalService: BsModalService
  ) {
    this.subscription = this.route.params.subscribe((params: Params) => {
      if (!params[QueryParams.gallery.search.query]) {
        return;
      }
      const searchQuery = SearchQueryUtils.parseURLifiedQuery(params[QueryParams.gallery.search.query]);
      if (searchQuery) {
        this.searchQueryDTO = searchQuery;
        this.onQueryChange();
      }
    });
  }

  get HTMLSearchQuery(): string {
    return SearchQueryUtils.urlify(this.searchQueryDTO);
  }

  onQueryChange(): void {
    this.url = NetworkService.buildUrl(
        Config.Server.getPublicUrl(Config.Server.apiPath, '/gallery/random') + '/' + encodeURIComponent(this.HTMLSearchQuery)
    );
  }

  ngOnInit(): void {
    this.contentSubscription = this.contentLoaderService.content.subscribe(
        (content: ContentWrapper) => {
          this.enabled = !!content?.directory;
          if (!this.enabled) {
            return;
          }
          const directory = SearchQueryUtils.normalizeDirectoryPath(
              Utils.concatUrls(content.directory.path, content.directory.name)
          );
          // prefill only when the directory changes, so a query typed by the user is not overwritten
          if (directory === this.prefilledDirectory) {
            return;
          }
          this.prefilledDirectory = directory;
          this.searchQueryDTO = directory
              ? {
                type: SearchQueryTypes.directory,
                matchType: TextSearchQueryMatchTypes.globMatch,
                value: directory + '/*',
              } as TextSearch
              : {
                type: SearchQueryTypes.any_text,
                value: '',
              } as TextSearch;
          this.onQueryChange();
        }
    );
  }

  ngOnDestroy(): void {
    if (this.contentSubscription !== null) {
      this.contentSubscription.unsubscribe();
    }

    if (this.subscription !== null) {
      this.subscription.unsubscribe();
    }
  }

  openModal(template: TemplateRef<unknown>): boolean {
    if (!this.enabled) {
      return;
    }
    if (this.modalRef) {
      this.modalRef.hide();
    }

    this.modalRef = this.modalService.show(template, {class: 'modal-lg'});
    document.body.style.paddingRight = '0px';
    this.onQueryChange();
    return false;
  }

  onCopy(): void {
    this.notification.success($localize`Url has been copied to clipboard`);
  }

  public hideModal(): void {
    this.modalRef.hide();
    this.modalRef = null;
  }
}
