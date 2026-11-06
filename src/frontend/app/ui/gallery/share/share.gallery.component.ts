import { Component, TemplateRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import {Utils} from '../../../../../common/Utils';
import {ShareService} from '../share.service';
import {ResponseSharingDTO} from '../../../../../common/entities/SharingDTO';
import {Config} from '../../../../../common/config/public/Config';
import {NotificationService} from '../../../model/notification.service';
import {BsModalService} from 'ngx-bootstrap/modal';
import {BsModalRef} from 'ngx-bootstrap/modal';
import {UserRoles} from '../../../../../common/entities/UserDTO';
import {AuthenticationService} from '../../../model/network/authentication.service';
import {copyToClipboard, CopyDirective} from '../../utils/copy/copy.directive';
import {ContentLoaderService} from '../contentLoader.service';
import { DatePipe } from '@angular/common';
import { NgIconComponent } from '@ng-icons/core';
import { FormsModule } from '@angular/forms';
import { DirectorySearch, SearchQueryDTO, SearchQueryTypes, TextSearchQueryMatchTypes } from '../../../../../common/entities/SearchQueryDTO';
import { StringifySearchQuery } from '../../../pipes/StringifySearchQuery';

@Component({
    selector: 'app-gallery-share',
    templateUrl: './share.gallery.component.html',
    styleUrl: './share.gallery.component.css',
    imports: [
    NgIconComponent,
    FormsModule,
    CopyDirective,
    DatePipe,
    StringifySearchQuery
]
})
export class GalleryShareComponent {
  sharingService = inject(ShareService);
  galleryService = inject(ContentLoaderService);
  private notification = inject(NotificationService);
  private modalService = inject(BsModalService);
  authService = inject(AuthenticationService);

  readonly dropDownItem = input(false);
  readonly url = signal('');
  readonly urlValid = signal(false);
  showSharingList = false;

  input = {
    valid: {
      amount: 30,
      type: ValidityTypes.Days as ValidityTypes,
    },
    password: null as string | null,
  };
  // share the subdirectories too (directory sharing only)
  readonly recursive = signal(false);
  // what the current content would share
  private readonly target = computed((): {
    enabled: boolean;
    dir: string;
    searchQuery: SearchQueryDTO | null;
    name: string;
    mediaCount: number;
    recursiveMediaCount: number;
    mediaCountIsLowerBound: boolean;
  } => {
    const content = this.galleryService.content();
    const target = {
      enabled: !!(content?.directory || content?.searchResult),
      dir: '',
      searchQuery: null as SearchQueryDTO | null,
      name: '',
      mediaCount: 0,
      recursiveMediaCount: 0,
      mediaCountIsLowerBound: false,
    };
    if (content?.searchResult) {
      const sr = content.searchResult;
      target.searchQuery = sr.searchQuery;
      target.name = $localize`Search query`;
      target.mediaCount = sr.media ? sr.media.length : 0;
      target.mediaCountIsLowerBound = !!sr.resultOverflow;
    } else if (content?.directory) {
      target.dir = Utils.concatUrls(content.directory.path, content.directory.name);
      target.name = target.dir;
      // Prefer mediaCount, fallback to media length if needed
      target.mediaCount = typeof content.directory.cache?.mediaCount === 'number' ?
        content.directory.cache.mediaCount : (content.directory.media ? content.directory.media.length : 0);
      target.recursiveMediaCount = content.directory.cache?.recursiveMediaCount ?? target.mediaCount;
    }
    return target;
  });
  readonly enabled = computed((): boolean => this.target().enabled);
  readonly currentDir = computed((): string => this.target().dir);
  readonly isDirectorySharing = computed((): boolean => !!this.currentDir());
  readonly sharingTarget = computed((): string => this.target().name);
  readonly currentMediaCountIsLowerBound = computed((): boolean => this.target().mediaCountIsLowerBound);
  readonly sharedMediaCount = computed((): number =>
    this.isDirectorySharing() && this.recursive() ? this.target().recursiveMediaCount : this.target().mediaCount);
  readonly currentQuery = computed((): SearchQueryDTO | null =>
    this.isDirectorySharing() ? this.buildDirectoryQuery(this.recursive()) : this.target().searchQuery);
  readonly sharing = signal<ResponseSharingDTO | null>(null);
  readonly passwordRequired = Config.Sharing.passwordRequired;
  readonly ValidityTypes = ValidityTypes;

  modalRef: BsModalRef | null;
  invalidSettings = $localize`Invalid settings`;

  private readonly activeShares = signal<ResponseSharingDTO[]>([]);
  // the active shares with their link and whether they share the subdirectories too (a 'path/*' glob)
  readonly activeShareRows = computed((): { share: ResponseSharingDTO; url: string; recursive: boolean }[] =>
    (this.activeShares() ?? []).map(share => ({
      share,
      url: this.sharingService.getUrl(share),
      recursive: share.directoryQuery?.matchType === TextSearchQueryMatchTypes.globMatch &&
        !!share.directoryQuery.value?.endsWith('*')
    })));

  text = {
    Yes: 'Yes',
    No: 'No',
  };

  constructor() {
    this.text.Yes = $localize`Yes`;
    this.text.No = $localize`No`;
    // effect: loads the active shares of the new content over HTTP
    effect(() => {
      this.target();
      untracked(() => this.onContentChange().catch(console.error));
    });
  }

  public get IsAdmin() {
    return this.authService.isAuthorized(UserRoles.Developer); // above Admin
  }

  private async onContentChange(): Promise<void> {
    this.activeShares.set([]);
    if (!this.enabled() || !this.currentQuery()) {
      return;
    }
    await this.updateActiveSharesList();
  }

  /**
   * Directory sharing: exact match for the directory, or the directory and everything below it if recursive
   */
  private buildDirectoryQuery(recursive: boolean): DirectorySearch {
    return recursive ? {
      type: SearchQueryTypes.directory,
      value: Utils.concatUrls(this.currentDir(), '*'),
      matchType: TextSearchQueryMatchTypes.globMatch
    } as DirectorySearch : {
      type: SearchQueryTypes.directory,
      value: this.currentDir(),
      matchType: TextSearchQueryMatchTypes.exact_match
    } as DirectorySearch;
  }

  async onRecursiveChange(): Promise<void> {
    if (!this.isDirectorySharing()) {
      return;
    }
    if (this.sharing()) {
      await this.update();
    }
  }


  async deleteSharing(sharing: ResponseSharingDTO): Promise<void> {
    await this.sharingService.deleteSharing(sharing);
    await this.updateActiveSharesList();
  }

  private async updateActiveSharesList() {
    try {
      const query = this.currentQuery();
      if (!query) {
        this.activeShares.set([]);
        return;
      }
      if (this.isDirectorySharing()) {
        // list the shares of this folder with and without subfolders, independently of the switch
        const lists = await Promise.all([false, true].map(r =>
          this.sharingService.getSharingListForQuery(this.buildDirectoryQuery(r))));
        this.activeShares.set(lists.flat());
        return;
      }
      this.activeShares.set(await this.sharingService.getSharingListForQuery(query));
    } catch (e) {
      this.activeShares.set([]);
      console.error(e);
    }
  }

  calcValidity(): number {
    switch (parseInt(this.input.valid.type.toString(), 10)) {
      case ValidityTypes.Minutes:
        return this.input.valid.amount * 1000 * 60;
      case ValidityTypes.Hours:
        return this.input.valid.amount * 1000 * 60 * 60;
      case ValidityTypes.Days:
        return this.input.valid.amount * 1000 * 60 * 60 * 24;
      case ValidityTypes.Months:
        return this.input.valid.amount * 1000 * 60 * 60 * 24 * 30;
      case ValidityTypes.Forever:
        return -1;
    }
    throw new Error('unknown type: ' + this.input.valid.type);
  }

  async update(): Promise<void> {
    const sharing = this.sharing();
    const query = this.currentQuery();
    if (sharing == null || !query) {
      return;
    }
    this.urlValid.set(false);
    this.url.set($localize`loading..`);
    const updated = this.isDirectorySharing()
      ? await this.sharingService.updateSharingByDirectory(
        sharing.id,
        query as DirectorySearch,
        this.input.password,
        this.calcValidity(),
        this.currentDir()
      )
      : await this.sharingService.updateSharingByQuery(
        sharing.id,
        query,
        this.input.password,
        this.calcValidity()
      );
    this.sharing.set(updated);
    this.urlValid.set(true);
    this.url.set(this.sharingService.getUrl(updated));
    await this.updateActiveSharesList();
  }

  async get(): Promise<void> {
    if(Config.Sharing.passwordRequired && !this.input.password){
      this.url.set($localize`Set password.`);
      return;
    }
    const query = this.currentQuery();
    if (!query) {
      this.url.set($localize`Invalid settings`);
      return;
    }
    this.urlValid.set(false);
    this.url.set($localize`loading..`);
    const created = this.isDirectorySharing()
      ? await this.sharingService.createSharingByDirectory(
        query as DirectorySearch,
        this.input.password,
        this.calcValidity(),
        this.currentDir()
      )
      : await this.sharingService.createSharingByQuery(
        query,
        this.input.password,
        this.calcValidity()
      );
    this.sharing.set(created);
    this.url.set(this.sharingService.getUrl(created));
    this.urlValid.set(true);
    await this.updateActiveSharesList();
  }

  async openModal(template: TemplateRef<unknown>): Promise<void> {
    this.url.set($localize`Click share to get a link.`);
    this.urlValid.set(false);
    this.sharing.set(null);
    this.input.password = '';
    if (this.modalRef) {
      this.modalRef?.hide();
    }
    this.modalRef = this.modalService.show(template);
  }

  onCopy(): void {
    this.notification.success($localize`Sharing link has been copied to clipboard`);
  }

  public hideModal(): void {
    this.modalRef?.hide();
    this.modalRef = null;
    this.sharing.set(null);
  }

  async share() {
    await this.get();
    if (await copyToClipboard(this.url())) {
      this.onCopy();
    }
  }

}


export enum ValidityTypes {
  Minutes = 1, Hours = 2, Days = 3, Months = 4, Forever = 99
}
