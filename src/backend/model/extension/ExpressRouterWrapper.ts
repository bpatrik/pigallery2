import * as express from 'express';
import {NextFunction, Request, Response} from 'express';
import {UserDTO, UserRoles} from '../../../common/entities/UserDTO';
import {AuthenticationMWs} from '../../middlewares/user/AuthenticationMWs';
import {RenderingMWs} from '../../middlewares/RenderingMWs';
import {ParamsDictionary} from 'express-serve-static-core';
import {IExtensionRESTApi, IExtensionRESTRoute, IMediaRequestBody} from './IExtension';
import {ILogger} from '../../Logger';
import {ExtensionManager} from './ExtensionManager';
import {Utils} from '../../../common/Utils';
import {GalleryMWs} from '../../middlewares/GalleryMWs';
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

  public mediaJsonResponse(paths: string[], minRole: UserRoles, invalidateDirectory: boolean, cb: (params: ParamsDictionary, body: IMediaRequestBody, user: UserDTO, media: MediaEntity, repository: Repository<MediaEntity>) => Promise<unknown> | unknown): string {
    const fullPaths = paths.map(p => (Utils.concatUrls('/' + this.name + '/' + p)));
    this.router[this.func](fullPaths,
      ...(this.getAuthMWs(minRole).concat([
        async (req: Request, res: Response, next: NextFunction) => {
          req.params['mediaPath'] = req.body.media;
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
              req.body,
              req.session.context.user,
              media,
              connection.getRepository(MediaEntity));
            if (invalidateDirectory) {
              await ObjectManagers.getInstance().onDataChange(media.directory);
            }
            req.resultPipe = 'ok';
            next();
          } catch (e) {
            this.extLogger.error(e);
            next(new Error(`[${this.name}] Error during processing: '${paths}'`));
          }
        },
        RenderingMWs.renderResult
      ])));
    const p = ExtensionManager.EXTENSION_API_PATH + fullPaths;
    this.extLogger.silly(`Listening on ${this.func} ${p}`);
    return p;
  }

  public jsonResponse(paths: string[], minRole: UserRoles, cb: (params?: ParamsDictionary, body?: any, user?: UserDTO) => Promise<unknown> | unknown): string {
    const fullPaths = paths.map(p => (Utils.concatUrls('/' + this.name + '/' + p)));
    this.router[this.func](fullPaths,
      ...(this.getAuthMWs(minRole).concat([
        async (req: Request, res: Response, next: NextFunction) => {
          try {
            req.resultPipe = await cb(req.params, req.body, req.session.context.user);
            next();
          } catch (e) {
            next(new Error(`[${this.name}]Error during processing:${paths}`));
          }
        },
        RenderingMWs.renderResult
      ])));
    const p = ExtensionManager.EXTENSION_API_PATH + fullPaths;
    this.extLogger.silly(`Listening on ${this.func} ${p}`);
    return p;
  }

  public rawMiddleware(paths: string[], minRole: UserRoles, mw: (req: Request, res: Response, next: NextFunction) => void | Promise<void>): string {
    const fullPaths = paths.map(p => (Utils.concatUrls('/' + this.name + '/' + p)));
    this.router[this.func](fullPaths,
      ...this.getAuthMWs(minRole),
      mw);
    const p = ExtensionManager.EXTENSION_API_PATH + fullPaths;
    this.extLogger.silly(`Listening on ${this.func} ${p}`);
    return p;
  }

  private getAuthMWs(minRole: UserRoles) {
    return minRole ? [AuthenticationMWs.authenticate,
      AuthenticationMWs.authorise(minRole)] : [];
  }
}
