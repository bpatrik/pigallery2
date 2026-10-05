import {Component} from '@angular/core';
import {Config} from '../../../../common/config/public/Config';
import {IconComponent} from '../../icon.component';

import {Router} from '@angular/router';
import {NavigationService} from '../../model/navigation.service';

@Component({
  selector: 'app-error',
  templateUrl: './error.component.html',
  styleUrls: ['./error.component.css'],
  imports: [
    IconComponent
]
})
export class ErrorComponent {
  title: string;
  showHelp = false;

  constructor(private navigationService: NavigationService) {
    this.title = Config.Server.applicationTitle;
  }

  onGoBack(): void {
    this.navigationService.toDefault();
  }

  toggleHelp(): void {
    this.showHelp = !this.showHelp;
  }
}
