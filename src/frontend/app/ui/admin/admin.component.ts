import {ConfigPriority} from '../../../../common/config/Enums';
import { Component, ElementRef, OnInit, inject, viewChildren, computed } from '@angular/core';
import {CountedNotificationDTO, NotificationService} from '../../model/notification.service';
import {NotificationType} from '../../../../common/entities/NotificationDTO';
import {ViewportScroller, DatePipe} from '@angular/common';
import {ConfigStyle, SettingsService} from '../settings/settings.service';
import {WebConfig} from '../../../../common/config/private/WebConfig';
import {ISettingsComponent} from '../settings/template/ISettingsComponent';
import {WebConfigClassBuilder} from 'typeconfig/web';
import {enumToTranslatedArray} from '../EnumTranslations';
import {PiTitleService} from '../../model/pi-title.service';
import { FrameComponent } from '../frame/frame.component';
import { PopoverDirective } from 'ngx-bootstrap/popover';
import { BsDropdownDirective, BsDropdownToggleDirective, BsDropdownMenuDirective } from 'ngx-bootstrap/dropdown';
import { NgIconComponent } from '@ng-icons/core';
import { TemplateComponent } from '../settings/template/template.component';
import { GalleryStatisticComponent } from '../settings/gallery-statistic/gallery-statistic.component';
import { UsersComponent } from '../settings/users/users.component';
import { SharingsListComponent } from '../settings/sharings-list/sharings-list.component';
import { ExtensionInstallerComponent } from '../settings/extension-installer/extension-installer.component';
import { StringifyEnum } from '../../pipes/StringifyEnum';

@Component({
    selector: 'app-admin',
    templateUrl: './admin.component.html',
    styleUrl: './admin.component.css',
    imports: [
    FrameComponent,
    PopoverDirective,
    BsDropdownDirective,
    BsDropdownToggleDirective,
    BsDropdownMenuDirective,
    NgIconComponent,
    TemplateComponent,
    GalleryStatisticComponent,
    UsersComponent,
    SharingsListComponent,
    ExtensionInstallerComponent,
    DatePipe,
    StringifyEnum
]
})
export class AdminComponent implements OnInit {
  viewportScroller = inject(ViewportScroller);
  notificationService = inject(NotificationService);
  settingsService = inject(SettingsService);
  private piTitleService = inject(PiTitleService);

  readonly settingsComponents = viewChildren<ISettingsComponent>('setting');
  readonly settingsComponentsElemRef = viewChildren('setting', { read: ElementRef });
  // the server notifications with their alert class and readable details
  readonly notificationRows = computed((): { notification: CountedNotificationDTO; css: string; details: string | null }[] =>
    this.notificationService.countedNotifications().map(notification => ({
      notification,
      css: this.getCss(notification.type),
      details: notification.details ? NotificationService.formatDetails(notification.details) : null
    })));
  readonly commitUrl = computed((): string =>
    'https://github.com/bpatrik/pigallery2/commit/' + this.settingsService.settings().Environment.buildCommitHash);
  configPriorities: { key: number; value: string; }[];
  configStyles: { key: number; value: string; }[];
  public readonly ConfigPriority = ConfigPriority;
  public readonly ConfigStyle = ConfigStyle;
  public readonly configPaths: string[] = [];
  private versionPopoverHideTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    this.configPriorities = enumToTranslatedArray(ConfigPriority);
    this.configStyles = enumToTranslatedArray(ConfigStyle);
    const wc = WebConfigClassBuilder.attachPrivateInterface(new WebConfig());
    this.configPaths = Object.keys(wc.State)
        .filter(s => !wc.__state[s].volatile);
  }

  ngOnInit(): void {
    // adminGuard lets only admins in
    this.piTitleService.setTitle($localize`Admin`);
  }

  // The version popover stays open while the mouse is over the link or the popover,
  // so its links (e.g. the git commit) can be clicked.
  showVersionPopover(pop: PopoverDirective): void {
    clearTimeout(this.versionPopoverHideTimer);
    if (!pop.isOpen()) {
      pop.show();
    }
  }

  hideVersionPopover(pop: PopoverDirective): void {
    clearTimeout(this.versionPopoverHideTimer);
    // the delay lets the mouse cross the gap between the link and the popover
    this.versionPopoverHideTimer = setTimeout(() => pop.hide(), 200);
  }

  private getCss(type: NotificationType): string {
    switch (type) {
      case NotificationType.error:
        return 'danger';
      case NotificationType.warning:
        return 'warning';
      case NotificationType.info:
        return 'info';
    }
    return 'info';
  }
}



