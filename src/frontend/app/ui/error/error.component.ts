import {Component} from '@angular/core';
import {Config} from '../../../../common/config/public/Config';
import {IconComponent} from '../../icon.component';
import {NgIf} from '@angular/common';
import {Router} from '@angular/router';

@Component({
  selector: 'app-error',
  templateUrl: './error.component.html',
  styleUrls: ['./error.component.css'],
  imports: [
    NgIf,
    IconComponent
  ]
})
export class ErrorComponent {
  title: string;
  showHelp = false;

  constructor(private router: Router) {
    this.title = Config.Server.applicationTitle;
  }

  onGoBack(): void {
    this.router.navigate(['/']).catch(console.error);
  }

  toggleHelp(): void {
    this.showHelp = !this.showHelp;
  }
}
