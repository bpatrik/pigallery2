import {Injectable} from '@angular/core';
import {BehaviorSubject} from 'rxjs';
import {Router} from '@angular/router';
import {Config} from '../../../common/config/public/Config';

@Injectable({providedIn: 'root'})
export class VersionService {
  public version: BehaviorSubject<string>;
  public appVersion: BehaviorSubject<string>;

  constructor(private router: Router) {
    this.version = new BehaviorSubject<string>(null);
    this.appVersion = new BehaviorSubject<string>(null);
  }

  public onNewVersion(version: string): void {
    if (this.version.value === version) {
      return;
    }
    this.version.next(version);
  }

  public onNewAppVersion(version: string): void {
    if (this.appVersion.value === version) {
      return;
    }
    if(!this.appVersion.value) {
      this.appVersion.next(version);
      return;
    }
    if(Config.Server.reloadClientOnServerUpdate)
    // do not reload on the settings page
    if(this.router.url.startsWith('/admin')) {
      return;
    }
    console.log('App version changed. Reloading site.');
    window.location.reload();
  }
}
