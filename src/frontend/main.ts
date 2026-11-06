import {HttpClient, provideHttpClient, withInterceptors, withXhr} from '@angular/common/http';
import {errorInterceptor} from './app/model/network/helper/error.interceptor';
import {DefaultUrlSerializer, provideRouter, UrlSerializer, UrlTree, withNavigationErrorHandler, withPreloading} from '@angular/router';
import {provideBrowserGlobalErrorListeners} from '@angular/core';
import {bootstrapApplication} from '@angular/platform-browser';
import {routes} from './app/app.routing';
import {provideIcons} from '@ng-icons/core';
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
    // Uncaught errors and unhandled promise rejections go to Angular's ErrorHandler, like in a new Angular app
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withPreloading(PreloadMarkedRoutes), withNavigationErrorHandler(reloadOnChunkLoadError)),
    provideIcons(appIcons),
    provideMarkdown({loader: HttpClient}),
    {provide: UrlSerializer, useClass: CustomUrlSerializer},
    // withXhr(): the fetch backend (the default since Angular 22) does not emit upload progress events, which the uploader needs.
    provideHttpClient(withXhr(), withInterceptors([errorInterceptor]))
  ]
})
  .catch((err) => console.error(err));
