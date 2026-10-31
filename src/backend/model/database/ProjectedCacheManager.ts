import {Brackets, Connection} from 'typeorm';
import {SQLConnection} from './SQLConnection';
import {ProjectedDirectoryCacheEntity} from './enitites/ProjectedDirectoryCacheEntity';
import {ProjectedAlbumCacheEntity} from './enitites/album/ProjectedAlbumCacheEntity';
import {DirectoryEntity} from './enitites/DirectoryEntity';
import {ObjectManagers} from '../ObjectManagers';
import {UserEntity} from './enitites/UserEntity';
import {SharingEntity} from './enitites/SharingEntity';
import {IObjectManager} from './IObjectManager';
import {ParentDirectoryDTO} from '../../../common/entities/DirectoryDTO';
import {DiskManager} from '../fileaccess/DiskManager';
import {ExtensionDecorator} from '../extension/ExtensionDecorator';
import {Logger} from '../../Logger';
import {SessionManager} from './SessionManager';
import * as path from 'path';
import {SessionContext} from '../SessionContext';
import {MediaEntity} from './enitites/MediaEntity';
import {Config} from '../../../common/config/private/Config';
import {DatabaseType} from '../../../common/config/private/PrivateConfig';
import {ProjectedPersonCacheEntity} from './enitites/person/ProjectedPersonCacheEntity';
import {NotificationManager} from '../NotifocationManager';

const LOG_TAG = '[ProjectedCacheManager]';

export class ProjectedCacheManager implements IObjectManager {

  async init(): Promise<void> {
    // Cleanup at startup to avoid stale growth
    await this.cleanupNonExistingProjections();
  }

  public async onNewDataVersion(changedDir?: ParentDirectoryDTO): Promise<void> {
    if (!changedDir) {
      return;
    }
    await this.invalidateDirectoryCache(changedDir);
  }

  /**
   * Includes all possible projection keys, including the default one and sharing keys too.
   */
  public async getAllProjections(): Promise<string[]> {
    const connection = await SQLConnection.getConnection();
    const activeKeys = new Set<string>();

    // Always include default projection key
    activeKeys.add(SessionManager.NO_PROJECTION_KEY);

    // Users
    const users = await connection.getRepository(UserEntity).find();
    for (const user of users) {
      const ctx = await ObjectManagers.getInstance().SessionManager.buildContext(user);
      if (ctx?.user?.projectionKey) {
        activeKeys.add(ctx.user.projectionKey);
      }
    }

    // Sharings
    const shares = await connection.getRepository(SharingEntity)
      .createQueryBuilder('share')
      .leftJoinAndSelect('share.creator', 'creator')
      .getMany();
    for (const s of shares) {
      try {
        const q = ObjectManagers.getInstance().SessionManager.buildAllowListForSharing(s);
        const key = ObjectManagers.getInstance().SessionManager.createProjectionKey(q);
        activeKeys.add(key);
      } catch (e) {
        // an invalid sharing can't be opened, so it has no projection
        Logger.warn(LOG_TAG, 'Skipping invalid sharing ' + s.sharingKey + ': ' + (e as Error)?.message);
      }
    }

    return Array.from(activeKeys);
  }

  public async cleanupNonExistingProjections(): Promise<void> {
    const connection = await SQLConnection.getConnection();
    const keys = await this.getAllProjections();
    Logger.debug(LOG_TAG, 'Cleanup non existing projections, known number of keys: ' + keys.length);
    if (keys.length === 0) {
      // No known projections; nothing to prune safely
      return;
    }

    await connection.getRepository(ProjectedDirectoryCacheEntity)
      .createQueryBuilder()
      .delete()
      .where('projectionKey NOT IN (:...keys)', {keys})
      .execute();

    await connection.getRepository(ProjectedAlbumCacheEntity)
      .createQueryBuilder()
      .delete()
      .where('projectionKey NOT IN (:...keys)', {keys})
      .execute();

    await connection.getRepository(ProjectedPersonCacheEntity)
      .createQueryBuilder()
      .delete()
      .where('projectionKey NOT IN (:...keys)', {keys})
      .execute();
  }


