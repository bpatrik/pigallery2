import {Component, OnInit} from '@angular/core';
import {AuthenticationService} from '../../model/network/authentication.service';
import {ErrorCodes} from '../../../../common/entities/Error';
import {Config} from '../../../../common/config/public/Config';
import {NavigationService} from '../../model/navigation.service';
import {ShareService} from '../gallery/share.service';
import { LanguageComponent } from '../language/language.component';
import { IconComponent } from '../../icon.component';
import { AsyncPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgIconComponent } from '@ng-icons/core';

@Component({
    selector: 'app-share-login',
    templateUrl: './share-login.component.html',
    styleUrls: ['./share-login.component.css'],
    imports: [
    LanguageComponent,
    IconComponent,
    FormsModule,
    NgIconComponent,
    AsyncPipe
]
})
export class ShareLoginComponent implements OnInit {
  password: string;
  loginError = false;
  inProgress = false;
  title: string;

  constructor(
      public shareService: ShareService,
      private authService: AuthenticationService,
      private navigation: NavigationService
  ) {
    this.title = Config.Server.applicationTitle;
  }

  ngOnInit(): void {
    if (this.authService.isAuthenticated()) {
      this.navigation.toGallery();
    }
  }

  async onLogin(): Promise<void> {
    this.loginError = false;

    this.inProgress = true;
    try {
      await this.authService.shareLogin(this.password);
    } catch (error) {
      if (
          (error && error.code === ErrorCodes.CREDENTIAL_NOT_FOUND) ||
          error === 'Unauthorized'
      ) {
        this.loginError = true;
      }
    }

    this.inProgress = false;
  }
}

