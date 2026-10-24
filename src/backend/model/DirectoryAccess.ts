import * as path from 'path';
import {Brackets, Connection, WhereExpressionBuilder} from 'typeorm';
import type {SessionContext} from './SessionContext';
import {SearchQueryUtils} from '../../common/SearchQueryUtils';
import {SQLConnection} from './database/SQLConnection';
import {DirectoryEntity} from './database/enitites/DirectoryEntity';
import {ObjectManagers} from './ObjectManagers';
import {GalleryManager} from './database/GalleryManager';
import {DiskManager} from './fileaccess/DiskManager';
import {Config} from '../../common/config/private/Config';
import {DatabaseType} from '../../common/config/private/PrivateConfig';
import {DirectoryCacheDTO, SubDirectoryDTO} from '../../common/entities/DirectoryDTO';
import {DirectorySearch} from '../../common/entities/SearchQueryDTO';

export enum DirectoryAccessTypes {
  none = 0, // not available, behaves as if it would not exist
  parent = 1, // can be opened to navigate to available directories, but its own content is hidden
  available = 2 // content (media and metafiles) is available
}

/**
 * Directory filter prebuilt for the two directory aliases used in the queries
 */
export interface DirectoryFilter {
  directory: Brackets; // filters the 'directory' alias
  directories: Brackets; // filters the 'directories' alias (subdirectories of a listed directory)
}

/**
 * Decides which directories a session can open, based on the directory allow and block lists.
 * It lives in SessionContext.directoryAccess.
 * - A blocked directory is never available.
 * - A directory matching all allow lists is available.
 * - Users can open the parents of the available directories (their content is hidden).
 *   These parents are found from the path for anchored searches (exact path, 'path/*'), otherwise from the DB.
 * - Sharing users can't open parents.
 * - Sharing without directory query: only directories with visible photos are available,
 *   directories with visible photos below them are parents.
 */
export class DirectoryAccess {
  // Plain lists for checking a single directory without DB access.
  // A directory is available if it matches every allow list and none of the block list entries.
  allowLists?: DirectorySearch[][];
  blockList?: DirectorySearch[];
  // Sharing without directory query: only directories with visible photos are available
  byPhotos?: boolean;
  // The same lists as SQL filters for listing directories
  allowQuery?: DirectoryFilter;
  notBlockedQuery?: DirectoryFilter; // this is the negated block list

  // the owner context. Not enumerable, so the session can be serialized
  declare private readonly context: SessionContext;

  constructor(context: SessionContext, init: Partial<Pick<DirectoryAccess,
    'allowLists' | 'blockList' | 'byPhotos' | 'allowQuery' | 'notBlockedQuery'>> = {}) {
    Object.defineProperty(this, 'context', {value: context, enumerable: false});
    Object.assign(this, init);
  }

  get isSharing(): boolean {
    return !!this.context?.user?.usedSharingKey;
  }

  public isBlocked(dirPath: string): boolean {
    return !!this.blockList && SearchQueryUtils.matchDirectoryList(dirPath, this.blockList);
  }

  /**
   * True if the directory matches all allow lists (does not check the block list)
   */
  public isAllowed(dirPath: string): boolean {
    return (this.allowLists || []).every(list => SearchQueryUtils.matchDirectoryList(dirPath, list));
  }

  /**
   * Media and metafiles of a directory are only shown if it is available.
   */
  public async isAvailable(dirPath: string): Promise<boolean> {
    return (await this.getAccess(dirPath)) === DirectoryAccessTypes.available;
  }

  public async getAccess(dirPath: string): Promise<DirectoryAccessTypes> {
    if (this.isBlocked(dirPath)) {
      return DirectoryAccessTypes.none;
    }
    if (this.byPhotos) {
      return this.getAccessByPhotos(dirPath);
    }
    if (this.isAllowed(dirPath)) {
      return DirectoryAccessTypes.available;
    }
    if (this.isSharing) {
      return DirectoryAccessTypes.none;
    }
    if (this.isAnchoredParent(dirPath)) {
      return DirectoryAccessTypes.parent;
    }
    if (this.needsDBForParents() && (await this.getAvailableDirectoriesBelow(dirPath, true)).length > 0) {
      return DirectoryAccessTypes.parent;
    }
    return DirectoryAccessTypes.none;
  }

  /**
   * Which parents (root is the first) the session can open.
   * The directory itself is accessible, so all its parents lead to an available directory.
   */
  public getAvailableParents(dirPath: string): boolean[] {
    const segments = SearchQueryUtils.normalizeDirectoryPath(dirPath).split('/').filter(s => s !== '');
    const strict = this.isSharing && !this.byPhotos;
    // segments.length parents: root, segments[0], segments[0]/segments[1], ...
    return segments.map((_, i) => {
      const parent = segments.slice(0, i).join('/');
      return !this.isBlocked(parent) && (!strict || this.isAllowed(parent));
    });
  }

  /**
   * Directories in search results and autocomplete need to be available (not just parents)
   */
  public isListedInSearch(cache: DirectoryCacheDTO): boolean {
    if (this.byPhotos) {
      return cache?.mediaCount > 0;
    }
    return cache?.recursiveMediaCount > 0;
  }

