import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import {AuthenticationService} from './model/network/authentication.service';
import {Config} from '../../common/config/public/Config';
import {Title} from '@angular/platform-browser';
import {ShareService} from './ui/gallery/share.service';
import 'hammerjs';
import {Subscription} from 'rxjs';
import {NavigationService} from './model/navigation.service';
import {ThemeService} from './model/theme.service';
import { RouterOutlet } from '@angular/router';

@Component({
    selector: 'app-pi-gallery2',
    template: `
    <router-outlet />`,
    imports: [RouterOutlet]
})
export class AppComponent implements OnInit, OnDestroy {
  private authenticationService = inject(AuthenticationService);
  private shareService = inject(ShareService);
  private navigation = inject(NavigationService);
  private title = inject(Title);
  private themeService = inject(ThemeService);

  private subscription: Subscription = null;

  constructor() {
    const themeService = this.themeService;

    themeService.init();
  }

  async ngOnInit(): Promise<void> {
    this.title.setTitle(Config.Server.applicationTitle);
    await this.shareService.wait();
    this.subscription = this.authenticationService.user.subscribe(() => {
      if(this.navigation.isErrorPage()){ //stay on the error page, do not auto navigate
        return;
      }
      if (this.authenticationService.isAuthenticated()) {
        if (this.navigation.isLoginPage()) {
          return this.navigation.toDefault();
        }
      } else {
        if (!this.navigation.isLoginPage()) {
          return this.navigation.toLogin();
        }
      }
    });
  }

  ngOnDestroy(): void {
    if (this.subscription != null) {
      this.subscription.unsubscribe();
    }
  }

}
