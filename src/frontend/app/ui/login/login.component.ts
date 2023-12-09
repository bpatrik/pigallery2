import {Component, OnInit} from '@angular/core';
import {LoginCredential} from '../../../../common/entities/LoginCredential';
import {AuthenticationService} from '../../model/network/authentication.service';
import {ErrorCodes} from '../../../../common/entities/Error';
import {Config} from '../../../../common/config/public/Config';
import {NavigationService} from '../../model/navigation.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'],
})
export class LoginComponent implements OnInit {
  loginCredential: LoginCredential;
  loginError = false;
  title: string;
  inProgress = false;

  constructor(
      private authService: AuthenticationService,
      private navigation: NavigationService
  ) {
    this.loginCredential = new LoginCredential();
    this.title = Config.Server.applicationTitle;
  }

  ngOnInit(): void {
    if (this.authService.isAuthenticated()) {
      this.navigation.toDefault();
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
}

