import { Component, OnInit, inject, computed, signal } from '@angular/core';
import {ResponseSharingDTO} from '../../../../../common/entities/SharingDTO';
import {SettingsService} from '../settings.service';
import {ShareService} from '../../gallery/share.service';
import { DatePipe } from '@angular/common';
import { NgIconComponent } from '@ng-icons/core';
import { StringifySearchQuery } from '../../../pipes/StringifySearchQuery';

@Component({
    selector: 'app-settigns-sharings-list',
    templateUrl: './sharings-list.component.html',
    styleUrl: './sharings-list.component.css',
    imports: [NgIconComponent, DatePipe, StringifySearchQuery]
})
export class SharingsListComponent implements OnInit {
  sharingService = inject(ShareService);
  settingsService = inject(SettingsService);


  public readonly shares = signal<ResponseSharingDTO[]>([]);
  // the shares with their link
  readonly shareRows = computed((): { share: ResponseSharingDTO; url: string }[] =>
    (this.shares() ?? []).map(share => ({
      share,
      url: this.sharingService.getUrl(share)
    })));
  readonly Enabled = computed<boolean>(() => this.settingsService.settings().Sharing.enabled);


  ngOnInit(): void {
    this.getSharingList();
  }

  async deleteSharing(sharing: ResponseSharingDTO): Promise<void> {
    await this.sharingService.deleteSharing(sharing);
    await this.getSharingList();
  }

  private async getSharingList(): Promise<void> {
    try {
      this.shares.set(await this.sharingService.getSharingList());
    } catch (err) {
      this.shares.set([]);
      throw err;
    }
  }

}
