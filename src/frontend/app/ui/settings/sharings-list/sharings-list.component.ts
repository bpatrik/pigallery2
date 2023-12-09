import {Component, OnInit} from '@angular/core';
import {SharingDTO} from '../../../../../common/entities/SharingDTO';
import {SettingsService} from '../settings.service';
import {ShareService} from '../../gallery/share.service';

@Component({
  selector: 'app-settigns-sharings-list',
  templateUrl: './sharings-list.component.html',
  styleUrls: ['./sharings-list.component.css']
})
export class SharingsListComponent implements OnInit {

  public shares: SharingDTO[] = [];


  constructor(public sharingService: ShareService,
              public settingsService: SettingsService) {
  }


  ngOnInit(): void {
    this.getSharingList();
  }

  get Enabled(): boolean {
    return this.settingsService.settings.value.Sharing.enabled;
  }

  async deleteSharing(sharing: SharingDTO): Promise<void> {
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
