import * as express from 'express';
import {NextFunction, Request, Response} from 'express';
import {UserDTO, UserRoles} from '../../../common/entities/UserDTO';
import {AuthenticationMWs} from '../../middlewares/user/AuthenticationMWs';
import {RenderingMWs} from '../../middlewares/RenderingMWs';
import {ParamsDictionary} from 'express-serve-static-core';
import {ExtensionRoutePaths, IExtensionRESTApi, IExtensionRESTRoute, IMediaRequestBody} from './IExtension';
import {ILogger} from '../../Logger';
import {ExtensionManager} from './ExtensionManager';
import {Utils} from '../../../common/Utils';
import {GalleryMWs} from '../../middlewares/GalleryMWs';
import {RequestSession} from '../../middlewares/RequestSession';
import {MediaEntity} from '../database/enitites/MediaEntity';
import {SQLConnection} from '../database/SQLConnection';
import {Repository} from 'typeorm';
import {ObjectManagers} from '../ObjectManagers';


export class ExpressRouterWrapper implements IExtensionRESTApi {

  constructor(private readonly router: express.Router,
              private readonly name: string,
              private readonly extLogger: ILogger) {
  }

  get use() {
    return new ExpressRouteWrapper(this.router, this.name, 'use', this.extLogger);
  }

  get get() {
    return new ExpressRouteWrapper(this.router, this.name, 'get', this.extLogger);
  }

  get put() {
    return new ExpressRouteWrapper(this.router, this.name, 'put', this.extLogger);
  }

  get post() {
    return new ExpressRouteWrapper(this.router, this.name, 'post', this.extLogger);
  }

  get delete() {
    return new ExpressRouteWrapper(this.router, this.name, 'delete', this.extLogger);
  }

}

export class ExpressRouteWrapper implements IExtensionRESTRoute {

  constructor(private readonly router: express.Router,
              private readonly name: string,
              private readonly func: 'get' | 'use' | 'put' | 'post' | 'delete',
              private readonly extLogger: ILogger) {
  }

  public mediaJsonResponse<const P extends readonly string[]>(paths: ExtensionRoutePaths<P>, minRole: UserRoles, invalidateDirectory: boolean, cb: (params: ParamsDictionary, body: IMediaRequestBody, user: UserDTO, media: MediaEntity, repository: Repository<MediaEntity>) => unknown): string {
    return this.register(paths,
      ...(this.getAuthMWs(minRole).concat([
        (req: Request, res: Response, next: NextFunction) => {
          req.params['mediaPath'] = req.body?.media;
          next();
        },
        AuthenticationMWs.normalizePathParam('mediaPath'),
        AuthenticationMWs.authoriseMedia('mediaPath'),
        GalleryMWs.getMediaEntry,
        async (req: Request, res: Response, next: NextFunction) => {
          try {
            const media = req.resultPipe as MediaEntity;
            const connection = await SQLConnection.getConnection();
            await cb(req.params,
              req.body ?? {},
              RequestSession.getContext(req).user,
              media,
              connection.getRepository(MediaEntity));
            if (invalidateDirectory) {
              await ObjectManagers.getInstance().onDataChange(media.directory);
            }
            req.resultPipe = 'ok';
            next();
          } catch (e) {
            this.extLogger.error(e);
            next(new Error(`[${this.name}] Error during processing: '${paths.join(',')}'`));
          }
        },
        RenderingMWs.renderResult
      ])));
  }

  public jsonResponse<const P extends readonly string[]>(paths: ExtensionRoutePaths<P>, minRole: UserRoles, cb: (params?: ParamsDictionary, body?: unknown, user?: UserDTO) => unknown): string {
    return this.register(paths,
      ...(this.getAuthMWs(minRole).concat([
        async (req: Request, res: Response, next: NextFunction) => {
          try {
            req.resultPipe = await cb(req.params, req.body ?? {}, RequestSession.getContext(req).user);
            next();
          } catch {
            next(new Error(`[${this.name}]Error during processing:${paths.join(',')}`));
          }
        },
        RenderingMWs.renderResult
      ])));
  }

  public rawMiddleware<const P extends readonly string[]>(paths: ExtensionRoutePaths<P>, minRole: UserRoles, mw: (req: Request, res: Response, next: NextFunction) => void | Promise<void>): string {
    return this.register(paths,
      ...this.getAuthMWs(minRole),
      mw);
  }

  /**
   * Registers the route on the extension's router.
   * A route that can't be registered (usually an old extension with an Express 4 path) is logged and skipped:
   * the app keeps running, and nothing of the route is reachable (Express 5 throws before adding it to the router).
   */
  private register(paths: readonly string[], ...handlers: express.RequestHandler[]): string {
    const fullPaths = paths.map(p => (Utils.concatUrls('/' + this.name + '/' + p)));
    const p = ExtensionManager.EXTENSION_API_PATH + fullPaths.join(',');
    try {
      this.router[this.func](fullPaths, ...handlers);
    } catch (e) {
      // usually a path in the Express 4 syntax
      this.extLogger.error(`Skipping ${this.func} ${p}: the route could not be registered (${(e as Error).message}). ` +
        'Paths use the Express 5 syntax, see https://expressjs.com/en/guide/migrating-5.html#path-syntax');
      return p;
    }
    this.extLogger.silly(`Listening on ${this.func} ${p}`);
    return p;
  }

  private getAuthMWs(minRole: UserRoles) {
    return minRole ? [AuthenticationMWs.authenticate,
      AuthenticationMWs.authorise(minRole)] : [];
  }
}
