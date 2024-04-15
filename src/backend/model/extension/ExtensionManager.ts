import {ProjectPath} from '../../ProjectPath';
import {Config} from '../../../common/config/private/Config';
import * as fs from 'fs';
import * as path from 'path';
import {IObjectManager} from '../database/IObjectManager';
import {Logger} from '../../Logger';
import {IExtensionEvents, IExtensionObject} from './IExtension';
import {Server} from '../../server';
import {ExtensionEvent} from './ExtensionEvent';
import * as express from 'express';
import {SQLConnection} from '../database/SQLConnection';
import {ExtensionObject} from './ExtensionObject';
import {ExtensionDecoratorObject} from './ExtensionDecorator';
import * as util from 'util';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const exec = util.promisify(require('child_process').exec);

const LOG_TAG = '[ExtensionManager]';

export class ExtensionManager implements IObjectManager {

  public static EXTENSION_API_PATH = Config.Server.apiPath + '/extension';

  events: IExtensionEvents;
  extObjects: { [key: string]: ExtensionObject<unknown> } = {};
  router: express.Router;

  constructor() {
    this.initEvents();
  }

  public async init() {
    this.extObjects = {};
    this.initEvents();
    if (!Config.Extensions.enabled) {
      return;
    }
    this.router = express.Router();
    Server.instance?.app.use(ExtensionManager.EXTENSION_API_PATH, this.router);
    this.loadExtensionsList();
    await this.initExtensions();
  }

  private initEvents() {
    this.events = {
      gallery: {
        MetadataLoader: {
          loadPhotoMetadata: new ExtensionEvent(),
          loadVideoMetadata: new ExtensionEvent()
        },
        CoverManager: {
          getCoverForDirectory: new ExtensionEvent(),
          getCoverForAlbum: new ExtensionEvent(),
          invalidateDirectoryCovers: new ExtensionEvent(),
        },
        DiskManager: {
          excludeDir: new ExtensionEvent(),
          scanDirectory: new ExtensionEvent()
        },
        ImageRenderer: {
          render: new ExtensionEvent()
        }
      }
    };
    ExtensionDecoratorObject.init(this.events);
  }

  public loadExtensionsList() {
    Logger.debug(LOG_TAG, 'Loading extension list from ' + ProjectPath.ExtensionFolder);
    if (!fs.existsSync(ProjectPath.ExtensionFolder)) {
      return;
    }


    const extList = fs
      .readdirSync(ProjectPath.ExtensionFolder)
      .filter((f): boolean =>
        fs.statSync(path.join(ProjectPath.ExtensionFolder, f)).isDirectory()
      );
    extList.sort();


    Logger.debug(LOG_TAG, 'Extensions found: ', JSON.stringify(Config.Extensions.extensions.map(ec => ec.path)));
  }

  private createUniqueExtensionObject(name: string, folder: string): IExtensionObject<unknown> {
    let id = name;
    if (this.extObjects[id]) {
      let i = 0;
      while (this.extObjects[`${name}_${++i}`]) { /* empty */
      }
      id = `${name}_${++i}`;
    }
    if (!this.extObjects[id]) {
      this.extObjects[id] = new ExtensionObject(id, name, folder, this.router, this.events);
    }
    return this.extObjects[id];
  }

  private async initExtensions() {

    for (let i = 0; i < Config.Extensions.extensions.length; ++i) {
      const extFolder = Config.Extensions.extensions[i].path;
      let extName = extFolder;

      if (Config.Extensions.extensions[i].enabled === false) {
        Logger.silly(LOG_TAG, `Skipping ${extFolder} initiation. Extension is disabled.`);
      }
      const extPath = path.join(ProjectPath.ExtensionFolder, extFolder);
      const serverExtPath = path.join(extPath, 'server.js');
      const packageJsonPath = path.join(extPath, 'package.json');
      if (!fs.existsSync(serverExtPath)) {
        Logger.silly(LOG_TAG, `Skipping ${extFolder} server initiation. server.js does not exists`);
        continue;
      }

      if (fs.existsSync(packageJsonPath)) {
        if (fs.existsSync(path.join(extPath, 'node_modules'))) {
          Logger.debug(LOG_TAG, `node_modules folder exists. Skipping "npm install".`);
        } else {
          Logger.silly(LOG_TAG, `Running: "npm install --prefer-offline --no-audit --progress=false --omit=dev" in ${extPath}`);
          await exec('npm install  --no-audit --progress=false --omit=dev', {
            cwd: extPath
          });
        }
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const pkg = require(packageJsonPath);
        if (pkg.name) {
          extName = pkg.name;
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const ext = require(serverExtPath);
      if (typeof ext?.init === 'function') {
        Logger.debug(LOG_TAG, 'Running init on extension: ' + extFolder);
        await ext?.init(this.createUniqueExtensionObject(extName, extFolder));
      }
    }
    if (Config.Extensions.cleanUpUnusedTables) {
      // Clean up tables after all Extension was initialized.
      await SQLConnection.removeUnusedTables();
    }
  }

  private async cleanUpExtensions() {
    for (const extObj of Object.values(this.extObjects)) {
      const serverExt = path.join(extObj.folder, 'server.js');
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const ext = require(serverExt);
      if (typeof ext?.cleanUp === 'function') {
        Logger.debug(LOG_TAG, 'Running Init on extension:' + extObj.extensionName);
        await ext?.cleanUp(extObj);
      }
      extObj.messengers.cleanUp();
    }
  }


  public async cleanUp() {
    if (!Config.Extensions.enabled) {
      return;
    }
    this.initEvents(); // reset events
    await this.cleanUpExtensions();
    Server.instance?.app.use(ExtensionManager.EXTENSION_API_PATH, this.router);
    this.extObjects = {};
  }
}
