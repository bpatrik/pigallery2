// the locale package has no types. Its middleware sets req.locale (see ExtendedRequest.d.ts)
declare module 'locale' {
  import {RequestHandler} from 'express';

  function locale(supported: string[] | undefined, defaultLocale: string): RequestHandler;

  export = locale;
}
