import { Injectable, inject, signal } from '@angular/core';
import {GridMedia} from '../../GridMedia';
import {IClientMediaButtonConfigWithBaseApiPath} from '../photo.grid.gallery.component';
import {NotificationService} from '../../../../../model/notification.service';
import {NetworkService} from '../../../../../model/network/network.service';
import {Utils} from '../../../../../../../common/Utils';
import {ContentLoaderService} from '../../../contentLoader.service';
import {IMediaRequestBodyData} from '../../../../../../../common/entities/extension/IClientUIConfig';

export interface MediaButtonModalData {
  button: IClientMediaButtonConfigWithBaseApiPath;
  media: GridMedia;
  visible: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class MediaButtonModalService {
  private notificationService = inject(NotificationService);
  private networkService = inject(NetworkService);
  private contentLoader = inject(ContentLoaderService);

  private readonly _modalData = signal<MediaButtonModalData | null>(null);
  readonly modalData = this._modalData.asReadonly();
  private savedModalValues: Record<string, string | number | boolean | undefined> = {};

  showModal(button: IClientMediaButtonConfigWithBaseApiPath, media: GridMedia): void {
    this._modalData.set({
      button,
      media,
      visible: true
    });
  }

  hideModal(): void {
    this._modalData.set(null);
  }

  async executeButtonAction(button: IClientMediaButtonConfigWithBaseApiPath, media: GridMedia, formData?: IMediaRequestBodyData): Promise<void> {
    try {
      if (!button.apiPath) {
        return; // this is a fake button, nothing to call
      }
      // Construct the full API path using base path and button's API path
      const apiPath = Utils.concatUrls(button.extensionBasePath, button.apiPath);

      // Prepare the request payload with media info and form data
      const payload = {
        media: Utils.concatUrls(media.media.directory.path, media.media.directory.name, media.media.name),
        data: formData
      };

      // Make the API call
      await this.networkService.postJson(apiPath, payload);

      // Show success notification
      this.notificationService.success($localize`Action completed successfully`);

    } catch (error) {
      // Show error notification
      this.notificationService.error($localize`Action failed:` + (error.message || error));
      console.error('Media button action failed:', error);
    }

    this.hideModal();

    // Handle post-action behaviors
    if (button.reloadContent) {
      await this.contentLoader.reloadCurrentContent();
    }

    if (button.reloadSite) {
      console.log('Reload site requested');
      window.location.reload();
    }

  }

  getValue(id: string): string | number | boolean | undefined {
    return this.savedModalValues[id];
  }

  setValue(id: string, value: string | number | boolean | undefined): void {
    this.savedModalValues[id] = value;
  }
}
