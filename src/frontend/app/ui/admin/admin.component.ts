import {AfterViewInit, Component, ElementRef, OnInit, QueryList, ViewChildren,} from '@angular/core';
import {AuthenticationService} from '../../model/network/authentication.service';
import {UserRoles} from '../../../../common/entities/UserDTO';
import {NotificationService} from '../../model/notification.service';
import {NotificationType} from '../../../../common/entities/NotificationDTO';
import {NavigationService} from '../../model/navigation.service';
import {ViewportScroller} from '@angular/common';
import {ConfigStyle, SettingsService} from '../settings/settings.service';
import {ConfigPriority} from '../../../../common/config/public/ClientConfig';
import {WebConfig} from '../../../../common/config/private/WebConfig';
import {ISettingsComponent} from '../settings/template/ISettingsComponent';
import {WebConfigClassBuilder} from 'typeconfig/src/decorators/builders/WebConfigClassBuilder';
import {enumToTranslatedArray} from '../EnumTranslations';
import {PiTitleService} from '../../model/pi-title.service';

@Component({
  selector: 'app-admin',
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.css'],
})
export class AdminComponent implements OnInit, AfterViewInit {
  @ViewChildren('setting') settingsComponents: QueryList<ISettingsComponent>;
  @ViewChildren('setting', {read: ElementRef})
  settingsComponentsElemRef: QueryList<ElementRef>;
  contents: ISettingsComponent[] = [];
  configPriorities: { key: number; value: string; }[];
  configStyles: { key: number; value: string; }[];
  public readonly ConfigPriority = ConfigPriority;
  public readonly ConfigStyle = ConfigStyle;
  public readonly configPaths: string[] = [];

  constructor(
    private authService: AuthenticationService,
    private navigation: NavigationService,
    public viewportScroller: ViewportScroller,
    public notificationService: NotificationService,
    public settingsService: SettingsService,
    private piTitleService: PiTitleService
  ) {
    this.configPriorities = enumToTranslatedArray(ConfigPriority);
    this.configStyles = enumToTranslatedArray(ConfigStyle);
    const wc = WebConfigClassBuilder.attachPrivateInterface(new WebConfig());
    this.configPaths = Object.keys(wc.State)
        .filter(s => !wc.__state[s].volatile);
  }

  ngAfterViewInit(): void {
    setTimeout(() => (this.contents = this.settingsComponents.toArray()), 0);
  }

  ngOnInit(): void {
    if (
      !this.authService.isAuthenticated() ||
      this.authService.user.value.role < UserRoles.Admin
    ) {
      this.navigation.toLogin();
      return;
    }
    this.piTitleService.setTitle($localize`Admin`);
  }

  public getCss(type: NotificationType): string {
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



