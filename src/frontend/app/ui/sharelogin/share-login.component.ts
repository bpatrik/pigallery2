import {Component, OnDestroy, OnInit} from '@angular/core';
import {AuthenticationService} from '../../model/network/authentication.service';
import {ErrorCodes} from '../../../../common/entities/Error';
import {Config} from '../../../../common/config/public/Config';
import {NavigationService} from '../../model/navigation.service';
import {ShareService} from '../gallery/share.service';
import {LanguageComponent} from '../language/language.component';
import {IconComponent} from '../../icon.component';
import {AsyncPipe, NgIf} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {NgIconComponent} from '@ng-icons/core';
import {Subscription} from 'rxjs';

@Component({
  selector: 'app-share-login',
  templateUrl: './share-login.component.html',
  styleUrls: ['./share-login.component.css'],
  imports: [
    LanguageComponent,
    IconComponent,
    NgIf,
    FormsModule,
    NgIconComponent,
    AsyncPipe,
  ]
})
export class ShareLoginComponent implements OnInit, OnDestroy {
  password: string;
  loginError = '';
  inProgress = false;
  title: string;
  private sub: Subscription;

  constructor(
    public shareService: ShareService,
    public authService: AuthenticationService,
    private navigation: NavigationService
  ) {
    this.title = Config.Server.applicationTitle;
  }

  ngOnInit(): void {
    if (this.authService.isAuthenticated()) {
      this.navigation.toGallery().catch(console.error);
    }
    this.sub = this.authService.user.subscribe(u => {
      if (!u.user && u.nullInfo) {
        if (u.nullInfo.code === ErrorCodes.NOT_AUTHORISED) {
          this.loginError = $localize`Not Authorised. Please enter gallery again.`;
          return;
        }
        this.loginError = $localize`Unknown error. Please enter gallery again.`;
      }
    });
  }

  ngOnDestroy(): void {
    if (this.sub) {
      this.sub.unsubscribe();
    }
  }

  async onLogin(): Promise<void> {
    this.loginError = '';

    this.inProgress = true;
    try {
      await this.authService.shareLogin(this.password);
    } catch (error) {
      if (
        (error && error.code === ErrorCodes.CREDENTIAL_NOT_FOUND) ||
        error === 'Unauthorized'
      ) {
        this.loginError = $localize`Wrong password`;
      }
    }

    this.inProgress = false;
  }
}

