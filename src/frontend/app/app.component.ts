import { Component, OnInit, effect, inject, untracked } from '@angular/core';
import {AuthenticationService} from './model/network/authentication.service';
import {Config} from '../../common/config/public/Config';
import {Title} from '@angular/platform-browser';
import {ShareService} from './ui/gallery/share.service';
import {NavigationService} from './model/navigation.service';
import {ThemeService} from './model/theme.service';
import { RouterOutlet } from '@angular/router';
import {ToastContainerComponent} from './ui/toast/toast-container.component';

@Component({
    selector: 'app-pi-gallery2',
    template: `
    <router-outlet />
    <app-toast-container />`,
    imports: [RouterOutlet, ToastContainerComponent]
})
export class AppComponent implements OnInit {
  private authenticationService = inject(AuthenticationService);
  private shareService = inject(ShareService);
  private navigation = inject(NavigationService);
  private title = inject(Title);
  // ThemeService applies the theme when it is created
  private themeService = inject(ThemeService);

  constructor() {
    // redirects between the login page and the gallery when the user logs in or out
    effect(() => {
      if (!this.shareService.ready()) {
        return;
      }
      const authenticated = this.authenticationService.isAuthenticated();
      untracked(() => this.redirect(authenticated)?.catch(console.error));
    });
  }

  ngOnInit(): void {
    this.title.setTitle(Config.Server.applicationTitle);
  }

  private redirect(authenticated: boolean): Promise<boolean> | undefined {
    if (this.navigation.isErrorPage()) { //stay on the error page, do not auto navigate
      return;
    }
    if (authenticated) {
      if (this.navigation.isLoginPage()) {
        return this.navigation.toAfterLogin();
      }
    } else {
      // before the first page, the auth guard sends the user to the login page (with the url they opened)
      if (!this.navigation.isLoginPage() && this.navigation.hasNavigated()) {
        // the session ended (e.g. the user was deleted): the login takes the user back to this page; not after logging out
        return this.navigation.toLogin(this.authenticationService.loggedOutByUser ? undefined : this.navigation.url());
      }
    }
    return undefined;
  }

}
