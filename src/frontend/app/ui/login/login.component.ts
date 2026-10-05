import {Component, OnInit} from '@angular/core';
import {LoginCredential} from '../../../../common/entities/LoginCredential';
import {AuthenticationService} from '../../model/network/authentication.service';
import {ErrorCodes} from '../../../../common/entities/Error';
import {Config} from '../../../../common/config/public/Config';
import {NavigationService} from '../../model/navigation.service';
import {LanguageComponent} from '../language/language.component';
import {IconComponent} from '../../icon.component';
import {FormsModule} from '@angular/forms';
import {NgIconComponent} from '@ng-icons/core';


@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'],
  imports: [
    LanguageComponent,
    IconComponent,
    FormsModule,
    NgIconComponent
]
})
export class LoginComponent implements OnInit {
  loginCredential: LoginCredential;
  loginError = false;
  title: string;
  inProgress = false;
  oidcEnabled = false;
  oidcDisplayName = 'OpenID login';

  constructor(
    private authService: AuthenticationService,
    private navigation: NavigationService
  ) {
    this.loginCredential = new LoginCredential();
    this.title = Config.Server.applicationTitle;
    this.oidcEnabled = !!Config.Users.oidc?.enabled;
    this.oidcDisplayName = Config.Users.oidc?.displayName || 'OpenID login';
  }

  ngOnInit(): void {
    if (this.authService.isAuthenticated()) {
      this.navigation.toDefault().catch(console.error);
    }
  }

  async onLogin(): Promise<void> {
    this.loginError = false;

    this.inProgress = true;
    try {
      await this.authService.login(this.loginCredential);
    } catch (error) {
      if (error && error.code === ErrorCodes.CREDENTIAL_NOT_FOUND) {
        this.loginError = true;
      }
    }

    this.inProgress = false;
  }

  onLoginWithOIDC(): void {
    if (!this.oidcEnabled) {
      return;
    }
    window.location.href = `${Config.Server.apiPath}/auth/oidc/login`;
  }
}

