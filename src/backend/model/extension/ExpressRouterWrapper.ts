import * as express from 'express';
import {NextFunction, Request, Response} from 'express';
import {UserDTO, UserRoles} from '../../../common/entities/UserDTO';
import {AuthenticationMWs} from '../../middlewares/user/AuthenticationMWs';
import {RenderingMWs} from '../../middlewares/RenderingMWs';
import {ParamsDictionary} from 'express-serve-static-core';
import {IExtensionRESTApi, IExtensionRESTRoute} from './IExtension';
import {ILogger} from '../../Logger';
import {ExtensionManager} from './ExtensionManager';
import {Utils} from '../../../common/Utils';


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

  private getAuthMWs(minRole: UserRoles) {
    return minRole ? [AuthenticationMWs.authenticate,
      AuthenticationMWs.authorise(minRole)] : [];
  }

  public jsonResponse(paths: string[], minRole: UserRoles, cb: (params?: ParamsDictionary, body?: any, user?: UserDTO) => Promise<unknown> | unknown) {
    const fullPaths = paths.map(p => (Utils.concatUrls('/' + this.name + '/' + p)));
    this.router[this.func](fullPaths,
      ...(this.getAuthMWs(minRole).concat([
        async (req: Request, res: Response, next: NextFunction) => {
          req.resultPipe = await cb(req.params, req.body, req.session['user']);
          next();
        },
        RenderingMWs.renderResult
      ])));
    const p = ExtensionManager.EXTENSION_API_PATH + fullPaths;
    this.extLogger.silly(`Listening on ${this.func} ${p}`);
    return p;
  }

  public rawMiddleware(paths: string[], minRole: UserRoles, mw: (req: Request, res: Response, next: NextFunction) => void | Promise<void>) {
    const fullPaths = paths.map(p => (Utils.concatUrls('/' + this.name + '/' + p)));
    this.router[this.func](fullPaths,
      ...this.getAuthMWs(minRole),
      mw);
    const p = ExtensionManager.EXTENSION_API_PATH + fullPaths;
    this.extLogger.silly(`Listening on ${this.func} ${p}`);
    return p;
  }
}
