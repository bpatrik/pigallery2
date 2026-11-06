import { Component, computed, inject, viewChild } from '@angular/core';
import {Config} from '../../../../common/config/public/Config';
import {CookieNames} from '../../../../common/CookieNames';
import {CookieHelper} from '../../model/cookie.helper';
import { BsDropdownDirective, BsDropdownToggleDirective, BsDropdownMenuDirective } from 'ngx-bootstrap/dropdown';

import { NgIconComponent } from '@ng-icons/core';
import {NavigationService} from '../../model/navigation.service';

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
  private navigationService = inject(NavigationService);

  languages: string[] = [];
  current: string | null = null;

  readonly dropdown = viewChild<BsDropdownDirective>('dropdown');

  constructor() {
    this.languages = (Config.Server.languages ?? []).sort();
    if (CookieHelper.get(CookieNames.lang) != null) {
      this.current = CookieHelper.get(CookieNames.lang);
    }
  }

  // the server sets the language and redirects back to the current page
  readonly languageUrls = computed((): Record<string, string> => {
    const url = this.navigationService.url();
    const urls: Record<string, string> = {};
    for (const lang of this.languages) {
      urls[lang] = Config.Server.getAppUrl(lang, url);
    }
    return urls;
  });
}

