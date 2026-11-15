import {HttpClient, provideHttpClient, withInterceptors, withXhr} from '@angular/common/http';
import {errorInterceptor} from './app/model/network/helper/error.interceptor';
import {DefaultUrlSerializer, provideRouter, UrlSerializer, UrlTree, withNavigationErrorHandler, withPreloading} from '@angular/router';
import {inject, provideAppInitializer, provideBrowserGlobalErrorListeners} from '@angular/core';
import {bootstrapApplication} from '@angular/platform-browser';
import {routes} from './app/app.routing';
import {provideIcons} from '@ng-icons/core';
import {provideMarkdown} from 'ngx-markdown';
import {AppComponent} from './app/app.component';
import {appIcons} from './app/icons';
import {PreloadMarkedRoutes, reloadOnChunkLoadError} from './app/model/lazy-loading';
import {ScrollRestorationService} from './app/model/scroll-restoration.service';

// Set by `ng build --define` in gulpfile.ts; missing in dev builds (npm run run-dev)
declare const PIGALLERY2_VERSION: string;
declare const PIGALLERY2_BUILD_TIME: string;
declare const PIGALLERY2_COMMIT: string;

// tells in the browser console which build of the client the page runs (e.g. to spot a stale bundle)
if (typeof PIGALLERY2_BUILD_TIME !== 'undefined') {
  console.info(`PiGallery2 client v${PIGALLERY2_VERSION}, built ${PIGALLERY2_BUILD_TIME}, commit ${PIGALLERY2_COMMIT || 'unknown'}`);
} else {
  console.info('PiGallery2 client: dev build');
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

bootstrapApplication(AppComponent, {
  providers: [
    // Uncaught errors and unhandled promise rejections go to Angular's ErrorHandler, like in a new Angular app
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withPreloading(PreloadMarkedRoutes), withNavigationErrorHandler(reloadOnChunkLoadError)),
    // before the first navigation: it remembers the scroll position of every history entry
    provideAppInitializer(() => {
      inject(ScrollRestorationService);
    }),
    provideIcons(appIcons),
    provideMarkdown({loader: HttpClient}),
    {provide: UrlSerializer, useClass: CustomUrlSerializer},
    // withXhr(): the fetch backend (the default since Angular 22) does not emit upload progress events, which the uploader needs.
    provideHttpClient(withXhr(), withInterceptors([errorInterceptor]))
  ]
})
  .catch((err) => console.error(err));
