import * as express from 'express';
import {NextFunction, Request, Response} from 'express';
import {PrivateConfigClass} from '../../../common/config/private/PrivateConfigClass';
import {ObjectManagers} from '../ObjectManagers';
import {ProjectPathClass} from '../../ProjectPath';
import {ILogger} from '../../Logger';
import {UserDTO, UserRoles} from '../../../common/entities/UserDTO';
import {ParamsDictionary} from 'express-serve-static-core';
import {Connection} from 'typeorm';
import {DynamicConfig} from '../../../common/entities/DynamicConfig';
import {MediaDTOWithThPath} from '../messenger/Messenger';
import {PhotoMetadata} from '../../../common/entities/PhotoDTO';
import {VideoMetadata} from '../../../common/entities/VideoDTO';
import {MediaRendererInput, SvgRendererInput} from '../fileaccess/PhotoWorker';
import {SearchQueryDTO} from '../../../common/entities/SearchQueryDTO';
import {CoverPhotoDTOWithID} from '../database/CoverManager';
import {ParentDirectoryDTO} from '../../../common/entities/DirectoryDTO';
import {DirectoryScanSettings} from '../fileaccess/DiskManager';


export type IExtensionBeforeEventHandler<I extends unknown[], O> = (input: I, event: { stopPropagation: boolean }) => Promise<I | O>;
/**
 * input: is the original input: this is output of all before handler. This value was also piped to app's function
 * output: is the output of the app's function or the previous after handler
 */
export type IExtensionAfterEventHandler<I extends unknown[], O> = (data: { input: I, output: O }) => Promise<O>;


export interface IExtensionEvent<I extends unknown[], O> {
  before: (handler: IExtensionBeforeEventHandler<I, O>) => void;
  after: (handler: IExtensionAfterEventHandler<I, O>) => void;
}

/**
 * All main event callbacks in the app
 */
export interface IExtensionEvents {
  gallery: {
    /**
     * Events for Directory and Album covers
     */
    CoverManager: {
      getCoverForAlbum: IExtensionEvent<[{
        searchQuery: SearchQueryDTO;
      }], CoverPhotoDTOWithID>;
      getCoverForDirectory: IExtensionEvent<[{
        id: number;
        name: string;
        path: string;
      }], CoverPhotoDTOWithID>
      /**
       * Invalidates directory covers for a given directory and every parent
       */
      invalidateDirectoryCovers: IExtensionEvent<[ParentDirectoryDTO], void>;
    },
    ImageRenderer: {
      /**
       * Renders a thumbnail or photo
       */
      render: IExtensionEvent<[MediaRendererInput | SvgRendererInput], void>
    },
    /**
     * Reads exif, iptc, etc.. metadata for photos/videos
     */
    MetadataLoader: {
      // input: file path
      loadVideoMetadata: IExtensionEvent<[string], VideoMetadata>,
      // input: file path
      loadPhotoMetadata: IExtensionEvent<[string], PhotoMetadata>
    },
    /**
     * Scans the storage for a given directory and returns the list of child directories,
     * photos, videos and metafiles
     */
    DiskManager: {
      excludeDir: IExtensionEvent<[{
        name: string,
        parentDirRelativeName: string,
        parentDirAbsoluteName: string
      }], boolean>,
      scanDirectory: IExtensionEvent<[
        string,
        DirectoryScanSettings], ParentDirectoryDTO>
    }
  };
}

export interface IExtensionApp {
  expressApp: express.Express;
  objectManagers: ObjectManagers;
  config: PrivateConfigClass;
}

export interface IExtensionRESTRoute {
  /**
   * Sends a pigallery2 standard JSON object with payload or error message back to the client.
   * @param paths RESTapi path, relative to the extension base endpoint
   * @param minRole set to null to omit auer check (ie make the endpoint public)
   * @param cb function callback
   * @return newly added REST api path
   */
  jsonResponse(paths: string[], minRole: UserRoles, cb: (params?: ParamsDictionary, body?: any, user?: UserDTO) => Promise<unknown> | unknown): string;

