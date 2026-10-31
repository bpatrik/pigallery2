import { Component, inject, viewChild } from '@angular/core';
import {Config} from '../../../../common/config/public/Config';
import {CookieNames} from '../../../../common/CookieNames';
import {CookieHelper} from '../../model/cookie.helper';
import { BsDropdownDirective, BsDropdownToggleDirective, BsDropdownMenuDirective } from 'ngx-bootstrap/dropdown';

import { NgIconComponent } from '@ng-icons/core';
import {Router} from '@angular/router';

@Component({
    selector: 'app-language',
    templateUrl: './language.component.html',
    styleUrl: './language.component.css',
    imports: [
    BsDropdownDirective,
    BsDropdownToggleDirective,
    NgIconComponent,
    BsDropdownMenuDirective
]
})
export class LanguageComponent {
  private router = inject(Router);

  languages: string[] = [];
  current: string = null;

  readonly dropdown = viewChild<BsDropdownDirective>('dropdown');

  constructor() {
    this.languages = Config.Server.languages.sort();
    if (CookieHelper.get(CookieNames.lang) != null) {
      this.current = CookieHelper.get(CookieNames.lang);
    }
  }

  // the server sets the language and redirects back to the current page
  getLanguageUrl(lang: string): string {
    return Config.Server.getAppUrl(lang, this.router.url);
  }
}

