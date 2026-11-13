import {Component, TemplateRef, computed, inject, signal} from '@angular/core';
import {Config} from '../../../../../common/config/public/Config';
import {NotificationService} from '../../../model/notification.service';
import {BsModalService} from 'ngx-bootstrap/modal';
import {BsModalRef} from 'ngx-bootstrap/modal';
import {SearchQueryDTO, SearchQueryTypes, TextSearch, TextSearchQueryMatchTypes} from '../../../../../common/entities/SearchQueryDTO';
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
export class RandomQueryBuilderGalleryComponent {
  contentLoaderService = inject(ContentLoaderService);
  private notification = inject(NotificationService);
  private modalService = inject(BsModalService);

  /**
   * The random link starts with the photos on the screen: the query of the opened search or the opened folder.
   */
  private readonly shownQuery = computed((): SearchQueryDTO | null => {
    const c = this.contentLoaderService.content();
    if (c?.searchResult) {
      return c.searchResult.searchQuery;
    }
    if (c?.directory) {
      return {
        type: SearchQueryTypes.directory,
        matchType: TextSearchQueryMatchTypes.exact_match,
        value: Utils.concatUrls('./', c.directory.path, c.directory.name)
      } as TextSearch;
    }
    return null;
  });
  public readonly searchQueryDTO = signal<SearchQueryDTO>({type: SearchQueryTypes.any_text, value: ''} as TextSearch);
  readonly enabled = computed((): boolean => this.shownQuery() !== null);
  readonly url = signal('');


  modalRef: BsModalRef | null = null;

  onQueryChange(): void {
    this.url.set(Config.Server.getPublicUrl(Config.Server.apiPath, '/gallery/random/',
      encodeURIComponent(SearchQueryUtils.urlify(this.searchQueryDTO()))));
  }

  openModal(template: TemplateRef<unknown>): boolean | undefined {
    const shown = this.shownQuery();
    if (!shown) {
      return undefined;
    }
    if (this.modalRef) {
      this.modalRef?.hide();
    }

    // a copy: the builder must not change the query of the shown search
    this.searchQueryDTO.set(structuredClone(shown));
    this.onQueryChange();
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