  /**
   * Exposes a standard expressjs middleware
   * @param paths RESTapi path, relative to the extension base endpoint
   * @param minRole set to null to omit auer check (ie make the endpoint public)
   * @param mw expressjs middleware
   * @return newly added REST api path
   */
  rawMiddleware(paths: string[], minRole: UserRoles, mw: (req: Request, res: Response, next: NextFunction) => void | Promise<void>): string;
}

export interface IExtensionRESTApi {
  use: IExtensionRESTRoute;
  get: IExtensionRESTRoute;
  post: IExtensionRESTRoute;
  put: IExtensionRESTRoute;
  delete: IExtensionRESTRoute;
}

export interface IExtensionDB {
  /**
   * Returns with a typeorm SQL connection
   */
  getSQLConnection(): Promise<Connection>;

  /**
   * Adds SQL tables to typeorm
   * @param tables
   */
  // eslint-disable-next-line @typescript-eslint/ban-types
  setExtensionTables(tables: Function[]): Promise<void>;

  /**
   * Exposes all tables. You can use this if you van to have a foreign key to a built-in table.
   * Use with caution. This exposes the app's internal working.
   */
  // eslint-disable-next-line @typescript-eslint/ban-types
  _getAllTables(): Function[];
}

export interface IExtensionConfig<C> {
  getConfig(): C;
}

export interface IExtensionMessengers {
  /**
   * Adds a new messenger that the user can select e.g.: for sending top pick photos
   * @param name Name of the messenger (also used as id)
   * @param config config metadata for this messenger
   * @param callbacks messenger logic
   */
  addMessenger<C extends Record<string, unknown> = Record<string, unknown>>(name: string, config: DynamicConfig[], callbacks: {
    sendMedia: (config: C, media: MediaDTOWithThPath[]) => Promise<void>
  }): void;
}

export interface IExtensionObject<C = void> {
  /**
   * ID of the extension that is internally used. By default, the name and ID matches if there is no collision.
   */
  extensionId: string,

  /**
   * Name of the extension
   */
  extensionName: string,

  /**
   * Inner functionality of the app. Use this with caution.
   * If you want to go deeper than the standard exposed APIs, you can try doing so here.
   */
  _app: IExtensionApp;

  /**
   * Create extension related configuration
   */
  config: IExtensionConfig<C>;

  /**
   * Create new SQL tables and access SQL connection
   */
  db: IExtensionDB;

  /**
   * Paths to the main components of the app.
   */
  paths: ProjectPathClass;
  /**
   * Logger of the app
   */
  Logger: ILogger;
  /**
   * Main app events. Use this change indexing, cover or serving gallery
   */
  events: IExtensionEvents;
  /**
   * Use this to define REST calls related to the extension
   */
  RESTApi: IExtensionRESTApi;

  /**
   * Object to manipulate messengers.
   * Messengers are used to send messages (like emails) from the app.
   * One type of message is a list of selected photos.
   */
  messengers: IExtensionMessengers;
}

export interface IExtensionConfigInit<C> {
  /**
   * Sets the config tempalte class
   * @param template
   */
  setConfigTemplate(template: new() => C): void;
}

/**
 * Extension interface. All extension is expected to implement and export these methods.
 * This is the content of the server.js file
 */
export interface IServerExtension<C> {

  /**
   * Extension init function. Extension should at minimum expose this function.
   * @param extension
   */
  init(extension: IExtensionObject<C>): Promise<void>;

  cleanUp?: (extension: IExtensionObject<C>) => Promise<void>;
}


/**
 * Extension config interface. All extension can implement and export these methods.
 * This is the content of the config.js file.
 */
export interface IServerExtensionConfig<C> {

  /**
   * This function can be called any time. It should only set the config template class
   * @param extension
   */
  initConfig(extension: IExtensionConfigInit<C>): void;

}
