import {importProvidersFrom, Injectable, provideZoneChangeDetection} from '@angular/core';
import {HTTP_INTERCEPTORS, HttpClient, provideHttpClient, withInterceptorsFromDi} from '@angular/common/http';
import {ErrorInterceptor} from './app/model/network/helper/error.interceptor';
import {DefaultUrlSerializer, UrlSerializer, UrlTree} from '@angular/router';
import {bootstrapApplication, HAMMER_GESTURE_CONFIG, HammerGestureConfig, HammerModule} from '@angular/platform-browser';
import {provideAnimations} from '@angular/platform-browser/animations';
import {AppRoutingModule} from './app/app.routing';
import {provideIcons} from '@ng-icons/core';
import {provideToastr} from 'ngx-toastr';
import {provideMarkdown} from 'ngx-markdown';
import {AppComponent} from './app/app.component';
import {Marker} from 'leaflet';
import {MarkerFactory} from './app/ui/gallery/map/MarkerFactory';
import {appIcons} from './app/icons';

@Injectable()
export class MyHammerConfig extends HammerGestureConfig {
  events: string[] = ['pinch'];
  overrides = {
    pan: {threshold: 1},
    swipe: {direction: 31}, // enable swipe up
    pinch: {enable: true},
  };
}


export class CustomUrlSerializer implements UrlSerializer {
  private defaultUrlSerializer: DefaultUrlSerializer =
    new DefaultUrlSerializer();

  parse(url: string): UrlTree {
    // Encode parentheses
    url = url.replace(/\(/g, '%28').replace(/\)/g, '%29');
    // Use the default serializer.
    return this.defaultUrlSerializer.parse(url);
  }

  serialize(tree: UrlTree): string {
    return this.defaultUrlSerializer
      .serialize(tree)
      .replace(/%28/g, '(')
      .replace(/%29/g, ')');
  }
}

Marker.prototype.options.icon = MarkerFactory.defIcon;

bootstrapApplication(AppComponent, {
  providers: [
    provideZoneChangeDetection(),
    importProvidersFrom(HammerModule, AppRoutingModule),
    provideIcons(appIcons),
    provideToastr(),
    provideMarkdown({loader: HttpClient}),
    {provide: HTTP_INTERCEPTORS, useClass: ErrorInterceptor, multi: true},
    {provide: UrlSerializer, useClass: CustomUrlSerializer},
    {provide: HAMMER_GESTURE_CONFIG, useClass: MyHammerConfig},
    provideHttpClient(withInterceptorsFromDi()),
    provideAnimations()
  ]
})
  .catch((err) => console.error(err));
