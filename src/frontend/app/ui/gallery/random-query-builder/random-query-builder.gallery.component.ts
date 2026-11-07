import { Component, OnDestroy, TemplateRef, computed, inject, linkedSignal } from '@angular/core';
import {Config} from '../../../../../common/config/public/Config';
import {NotificationService} from '../../../model/notification.service';
import {BsModalService} from 'ngx-bootstrap/modal';
import {BsModalRef} from 'ngx-bootstrap/modal';
import {NetworkService} from '../../../model/network/network.service';
import {Subscription} from 'rxjs';
import {DirectorySearch, SearchQueryDTO, SearchQueryTypes, TextSearch, TextSearchQueryMatchTypes} from '../../../../../common/entities/SearchQueryDTO';
import {ActivatedRoute, Params} from '@angular/router';
import {QueryParams} from '../../../../../common/QueryParams';
import {SearchQueryParserService} from '../search/search-query-parser.service';
import {ContentLoaderService} from '../contentLoader.service';
import { NgIconComponent } from '@ng-icons/core';
import { FormsModule } from '@angular/forms';
import {CopyDirective} from '../../utils/copy/copy.directive';
import { GallerySearchQueryBuilderComponent } from '../search/query-builder/query-bulder.gallery.component';
import {SearchQueryUtils} from '../../../../../common/SearchQueryUtils';
import {Utils} from '../../../../../common/Utils';

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

  public readonly searchQueryDTO = linkedSignal<string | null, SearchQueryDTO>({
    source: (): string | null => {
      const dir = this.contentLoaderService.content()?.directory;
      if (!dir) {
        return null;
      }
      return SearchQueryUtils.normalizeDirectoryPath(
        Utils.concatUrls(dir.path, dir.name)
      );
    },
    computation: (directory, prev): SearchQueryDTO => {
      if (prev && prev.source === directory) {
        return prev.value;
      }
      if (!directory) {
        return {
          type: SearchQueryTypes.any_text,
          value: '',
        } as TextSearch;
      }
      return {
        type: SearchQueryTypes.directory,
        matchType: TextSearchQueryMatchTypes.globMatch,
        value: directory + '/*',
      } as DirectorySearch;
    },
  });

  readonly enabled = computed((): boolean => !!this.contentLoaderService.content()?.directory);

  get HTMLSearchQuery(): string {
    return SearchQueryUtils.urlify(this.searchQueryDTO());
  }

  readonly url = computed((): string => NetworkService.buildUrl(
    Config.Server.getPublicUrl(Config.Server.apiPath, '/gallery/random') + '/' + encodeURIComponent(this.HTMLSearchQuery)
  ));

  modalRef: BsModalRef | null = null;

  private readonly subscription: Subscription | null = null;

  constructor() {
    this.subscription = this.route.params.subscribe((params: Params) => {
      if (!params[QueryParams.gallery.search.query]) {
        return;
      }
      const searchQuery = SearchQueryUtils.parseURLifiedQuery(params[QueryParams.gallery.search.query]);
      if (searchQuery) {
        this.searchQueryDTO.set(searchQuery);
      }
    });
  }

  onQueryChange(): void {
    // url is computed reactively from searchQueryDTO
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
