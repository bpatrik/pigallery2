import { Injectable, OnDestroy, inject, signal } from '@angular/core';
import {ActivatedRoute, Params, Router} from '@angular/router';
import {Subscription} from 'rxjs';
import {Config} from '../../../../common/config/public/Config';
import {QueryParams} from '../../../../common/QueryParams';

@Injectable({
  providedIn: 'root'
})
export class GalleryService implements OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  public readonly autoPollIntervalS = signal(Config.Gallery.AutoUpdate.enable ? Config.Gallery.AutoUpdate.interval : 0);
  private subscription: Subscription;

  constructor() {


    this.subscription = this.route.queryParams.subscribe(
      (params: Params) => {
        const autoPollInterval = params[QueryParams.gallery.autoPollInterval];
        if (autoPollInterval !== undefined) {
          this.autoPollInterval = parseInt(autoPollInterval, 10) as number;
        }
      }
    );
  }

  get autoPollInterval(): number {
    return this.autoPollIntervalS();
  }

  set autoPollInterval(value: number) {
    if (this.autoPollIntervalS() != value) {
      this.autoPollIntervalS.set(value);
    }
    this.updateQuery(QueryParams.gallery.autoPollInterval, Config.Gallery.AutoUpdate.enable ? Config.Gallery.AutoUpdate.interval : 0, value);
  }


  ngOnDestroy() {
    this.subscription?.unsubscribe();
  }

  private updateQuery(key: string, defValue: boolean | number, newValue: boolean | number | null) {
    if (defValue === newValue) {
      newValue = null;
    }
    // Merge this param into the current URL
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        [key]: newValue
      },
      queryParamsHandling: 'merge', // keep existing params
      replaceUrl: true // optional: avoid pushing to the history stack
    }).catch(console.error);
  }
}
