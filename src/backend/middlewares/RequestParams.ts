import {Request} from 'express';

export class RequestParams {
  /**
   * Reads a path param as a string.
   * Express 5 gives a wildcard param (`/*name`) as the array of its decoded segments.
   * They are joined back with '/', so `a%2Fb/c` reads as `a/b/c`, as in Express 4.
   */
  public static get(req: Request, name: string): string | undefined {
    const value = req.params[name];
    return Array.isArray(value) ? value.join('/') : value;
  }
}
