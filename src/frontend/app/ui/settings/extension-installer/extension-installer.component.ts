import { Component, inject, viewChild, signal } from '@angular/core';
import { ExtensionInstallerService } from './extension-installer.service';
import { ExtensionListItem } from '../../../../../common/entities/extension/ExtensionListItem';
import { NotificationService } from '../../../model/notification.service';
import { ModalDirective } from 'ngx-bootstrap/modal';
import {SettingsService} from '../settings.service';
import { NgIconComponent } from '@ng-icons/core';


@Component({
    selector: 'app-extension-installer',
    templateUrl: './extension-installer.component.html',
    styleUrl: './extension-installer.component.css',
    imports: [NgIconComponent, ModalDirective]
})
export class ExtensionInstallerComponent {
  settingsService = inject(SettingsService);
  private extensionService = inject(ExtensionInstallerService);
  private notificationService = inject(NotificationService);

  public readonly extensionsModal = viewChild<ModalDirective>('extensionsModal');

  public readonly extensions = signal<ExtensionListItem[]>([]);
  public readonly loading = signal(false);
  public readonly error = signal<string | null>(null);

  public openExtensionsModal(): void {
    this.extensionsModal()?.show();
    this.loadExtensions();
  }

  public loadExtensions(): void {
    this.loading.set(true);
    this.error.set(null);

    this.extensionService.getExtensions()
      .then(extensions => {
        this.extensions.set(extensions);
        this.loading.set(false);
      })
      .catch(err => {
        this.error.set('Failed to load extensions: ' + (err.message || err));
        this.loading.set(false);
        this.notificationService.error('Failed to load extensions', err);
      });
  }

  public async installExtension(extension: ExtensionListItem): Promise<void> {
    if (extension.installed) {
      return;
    }

    this.loading.set(true);
    try {
      await this.extensionService.installExtension(extension.id);
      extension.installed = true;
      await this.settingsService.getSettings();
      this.notificationService.success(`Extension "${extension.name}" installed successfully`);
    }catch(err) {
      this.notificationService.error(`Failed to install extension "${extension.name}"`, err);
    }finally {

      this.loading.set(false);
    }
  }
}
