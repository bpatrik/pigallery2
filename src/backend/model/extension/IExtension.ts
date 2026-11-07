import * as express from 'express';
import {NextFunction, Request, Response} from 'express';
import {PrivateConfigClass} from '../../../common/config/private/PrivateConfigClass';
import {ObjectManagers} from '../ObjectManagers';
import {ProjectPathClass} from '../../ProjectPath';
import {ILogger} from '../../Logger';
import {UserDTO, UserRoles} from '../../../common/entities/UserDTO';
import {ParamsDictionary} from 'express-serve-static-core';
import {DataSource, Repository} from 'typeorm';
import {DynamicConfig} from '../../../common/entities/DynamicConfig';
import {MediaDTOWithThPath} from '../messenger/Messenger';
import {PhotoMetadata} from '../../../common/entities/PhotoDTO';
import {VideoMetadata} from '../../../common/entities/VideoDTO';
import {MediaRendererInput, SvgRendererInput} from '../fileaccess/PhotoWorker';
import {SearchQueryDTO} from '../../../common/entities/SearchQueryDTO';
import {CoverPhotoDTOWithID} from '../database/CoverManager';
import {ParentDirectoryDTO} from '../../../common/entities/DirectoryDTO';
import {DirectoryScanSettings} from '../fileaccess/DiskManager';
import {SessionContext} from '../SessionContext';
import {IClientMediaButtonConfig, IMediaRequestBodyData} from '../../../common/entities/extension/IClientUIConfig';
import {MediaEntity} from '../database/enitites/MediaEntity';
import {VideoConverterInput} from '../fileaccess/VideoConverterWorker';
import {ProjectedDirectoryCacheEntity} from '../database/enitites/ProjectedDirectoryCacheEntity';


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
      getCoverForAlbum: IExtensionEvent<[session: SessionContext, {
        searchQuery: SearchQueryDTO;
      }], CoverPhotoDTOWithID>;
      getCoverForDirectory: IExtensionEvent<[
        session: SessionContext, {
          id: number;
          name: string;
          path: string;
        }], CoverPhotoDTOWithID>
    },
    ProjectedCacheManager: {
      /**
       * Invalidates directory covers and caches for a given directory and every parent
       */
      invalidateDirectoryCache: IExtensionEvent<[ParentDirectoryDTO], void>;
      /**
       * Returns the projected directory cache for a given directory
       * ProjectedDirectoryCacheEntity contains information, like the number of photos, videos, etc..
       */
      getCacheForDirectory: IExtensionEvent<[connection: DataSource, session: SessionContext, dir: {
        id: number,
        name: string,
        path: string
      }], ProjectedDirectoryCacheEntity>;
    },
    VideoConverter: {
      /**
       * Converts videos with ffmpeg
       */
      convert: IExtensionEvent<[VideoConverterInput], void>
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

export interface IMediaRequestBody {
  data: IMediaRequestBodyData;
  media: string;
}

type IdentifierStart = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h' | 'i' | 'j' | 'k' | 'l' | 'm' | 'n' | 'o' | 'p' | 'q' | 'r' | 's' | 't'
  | 'u' | 'v' | 'w' | 'x' | 'y' | 'z' | Uppercase<'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h' | 'i' | 'j' | 'k' | 'l' | 'm' | 'n' | 'o' | 'p' | 'q'
  | 'r' | 's' | 't' | 'u' | 'v' | 'w' | 'x' | 'y' | 'z'> | '_' | '$';

// true if a ':' or '*' in the path is not followed by a parameter name
type HasUnnamedParam<P extends string> =
  P extends `${string}${':' | '*'}${infer Rest}`
    ? Rest extends `${IdentifierStart}${string}` ? HasUnnamedParam<Rest> : true
    : false;

/**
 * A REST api path, relative to the extension base endpoint, in Express 5 (path-to-regexp 8) syntax:
 * `:name` for a param, `*name` for a wildcard (its param is the array of the path segments) and `{...}` for an optional part.
 * The Express 4 syntax is rejected: regex params (`:id(\\d+)`), `:id?`, unnamed wildcards (`*`) and the reserved `()[]?+!` characters.
 * See https://expressjs.com/en/guide/migrating-5.html#path-syntax
 * At runtime, a path that Express 5 can't parse is logged and not registered.
 */
export type ExtensionRoutePath<P extends string> =
  P extends `${string}${'(' | ')' | '[' | ']' | '?' | '+' | '!'}${string}`
    ? 'Express 4 path syntax is not supported (no regex params, no ?, +, !, [ or ]); use {...} for optional parts'
    : HasUnnamedParam<P> extends true
      ? 'Every : and * needs a parameter name (e.g. *path), see the Express 5 path syntax'
      : P;

/**
 * Checks every path of a route literal at compile time, see {@link ExtensionRoutePath}.
 */
export type ExtensionRoutePaths<P extends readonly string[]> = { readonly [K in keyof P]: ExtensionRoutePath<P[K]> };

export interface IExtensionRESTRoute {
  /**
   * Looks for req.body.media for the media path and calls the callback with that media entry.
   * Sends a pigallery2 standard JSON object with payload or error message back to the client.
   * @param paths RESTapi paths, relative to the extension base endpoint, see {@link ExtensionRoutePath}
   * @param invalidateDirectory set to false to prevent invalidating the directory.
   * Invalidation is resource-intensive and should be avoided if media or its directory is not changed.
   * @param minRole set to null to omit auer check (ie make the endpoint public)
   * @param cb function callback. `body` is `{}` if the request has no JSON body.
   * @return newly added REST api path
   */
  mediaJsonResponse<const P extends readonly string[]>(paths: ExtensionRoutePaths<P>, minRole: UserRoles, invalidateDirectory: boolean, cb: (params: ParamsDictionary, body: IMediaRequestBody, user: UserDTO, media: MediaEntity, repository: Repository<MediaEntity>) => Promise<unknown> | unknown): string;

  /**
   * Sends a pigallery2 standard JSON object with payload or error message back to the client.
   * @param paths RESTapi paths, relative to the extension base endpoint, see {@link ExtensionRoutePath}
   * @param minRole set to null to omit auer check (ie make the endpoint public)
   * @param cb function callback. `body` is `{}` if the request has no JSON body.
   * @return newly added REST api path
   */
  jsonResponse<const P extends readonly string[]>(paths: ExtensionRoutePaths<P>, minRole: UserRoles, cb: (params?: ParamsDictionary, body?: any, user?: UserDTO) => Promise<unknown> | unknown): string;

  /**
   * Exposes a standard expressjs (Express 5) middleware
   * @param paths RESTapi paths, relative to the extension base endpoint, see {@link ExtensionRoutePath}
   * @param minRole set to null to omit auer check (ie make the endpoint public)
   * @param mw expressjs middleware. `req.body` is `undefined` if the request has no JSON body.
   * @return newly added REST api path
   */
  rawMiddleware<const P extends readonly string[]>(paths: ExtensionRoutePaths<P>, minRole: UserRoles, mw: (req: Request, res: Response, next: NextFunction) => void | Promise<void>): string;
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
  getSQLConnection(): Promise<DataSource>;

  /**
   * Adds SQL tables to typeorm
   * @param tables
   */
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  setExtensionTables(tables: Function[]): Promise<void>;

  /**
   * Exposes all tables. You can use this if you van to have a foreign key to a built-in table.
   * Use with caution. This exposes the app's internal working.
   */
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
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

  /**
   * Use this to add UI changes to the app.
   * This is the place to add new buttons, change the UI, etc..
   */
  ui: IUIExtension<C>;
}

export interface IUIExtension<_C> {
  /**
   * Adds a new button on to UI to all media (photo, video).
   * Implement the server-side click action in the serverSB function.
   * @param buttonConfig
   * @param serverSB If not set the button will be a fake button (i.e.: only show up not clickable)
   */

  addMediaButton(buttonConfig: IClientMediaButtonConfig, serverSB?: (params: ParamsDictionary, body: IMediaRequestBody, user: UserDTO, media: MediaEntity, repository: Repository<MediaEntity>) => Promise<void>): void;
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

  cleanUp?: (extension: IExtensionObject<C>) => Promise<void>;

  /**
   * Extension init function. Extension should at minimum expose this function.
   * @param extension
   */
  init(extension: IExtensionObject<C>): Promise<void>;
}


/**
 * Extension config interface. All extensions can implement and export these methods.
 * This is the content of the config.js file.
 */
export interface IServerExtensionConfig<C> {

  /**
   * This function can be called any time. It should only set the config template class
   * @param extension
   */
  initConfig(extension: IExtensionConfigInit<C>): void;

}
