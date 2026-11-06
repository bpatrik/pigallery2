import { Injectable, inject, signal } from '@angular/core';
import {Router} from '@angular/router';
import {Config} from '../../../common/config/public/Config';
import {GalleryCacheService} from '../ui/gallery/cache.gallery.service';

@Injectable({providedIn: 'root'})
export class VersionService {
  private router = inject(Router);

  public readonly version = signal<string | null>(null);
  public readonly appVersion = signal<string | null>(null);

  public onNewVersion(version: string): void {
    if (this.version() === version) {
      return;
    }
    this.version.set(version);
    GalleryCacheService.checkVersion(version);
  }

  public onNewAppVersion(version: string): void {
    if (this.appVersion() === version) {
      return;
    }
    if(!this.appVersion()) {
      this.appVersion.set(version);
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
