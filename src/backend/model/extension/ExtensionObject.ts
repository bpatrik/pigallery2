import {IExtensionEvents, IExtensionObject} from './IExtension';
import {ExtensionApp} from './ExtensionApp';
import {ExtensionDB} from './ExtensionDB';
import {ProjectPath} from '../../ProjectPath';
import {ExpressRouterWrapper} from './ExpressRouterWrapper';
import {createLoggerWrapper} from '../../Logger';
import * as express from 'express';
import {ExtensionMessengerHandler} from './ExtensionMessengerHandler';
import {ExtensionConfig} from './ExtensionConfig';
import {UIExtension} from './UIExtension';
import {ExtensionEventsTracker} from './ExtensionEvent';

export class ExtensionObject<C> implements IExtensionObject<C> {

  public readonly _app;
  public readonly config;
  public readonly db;
  public readonly paths;
  public readonly Logger;
  public readonly events;
  public readonly RESTApi;
  public readonly messengers;
  public readonly ui;
  /** The REST API routes of this extension. They go away with this object on clean up. */
  public readonly router = express.Router();
  private readonly eventsTracker: ExtensionEventsTracker;

  /**
   * @param extensionId - Unique ID used internally to track this extension instance (may have _1, _2 suffix if name collision occurs)
   * @param extensionName - Display name of the extension (typically from package.json)
   * @param folder - Folder name where the extension is stored (also used as config key in Config.Extensions.extensions)
   * @param events - Extension events for hooking into gallery functionality
   */
  /** Removes the event handlers this extension added. */
  public removeEventHandlers(): void {
    this.eventsTracker.removeHandlers();
  }

  constructor(public readonly extensionId: string,
              public readonly extensionName: string,
              public readonly folder: string,
              events: IExtensionEvents) {
    const logger = createLoggerWrapper(`[Extension][${extensionId}]`);
    this._app = new ExtensionApp();
    this.config = new ExtensionConfig<C>(folder);
    this.db = new ExtensionDB(logger);
    this.paths = ProjectPath;
    this.Logger = logger;
    this.eventsTracker = new ExtensionEventsTracker(events);
    this.events = this.eventsTracker.events;
    this.RESTApi = new ExpressRouterWrapper(this.router, extensionId, logger);
    this.messengers = new ExtensionMessengerHandler(logger);
    this.ui = new UIExtension(this);
  }

}
