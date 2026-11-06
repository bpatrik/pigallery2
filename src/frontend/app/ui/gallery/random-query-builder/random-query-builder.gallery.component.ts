import { Component, OnDestroy, TemplateRef, computed, inject, signal } from '@angular/core';
import {Config} from '../../../../../common/config/public/Config';
import {NotificationService} from '../../../model/notification.service';
import {BsModalService} from 'ngx-bootstrap/modal';
import {BsModalRef} from 'ngx-bootstrap/modal';
import {NetworkService} from '../../../model/network/network.service';
import {Subscription} from 'rxjs';
import {SearchQueryDTO, SearchQueryTypes, TextSearch,} from '../../../../../common/entities/SearchQueryDTO';
import {ActivatedRoute, Params} from '@angular/router';
import {QueryParams} from '../../../../../common/QueryParams';
import {SearchQueryParserService} from '../search/search-query-parser.service';
import {ContentLoaderService} from '../contentLoader.service';
import { NgIconComponent } from '@ng-icons/core';
import { FormsModule } from '@angular/forms';
import {CopyDirective} from '../../utils/copy/copy.directive';
import { GallerySearchQueryBuilderComponent } from '../search/query-builder/query-bulder.gallery.component';
import {SearchQueryUtils} from '../../../../../common/SearchQueryUtils';

@Component({
    selector: 'app-gallery-random-query-builder',
    templateUrl: './random-query-builder.gallery.component.html',
    styleUrl: './random-query-builder.gallery.component.css',
    imports: [
        NgIconComponent,
        FormsModule,
        CopyDirective,
        GallerySearchQueryBuilderComponent,
    ]
})
export class RandomQueryBuilderGalleryComponent implements OnDestroy {
  contentLoaderService = inject(ContentLoaderService);
  private notification = inject(NotificationService);
  private searchQueryParserService = inject(SearchQueryParserService);
  private route = inject(ActivatedRoute);
  private modalService = inject(BsModalService);

  public readonly searchQueryDTO = signal<SearchQueryDTO>({type: SearchQueryTypes.any_text, value: ''} as TextSearch);
  readonly enabled = computed((): boolean => !!this.contentLoaderService.content()?.directory);
  readonly url = signal('');


  modalRef: BsModalRef | null;

  private readonly subscription: Subscription | null = null;

  constructor() {
    this.subscription = this.route.params.subscribe((params: Params) => {
      if (!params[QueryParams.gallery.search.query]) {
        return;
      }
      const searchQuery = SearchQueryUtils.parseURLifiedQuery(params[QueryParams.gallery.search.query]);
      if (searchQuery) {
        this.searchQueryDTO.set(searchQuery);
        this.onQueryChange();
      }
    });
  }

  get HTMLSearchQuery(): string {
    return SearchQueryUtils.urlify(this.searchQueryDTO());
  }

  onQueryChange(): void {
    this.url.set(NetworkService.buildUrl(
        Config.Server.getPublicUrl(Config.Server.apiPath, '/gallery/random/') + '/' + this.HTMLSearchQuery
    ));
  }

  ngOnDestroy(): void {
    if (this.subscription !== null) {
      this.subscription.unsubscribe();
    }
  }

  openModal(template: TemplateRef<unknown>): boolean | undefined {
    if (!this.enabled()) {
      return undefined;
    }
    if (this.modalRef) {
      this.modalRef?.hide();
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
    this.modalRef?.hide();
    this.modalRef = null;
  }
}
