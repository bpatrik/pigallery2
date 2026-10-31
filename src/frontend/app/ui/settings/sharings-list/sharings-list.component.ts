import { Component, OnInit, inject } from '@angular/core';
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


  public shares: ResponseSharingDTO[] = [];


  ngOnInit(): void {
    this.getSharingList();
  }

  get Enabled(): boolean {
    return this.settingsService.settings.value.Sharing.enabled;
  }

  async deleteSharing(sharing: ResponseSharingDTO): Promise<void> {
    await this.sharingService.deleteSharing(sharing);
    await this.getSharingList();
  }

  private async getSharingList(): Promise<void> {
    try {
      this.shares = await this.sharingService.getSharingList();
    } catch (err) {
      this.shares = [];
      throw err;
    }
  }

}
