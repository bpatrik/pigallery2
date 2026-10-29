import { Component, ViewChild, inject } from '@angular/core';
import {Config} from '../../../../common/config/public/Config';
import {CookieNames} from '../../../../common/CookieNames';
import {CookieService} from 'ngx-cookie-service';
import { BsDropdownDirective, BsDropdownToggleDirective, BsDropdownMenuDirective } from 'ngx-bootstrap/dropdown';

import { NgIconComponent } from '@ng-icons/core';

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
  private cookieService = inject(CookieService);

  languages: string[] = [];
  current: string = null;

  @ViewChild('dropdown', {static: true}) dropdown: BsDropdownDirective;

  constructor() {
    this.languages = Config.Server.languages.sort();
    if (this.cookieService.get(CookieNames.lang) != null) {
      this.current = this.cookieService.get(CookieNames.lang);
    }
  }

  getLanguageUrl(lang: string): string {
    return Config.Server.getAppUrl(lang);
  }
}