  @ExtensionDecorator(e => e.gallery.ProjectedCacheManager.getCacheForDirectory)
  public async getCacheForDirectory(connection: Connection, session: SessionContext, dir: {
    id: number,
    name: string,
    path: string
  }): Promise<ProjectedDirectoryCacheEntity> {
    // Compute aggregates under the current projection (if any)
    const mediaRepo = connection.getRepository(MediaEntity);
    const baseQb = mediaRepo
      .createQueryBuilder('media')
      .innerJoin('media.directory', 'directory')
      .where('directory.id = :dir', {dir: dir.id});

    if (session.projectionQuery) {
      baseQb.andWhere(session.projectionQuery);
    }

    const agg = await baseQb
      .select([
        'COUNT(*) as mediaCount',
        'MIN(media.metadata.creationDate) as oldest',
        'MAX(media.metadata.creationDate) as youngest',
      ])
      .getRawOne();

    const mediaCount: number = agg?.mediaCount != null ? parseInt(agg.mediaCount as any, 10) : 0;
    const oldestMedia: number = agg?.oldest != null ? parseInt(agg.oldest as any, 10) : null;
    const youngestMedia: number = agg?.youngest != null ? parseInt(agg.youngest as any, 10) : null;

    // Compute recursive media count under projection (includes children) using single SQL query
    const recQb = mediaRepo
      .createQueryBuilder('media')
      .innerJoin('media.directory', 'directory')
      .where(
        new Brackets(q => {
          q.where('directory.id = :dir', {dir: dir.id});
          const root = DiskManager.pathFromRelativeDirName('.');
          if (dir.name === DiskManager.dirName(root) && dir.path === root) {
            // everything is below the root. Only its direct children have './' as path, deeper ones don't.
            q.orWhere('1 = 1');
          } else if (Config.Database.type === DatabaseType.mysql) {
            q.orWhere('directory.path like :path || \'%\'', {path: DiskManager.pathFromParent(dir)});
          } else {
            q.orWhere('directory.path GLOB :path', {
              path: DiskManager.pathFromParent(dir).replaceAll('[', '[[]') + '*',
            });
          }
        })
      );

    if (session.projectionQuery) {
      recQb.andWhere(session.projectionQuery);
    }
    const aggRec = await recQb.select(['COUNT(*) as cnt']).getRawOne();
    const recursiveMediaCount = aggRec?.cnt != null ? parseInt(aggRec.cnt as any, 10) : 0;


    // Compute cover respecting projection
    const coverMedia = await ObjectManagers.getInstance().CoverManager.getCoverForDirectory(session, dir);

    const cacheRepo = connection.getRepository(ProjectedDirectoryCacheEntity);

    // Find existing cache row by (projectionKey, directory)
    const projectionKey = session?.user?.projectionKey;

    let row = await cacheRepo
      .createQueryBuilder('pdc')
      .leftJoin('pdc.directory', 'd')
      .where('pdc.projectionKey = :pk AND d.id = :dir', {pk: projectionKey, dir: dir.id})
      .getOne();

    if (!row) {
      row = new ProjectedDirectoryCacheEntity();
      row.projectionKey = projectionKey;
      // Avoid fetching the full directory graph; assign relation by id only
      row.directory = {id: dir.id} as any;
    }

    row.mediaCount = mediaCount || 0;
    row.recursiveMediaCount = recursiveMediaCount || 0;
    row.oldestMedia = oldestMedia ?? null;
    row.youngestMedia = youngestMedia ?? null;
    row.cover = coverMedia as any;
    row.valid = true;

    return row;
  }

  public async setAndGetCacheForDirectory(connection: Connection, session: SessionContext, dir: {
    id: number,
    name: string,
    path: string
  }): Promise<ProjectedDirectoryCacheEntity> {
    const cacheRepo = connection.getRepository(ProjectedDirectoryCacheEntity);
    const row = await this.getCacheForDirectory(connection, session, dir);
    const ret = await cacheRepo.save(row);
    // we would not select these either
    delete ret.projectionKey;
    delete ret.directory;
    delete ret.id;
    if (ret.cover) {
      delete ret.cover.id;
    }
    return ret;
  }

