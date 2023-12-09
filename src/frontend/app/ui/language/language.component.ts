import {Component, ViewChild} from '@angular/core';
import {Config} from '../../../../common/config/public/Config';
import {CookieNames} from '../../../../common/CookieNames';
import {CookieService} from 'ngx-cookie-service';
import {BsDropdownDirective} from 'ngx-bootstrap/dropdown';

@Component({
  selector: 'app-language',
  templateUrl: './language.component.html',
  styleUrls: ['./language.component.css'],
})
export class LanguageComponent {
  languages: string[] = [];
  current: string = null;
  urlBase = Config.Server.urlBase;

  @ViewChild('dropdown', {static: true}) dropdown: BsDropdownDirective;

  constructor(private cookieService: CookieService) {
    this.languages = Config.Server.languages.sort();
    if (this.cookieService.get(CookieNames.lang) != null) {
      this.current = this.cookieService.get(CookieNames.lang);
    }
  }
}

