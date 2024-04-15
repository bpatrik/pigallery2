import {IExtensionEvents, IExtensionObject} from './IExtension';
import {ExtensionApp} from './ExtensionApp';
import {ExtensionDB} from './ExtensionDB';
import {ProjectPath} from '../../ProjectPath';
import {ExpressRouterWrapper} from './ExpressRouterWrapper';
import {createLoggerWrapper} from '../../Logger';
import * as express from 'express';
import {ExtensionMessengerHandler} from './ExtensionMessengerHandler';
import {ExtensionConfig} from './ExtensionConfig';

export class ExtensionObject<C> implements IExtensionObject<C> {

  public readonly _app;
  public readonly config;
  public readonly db;
  public readonly paths;
  public readonly Logger;
  public readonly events;
  public readonly RESTApi;
  public readonly messengers;

  constructor(public readonly extensionId: string,
              public readonly extensionName: string,
              public readonly folder: string,
              extensionRouter: express.Router,
              events: IExtensionEvents) {
    const logger = createLoggerWrapper(`[Extension][${extensionId}]`);
    this._app = new ExtensionApp();
    this.config = new ExtensionConfig<C>(folder);
    this.db = new ExtensionDB(logger);
    this.paths = ProjectPath;
    this.Logger = logger;
    this.events = events;
    this.RESTApi = new ExpressRouterWrapper(extensionRouter, extensionId, logger);
    this.messengers = new ExtensionMessengerHandler(logger);
  }

}