  /**
   * Applies the directory allow/block list on a directory query.
   * Parents are not added, those need to be filtered by the caller (see isListedInSearch).
   */
  public filterDirectoryQuery(qb: WhereExpressionBuilder, alias: keyof DirectoryFilter): void {
    if (this.notBlockedQuery) {
      qb.andWhere(this.notBlockedQuery[alias]);
    }
    if (this.allowQuery) {
      qb.andWhere(this.allowQuery[alias]);
    }
  }

  /**
   * Filters the subdirectories of a listed directory. The caches of the subdirectories need to be filled.
   */
  public async filterSubDirectories<T extends SubDirectoryDTO>(parent: { path: string, name: string },
                                                               subDirs: T[]): Promise<T[]> {
    if (!subDirs || subDirs.length === 0) {
      return subDirs;
    }
    if (!this.blockList && !this.allowLists && !this.byPhotos) {
      return subDirs;
    }
    const relPath = (d: { path: string, name: string }) =>
      SearchQueryUtils.normalizeDirectoryPath(path.join(d.path, d.name));

    if (this.byPhotos) {
      return subDirs.filter(d => !this.isBlocked(relPath(d)) && d.cache?.recursiveMediaCount > 0);
    }

    // first path segments (below the listed directory) of the available directories, only loaded if needed
    let availableBelow: Set<string> = null;
    const parentRelPath = relPath(parent);
    const getAvailableBelow = async (): Promise<Set<string>> => {
      if (availableBelow === null) {
        const prefixLength = parentRelPath === '' ? 0 : parentRelPath.length + 1;
        availableBelow = new Set(
          (await this.getAvailableDirectoriesBelow(parentRelPath, false))
            .map(d => relPath(d).substring(prefixLength).split('/')[0].toLowerCase()));
      }
      return availableBelow;
    };

    const ret: T[] = [];
    for (const d of subDirs) {
      const p = relPath(d);
      if (this.isBlocked(p)) {
        continue;
      }
      if (this.isAllowed(p)) {
        ret.push(d);
        continue;
      }
      if (this.isSharing) {
        continue;
      }
      if (this.isAnchoredParent(p) ||
        (this.needsDBForParents() && (await getAvailableBelow()).has(d.name.toLowerCase()))) {
        ret.push(d);
      }
    }
    return ret;
  }

  private isAnchoredParent(dirPath: string): boolean {
    // users only have one allow list
    const list = this.allowLists?.[0];
    return !!list && SearchQueryUtils.isDirectoryAnchoredParent(dirPath, list);
  }

  /**
   * Parents of like, negated and non-trailing glob searches can only be found from the DB
   */
  private needsDBForParents(): boolean {
    const list = this.allowLists?.[0];
    return !!list && list.some(d => !SearchQueryUtils.isDirectorySearchAnchored(d));
  }

  private async getAccessByPhotos(dirPath: string): Promise<DirectoryAccessTypes> {
    const p = GalleryManager.parseRelativeDirPath(dirPath);
    const connection = await SQLConnection.getConnection();
    const dir = await connection
      .getRepository(DirectoryEntity)
      .createQueryBuilder('directory')
      .where('directory.name = :name AND directory.path = :path', {name: p.name, path: p.parent})
      .leftJoinAndSelect('directory.cache', 'cache', 'cache.projectionKey = :pk AND cache.valid = 1', {pk: this.context.user.projectionKey})
      .select(['directory.id', 'directory.name', 'directory.path', 'cache'])
      .getOne();
    if (!dir) {
      return DirectoryAccessTypes.none;
    }
    if (!dir.cache?.valid) {
      dir.cache = await ObjectManagers.getInstance().ProjectedCacheManager.setAndGetCacheForDirectory(connection, this.context, dir);
    }
    if (dir.cache.mediaCount > 0) {
      return DirectoryAccessTypes.available;
    }
    if (dir.cache.recursiveMediaCount > 0) {
      return DirectoryAccessTypes.parent;
    }
    return DirectoryAccessTypes.none;
  }

  /**
   * Returns the available (allowed and not blocked) directories below the given directory
   */
  private async getAvailableDirectoriesBelow(dirPath: string, onlyOne: boolean): Promise<{ path: string, name: string }[]> {
    const connection: Connection = await SQLConnection.getConnection();
    const qb = connection
      .getRepository(DirectoryEntity)
      .createQueryBuilder('directory')
      .select(['directory.path', 'directory.name']);

    const p = GalleryManager.parseRelativeDirPath(dirPath);
    const root = GalleryManager.parseRelativeDirPath('.');
    if (p.name === root.name && p.parent === root.parent) {
      qb.where('NOT (directory.name = :rootName AND directory.path = :rootPath)', {rootName: root.name, rootPath: root.parent});
    } else {
      const childrenPath = DiskManager.pathFromParent({path: p.parent, name: p.name});
      if (Config.Database.type === DatabaseType.mysql) {
        qb.where('directory.path LIKE :childrenPath', {childrenPath: childrenPath.replace(/[\\%_]/g, '\\$&') + '%'});
      } else {
        qb.where('directory.path GLOB :childrenPath', {childrenPath: childrenPath.replace(/[[*?]/g, '[$&]') + '*'});
      }
    }
    this.filterDirectoryQuery(qb, 'directory');
    if (onlyOne) {
      qb.limit(1);
    }
    return await qb.getMany();
  }
}
