import {Injectable} from '@angular/core';
import {BehaviorSubject} from 'rxjs';
import {GridMedia} from '../../GridMedia';
import {IClientMediaButtonConfigWithBaseApiPath} from '../photo.grid.gallery.component';
import {NotificationService} from '../../../../../model/notification.service';
import {NetworkService} from '../../../../../model/network/network.service';
import {Utils} from '../../../../../../../common/Utils';
import {ContentLoaderService} from '../../../contentLoader.service';

export interface MediaButtonModalData {
  button: IClientMediaButtonConfigWithBaseApiPath;
  media: GridMedia;
  visible: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class MediaButtonModalService {
  private modalData$ = new BehaviorSubject<MediaButtonModalData | null>(null);
  private savedModalValues: Record<string, string | number | boolean> = {};

  constructor(
    private notificationService: NotificationService,
    private networkService: NetworkService,
    private contentLoader: ContentLoaderService
  ) {
  }

  get modalData() {
    return this.modalData$.asObservable();
  }

  showModal(button: IClientMediaButtonConfigWithBaseApiPath, media: GridMedia): void {
    this.modalData$.next({
      button,
      media,
      visible: true
    });
  }

  hideModal(): void {
    this.modalData$.next(null);
  }

  async executeButtonAction(button: IClientMediaButtonConfigWithBaseApiPath, media: GridMedia, formData?: {
    fields?: Record<string, any>,
    customFields?: Record<string, any>
  }): Promise<void> {
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

  getValue(id: string): string | number | boolean {
    return this.savedModalValues[id];
  }

  setValue(id: string, value: string | number | boolean): void {
    this.savedModalValues[id] = value;
  }
}
