import {TestBed} from '@angular/core/testing';
import {ExtensionInstallerComponent} from './extension-installer.component';
import {ExtensionInstallerService} from './extension-installer.service';
import {NotificationService} from '../../../model/notification.service';
import {SettingsService} from '../settings.service';
import {ExtensionListItem} from '../../../../../common/entities/extension/ExtensionListItem';

// #1315: a failed extension install shows an error, the app keeps running and nothing is marked installed
describe('ExtensionInstallerComponent', () => {
  const setUp = (service: Partial<Record<keyof ExtensionInstallerService, unknown>>) => {
    const notification = {error: vi.fn(), success: vi.fn()};
    const settings = {getSettings: vi.fn().mockResolvedValue(undefined)};
    TestBed.configureTestingModule({
      imports: [ExtensionInstallerComponent],
      providers: [
        {provide: ExtensionInstallerService, useValue: service},
        {provide: NotificationService, useValue: notification},
        {provide: SettingsService, useValue: settings},
      ]
    });
    // only the logic is tested here
    TestBed.overrideComponent(ExtensionInstallerComponent, {set: {template: '', imports: []}});
    const component = TestBed.createComponent(ExtensionInstallerComponent).componentInstance;
    return {component, notification, settings};
  };
  const extension = (): ExtensionListItem => ({id: 'broken-ext', name: 'Broken extension', installed: false} as ExtensionListItem);

  it('should show an error and not mark the extension installed when the install fails', async () => {
    const {component, notification, settings} = setUp({installExtension: vi.fn().mockRejectedValue(new Error('npm install failed'))});
    const ext = extension();
    await component.installExtension(ext);
    expect(notification.error).toHaveBeenCalledWith('Failed to install extension "Broken extension"', 'npm install failed');
    expect(notification.success).not.toHaveBeenCalled();
    expect(ext.installed).toBe(false);
    expect(settings.getSettings).not.toHaveBeenCalled();
    expect(component.loading()).toBe(false);
  });

  it('should mark the extension installed and reload the settings after a successful install', async () => {
    const {component, notification, settings} = setUp({installExtension: vi.fn().mockResolvedValue(undefined)});
    const ext = extension();
    await component.installExtension(ext);
    expect(ext.installed).toBe(true);
    expect(settings.getSettings).toHaveBeenCalled();
    expect(notification.success).toHaveBeenCalled();
    expect(component.loading()).toBe(false);
  });

  it('should show an error when the extension list can not be loaded (e.g. no network)', async () => {
    const {component, notification} = setUp({getExtensions: vi.fn().mockRejectedValue(new Error('getaddrinfo ENOTFOUND'))});
    component.loadExtensions();
    await vi.waitFor(() => expect(component.loading()).toBe(false));
    expect(component.error()).toContain('getaddrinfo ENOTFOUND');
    expect(notification.error).toHaveBeenCalled();
  });
});
