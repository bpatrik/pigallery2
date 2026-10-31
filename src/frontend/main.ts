import {provideZoneChangeDetection} from '@angular/core';
import {HttpClient, provideHttpClient, withInterceptors} from '@angular/common/http';
import {errorInterceptor} from './app/model/network/helper/error.interceptor';
import {DefaultUrlSerializer, provideRouter, UrlSerializer, UrlTree, withNavigationErrorHandler, withPreloading} from '@angular/router';
import {bootstrapApplication} from '@angular/platform-browser';
import {provideAnimations} from '@angular/platform-browser/animations';
import {routes} from './app/app.routing';
import {provideIcons} from '@ng-icons/core';
import {provideToastr} from 'ngx-toastr';
import {provideMarkdown} from 'ngx-markdown';
import {AppComponent} from './app/app.component';
import {appIcons} from './app/icons';
import {PreloadMarkedRoutes, reloadOnChunkLoadError} from './app/model/lazy-loading';

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

bootstrapApplication(AppComponent, {
  providers: [
    provideZoneChangeDetection(),
    provideRouter(routes, withPreloading(PreloadMarkedRoutes), withNavigationErrorHandler(reloadOnChunkLoadError)),
    provideIcons(appIcons),
    provideToastr(),
    provideMarkdown({loader: HttpClient}),
    {provide: UrlSerializer, useClass: CustomUrlSerializer},
    // No withFetch(): the fetch backend does not emit upload progress events, which the uploader needs.
    provideHttpClient(withInterceptors([errorInterceptor])),
    provideAnimations()
  ]
})
  .catch((err) => console.error(err));