  public async setAndGetCacheForAlbum(connection: Connection, session: SessionContext, album: {
    name: string,
    id: number,
    searchQuery: any
  }): Promise<ProjectedAlbumCacheEntity> {


    const cacheRepo = connection.getRepository(ProjectedAlbumCacheEntity);

    // Find existing cache row by (projectionKey, album)
    const projectionKey = session?.user?.projectionKey;

    let row = await cacheRepo
      .createQueryBuilder('pac')
      .leftJoin('pac.album', 'a')
      .where('pac.projectionKey = :pk AND a.id = :albumId', {pk: projectionKey, albumId: album.id})
      .getOne();

    if (row && row.valid === true) {
      return row;
    }

    // Compute aggregates under the current projection (if any)
    const mediaRepo = connection.getRepository(MediaEntity);

    // Build base query from album's search query
    const baseQb = mediaRepo
      .createQueryBuilder('media')
      .leftJoin('media.directory', 'directory');

    // Apply album search query constraints
    const albumWhereQuery = await ObjectManagers.getInstance().SearchManager.prepareAndBuildWhereQuery(
      album.searchQuery
    );
    baseQb.andWhere(albumWhereQuery);

    // Apply projection constraints if any
    if (session.projectionQuery) {
      baseQb.andWhere(session.projectionQuery);
    }

    let coverMedia, agg;
    try {
      agg = await baseQb
        .select([
          'COUNT(*) as itemCount',
          'MIN(media.metadata.creationDate) as oldest',
          'MAX(media.metadata.creationDate) as youngest',
        ])
        .getRawOne();


      // Compute cover respecting projection
      coverMedia = await ObjectManagers.getInstance().CoverManager.getCoverForAlbum(session, album as any);
    } catch (e) {
      Logger.error(LOG_TAG, `Error computing album cache for album "${album.name}": ` + e);
      NotificationManager.warning(`Error computing album cache for album "${album.name}"`);
    }

    const itemCount: number = agg?.itemCount != null ? parseInt(agg.itemCount as any, 10) : 0;
    const oldestMedia: number = agg?.oldest != null ? parseInt(agg.oldest as any, 10) : null;
    const youngestMedia: number = agg?.youngest != null ? parseInt(agg.youngest as any, 10) : null;

    if (!row) {
      row = new ProjectedAlbumCacheEntity();
      row.projectionKey = projectionKey;
      // Avoid fetching the full album graph; assign relation by id only
      row.album = {id: album.id} as any;
    }

    row.itemCount = itemCount || 0;
    row.oldestMedia = oldestMedia ?? null;
    row.youngestMedia = youngestMedia ?? null;
    row.cover = coverMedia as any;
    row.valid = true;

    const ret = await cacheRepo.save(row);
    // we would not select these either
    delete ret.projectionKey;
    delete ret.album;
    delete ret.id;
    if (ret.cover) {
      delete ret.cover.id;
    }
    return ret;
  }

  @ExtensionDecorator(e => e.gallery.ProjectedCacheManager.invalidateDirectoryCache)
  protected async invalidateDirectoryCache(dir: ParentDirectoryDTO) {
    const connection = await SQLConnection.getConnection();
    const dirRepo = connection.getRepository(DirectoryEntity);

    // Collect directory paths from target to root
    const paths: { path: string; name: string }[] = [];
    let fullPath = DiskManager.normalizeDirPath(path.join(dir.path, dir.name));
    const root = DiskManager.pathFromRelativeDirName('.');

    // Build path-name pairs for current directory and all parents
    while (fullPath !== root) {
      const name = DiskManager.dirName(fullPath);
      const parentPath = DiskManager.pathFromRelativeDirName(fullPath);
      paths.push({path: parentPath, name});
      fullPath = parentPath;
    }

    // Add root directory
    paths.push({path: DiskManager.pathFromRelativeDirName(root), name: DiskManager.dirName(root)});

    if (paths.length === 0) {
      return;
    }

    // Build query for all directories in one shot
    const qb = dirRepo.createQueryBuilder('d');
    paths.forEach((p, i) => {
      qb.orWhere(new Brackets(q => {
        q.where(`d.path = :path${i}`, {[`path${i}`]: p.path})
          .andWhere(`d.name = :name${i}`, {[`name${i}`]: p.name});
      }));
    });

    // Find matching directories and invalidate their cache entries
    const entities = await qb.getMany();
    if (entities.length === 0) {
      return;
    }

    // Invalidate all related cache entries in one operation
    await connection.getRepository(ProjectedDirectoryCacheEntity)
      .createQueryBuilder()
      .update()
      .set({valid: false})
      .where('directoryId IN (:...dirIds)', {dirIds: entities.map(e => e.id)})
      .execute();
  }

}
