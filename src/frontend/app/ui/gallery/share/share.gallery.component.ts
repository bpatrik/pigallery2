import {Component, Input, OnDestroy, OnInit, TemplateRef} from '@angular/core';
import {Utils} from '../../../../../common/Utils';
import {ShareService} from '../share.service';
import {ContentWrapper} from '../../../../../common/entities/ConentWrapper';
import {SharingDTO} from '../../../../../common/entities/SharingDTO';
import {Config} from '../../../../../common/config/public/Config';
import {NotificationService} from '../../../model/notification.service';
import {BsModalService} from 'ngx-bootstrap/modal';
import {BsModalRef} from 'ngx-bootstrap/modal/bs-modal-ref.service';
import {Subscription} from 'rxjs';
import {UserRoles} from '../../../../../common/entities/UserDTO';
import {AuthenticationService} from '../../../model/network/authentication.service';
import {ClipboardService} from 'ngx-clipboard';
import {ContentLoaderService} from '../contentLoader.service';

@Component({
  selector: 'app-gallery-share',
  templateUrl: './share.gallery.component.html',
  styleUrls: ['./share.gallery.component.css'],
})
export class GalleryShareComponent implements OnInit, OnDestroy {
  enabled = true;
  @Input() dropDownItem = false;
  url = '';
  urlValid = false;
  showSharingList = false;

  input = {
    includeSubfolders: true,
    valid: {
      amount: 30,
      type: ValidityTypes.Days as ValidityTypes,
    },
    password: null as string,
  };
  currentDir = '';
  sharing: SharingDTO = null;
  contentSubscription: Subscription = null;
  readonly passwordRequired = Config.Sharing.passwordRequired;
  readonly ValidityTypes = ValidityTypes;

  modalRef: BsModalRef;
  invalidSettings = $localize`Invalid settings`;

  activeShares: SharingDTO[] = [];

  text = {
    Yes: 'Yes',
    No: 'No',
  };

  constructor(
      public sharingService: ShareService,
      public galleryService: ContentLoaderService,
      private notification: NotificationService,
      private modalService: BsModalService,
      public authService: AuthenticationService,
      private clipboardService: ClipboardService
  ) {
    this.text.Yes = $localize`Yes`;
    this.text.No = $localize`No`;
  }

  public get IsAdmin() {
    return this.authService.user.value.role > UserRoles.Admin;
  }

  ngOnInit(): void {
    this.contentSubscription = this.galleryService.content.subscribe(
        async (content: ContentWrapper) => {
          this.activeShares = [];
          this.enabled = !!content.directory;
          if (!this.enabled) {
            return;
          }
          this.currentDir = Utils.concatUrls(
              content.directory.path,
              content.directory.name
          );
          await this.updateActiveSharesList();
        }
    );
  }

  ngOnDestroy(): void {
    if (this.contentSubscription !== null) {
      this.contentSubscription.unsubscribe();
    }
  }


  async deleteSharing(sharing: SharingDTO): Promise<void> {
    await this.sharingService.deleteSharing(sharing);
    await this.updateActiveSharesList();
  }

  private async updateActiveSharesList() {
    try {
      this.activeShares = await this.sharingService.getSharingListForDir(this.currentDir);
    } catch (e) {
      this.activeShares = [];
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
    if (this.sharing == null) {
      return;
    }
    this.urlValid = false;
    this.url = $localize`loading..`;
    this.sharing = await this.sharingService.updateSharing(
        this.currentDir,
        this.sharing.id,
        this.input.includeSubfolders,
        this.input.password,
        this.calcValidity()
    );
    this.urlValid = true;
    this.url = this.sharingService.getUrl(this.sharing);
    await this.updateActiveSharesList();
  }

  async get(): Promise<void> {
    if(Config.Sharing.passwordRequired && !this.input.password){
      this.url = $localize`Set password.`;
      return;
    }
    this.urlValid = false;
    this.url = $localize`loading..`;
    this.sharing = await this.sharingService.createSharing(
        this.currentDir,
        this.input.includeSubfolders,
        this.input.password,
        this.calcValidity()
    );
    this.url = this.sharingService.getUrl(this.sharing);
    this.urlValid = true;
    await this.updateActiveSharesList();
  }

  async openModal(template: TemplateRef<unknown>): Promise<void> {
    this.url = $localize`Click share to get a link.`;
    this.urlValid = false;
    this.sharing = null;
    this.input.password = '';
    if (this.modalRef) {
      this.modalRef.hide();
    }
    this.modalRef = this.modalService.show(template);
  }

  onCopy(): void {
    this.notification.success($localize`Sharing link has been copied to clipboard`);
  }

  public hideModal(): void {
    this.modalRef.hide();
    this.modalRef = null;
    this.sharing = null;
  }

  async share() {
    await this.get();
    if (this.clipboardService.isSupported) {
      this.clipboardService.copy(this.url);
      this.onCopy();
    }

  }

}


export enum ValidityTypes {
  Minutes = 1, Hours = 2, Days = 3, Months = 4, Forever = 99
}
