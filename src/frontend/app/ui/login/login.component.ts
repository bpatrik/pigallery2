import {Component, ElementRef, OnInit, inject, signal, viewChild} from '@angular/core';
import {LoginCredential} from '../../../../common/entities/LoginCredential';
import {AuthenticationService} from '../../model/network/authentication.service';
import {ErrorCodes, isErrorDTO} from '../../../../common/entities/Error';
import {Config} from '../../../../common/config/public/Config';
import {NavigationService} from '../../model/navigation.service';
import {LanguageComponent} from '../language/language.component';
import {IconComponent} from '../../icon.component';
import {FormsModule} from '@angular/forms';
import {NgIconComponent} from '@ng-icons/core';


@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
  imports: [
    LanguageComponent,
    IconComponent,
    FormsModule,
    NgIconComponent
]
})
export class LoginComponent implements OnInit {
  private authService = inject(AuthenticationService);
  private navigation = inject(NavigationService);

  loginCredential: LoginCredential;
  readonly loginError = signal(false);
  private readonly passwordInput = viewChild<ElementRef<HTMLInputElement>>('passwordInput');
  title: string;
  readonly inProgress = signal(false);
  oidcEnabled = false;
  oidcDisplayName = 'OpenID login';

  constructor() {
    this.loginCredential = new LoginCredential();
    this.title = Config.Server.applicationTitle;
    this.oidcEnabled = !!Config.Users.oidc?.enabled;
    this.oidcDisplayName = Config.Users.oidc?.displayName || 'OpenID login';
  }

  ngOnInit(): void {
    if (this.authService.isAuthenticated()) {
      this.navigation.toAfterLogin().catch(console.error);
    }
  }

  async onLogin(): Promise<void> {
    this.loginError.set(false);

    this.inProgress.set(true);
    try {
      await this.authService.login(this.loginCredential);
    } catch (error) {
      if (isErrorDTO(error) && error.code === ErrorCodes.CREDENTIAL_NOT_FOUND) {
        this.loginError.set(true);
        // a fresh start for the next try
        this.loginCredential.password = '';
        this.passwordInput()?.nativeElement.focus();
      }
    }

    this.inProgress.set(false);
  }

  onLoginWithOIDC(): void {
    if (!this.oidcEnabled) {
      return;
    }
    window.location.href = this.oidcLoginUrl;
  }

  get oidcLoginUrl(): string {
    return Config.Server.getApiUrl('/auth/oidc/login');
  }
}

