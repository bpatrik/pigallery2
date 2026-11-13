import {Component, ElementRef, OnInit, inject, signal, viewChild} from '@angular/core';
import {AuthenticationService} from '../../model/network/authentication.service';
import {ErrorCodes, isErrorDTO} from '../../../../common/entities/Error';
import {Config} from '../../../../common/config/public/Config';
import {NavigationService} from '../../model/navigation.service';
import {ShareService} from '../gallery/share.service';
import { LanguageComponent } from '../language/language.component';
import { IconComponent } from '../../icon.component';
import { FormsModule } from '@angular/forms';
import { NgIconComponent } from '@ng-icons/core';

@Component({
    selector: 'app-share-login',
    templateUrl: './share-login.component.html',
    styleUrl: './share-login.component.css',
    imports: [
    LanguageComponent,
    IconComponent,
    FormsModule,
    NgIconComponent
]
})
export class ShareLoginComponent implements OnInit {
  shareService = inject(ShareService);
  private authService = inject(AuthenticationService);
  private navigation = inject(NavigationService);

  password = '';
  readonly loginError = signal(false);
  private readonly passwordInput = viewChild<ElementRef<HTMLInputElement>>('passwordInput');
  readonly inProgress = signal(false);
  title: string;

  constructor() {
    this.title = Config.Server.applicationTitle;
  }

  ngOnInit(): void {
    if (this.authService.isAuthenticated()) {
      this.navigation.toGallery();
    }
  }

  async onLogin(): Promise<void> {
    this.loginError.set(false);

    this.inProgress.set(true);
    try {
      await this.authService.shareLogin(this.password);
    } catch (error) {
      if (
          (isErrorDTO(error) && error.code === ErrorCodes.CREDENTIAL_NOT_FOUND) ||
          error === 'Unauthorized'
      ) {
        this.loginError.set(true);
        // a fresh start for the next try
        this.password = '';
        this.passwordInput()?.nativeElement.focus();
      }
    }

    this.inProgress.set(false);
  }
}

