import {ParentDirectoryDTO, SubDirectoryDTO,} from '../../../common/entities/DirectoryDTO';
import * as path from 'path';
import * as fs from 'fs';
import {DirectoryEntity} from './enitites/DirectoryEntity';
import {SQLConnection} from './SQLConnection';
import {PhotoEntity} from './enitites/PhotoEntity';
import {ProjectPath} from '../../ProjectPath';
import {Config} from '../../../common/config/private/Config';
import {Brackets, Connection} from 'typeorm';
import {MediaEntity} from './enitites/MediaEntity';
import {VideoEntity} from './enitites/VideoEntity';
import {Logger} from '../../Logger';
import {ObjectManagers} from '../ObjectManagers';
import {DuplicatesDTO} from '../../../common/entities/DuplicatesDTO';
import {ReIndexingSensitivity} from '../../../common/config/private/PrivateConfig';
import {DiskManager} from '../fileaccess/DiskManager';
import {SessionContext} from '../SessionContext';
import {FileEntity} from './enitites/FileEntity';

const LOG_TAG = '[GalleryManager]';

export class GalleryManager {
  public static parseRelativeDirPath(relativeDirectoryName: string): {
    name: string;
    parent: string;
  } {
    relativeDirectoryName = DiskManager.normalizeDirPath(
      relativeDirectoryName
    );
    return {
      name: path.basename(relativeDirectoryName),
      parent: path.join(path.dirname(relativeDirectoryName), path.sep),
    };
  }

  public async listDirectory(
    session: SessionContext,
    relativeDirectoryName: string,
    knownLastModified?: number,
    knownLastScanned?: number,
    options: {
      allowIndexing?: boolean, // if false, only the DB is used, the directory is never (re)indexed
      withMetaFiles?: boolean // if false, metafiles are not listed (the directory content is not available)
    } = {}
  ): Promise<ParentDirectoryDTO> {
    const directoryPath = GalleryManager.parseRelativeDirPath(
      relativeDirectoryName
    );
    const withMetaFiles = options.withMetaFiles !== false;

    const connection = await SQLConnection.getConnection();
    const dir = await this.getDirIdAndTime(connection, directoryPath.name, directoryPath.parent);
    const getDir = (id: number) => this.getParentDirFromId(connection, session, id, withMetaFiles);

    if (options.allowIndexing === false) {
      if (!dir) {
        throw new Error('Directory is not indexed');
      }
      if (knownLastModified && knownLastScanned &&
        dir.lastModified === knownLastModified && dir.lastScanned === knownLastScanned) {
        return null;
      }
      return await getDir(dir.id);
    }

    if (dir && dir.lastScanned != null) {
      // Return as soon as possible without touching the original data source (hdd)
      // See https://github.com/bpatrik/pigallery2/issues/613
      if (
        Config.Indexing.reIndexingSensitivity === ReIndexingSensitivity.never
      ) {
        if (knownLastModified && knownLastScanned) {
          return null;
        }
        return await getDir(dir.id);
      }

      const stat = fs.statSync(
        path.join(ProjectPath.ImageFolder, relativeDirectoryName)
      );
      const lastModified = DiskManager.calcLastModified(stat);

      // If it seems that the content did not change, do not work on it
      if (
        knownLastModified && knownLastScanned &&
        lastModified === knownLastModified &&
        dir.lastScanned === knownLastScanned
      ) {
        if (
          Config.Indexing.reIndexingSensitivity === ReIndexingSensitivity.low
        ) {
          return null;
        }
        if (
          Date.now() - dir.lastScanned <= Config.Indexing.cachedFolderTimeout &&
          Config.Indexing.reIndexingSensitivity === ReIndexingSensitivity.medium
        ) {
          return null;
        }
      }

      if (dir.lastModified !== lastModified) {
        Logger.silly(LOG_TAG, 'Reindexing reason: lastModified mismatch: known: ' + dir.lastModified + ', current:' + lastModified);
        // Need to wait for save, then return a DB-based result with projection
        await ObjectManagers.getInstance().IndexingManager.indexDirectory(relativeDirectoryName, true);
        return await getDir(dir.id);

      }

      // not indexed since a while, index it lazily
      if (
        (Date.now() - dir.lastScanned > Config.Indexing.cachedFolderTimeout &&
          Config.Indexing.reIndexingSensitivity >= ReIndexingSensitivity.medium) ||
        Config.Indexing.reIndexingSensitivity >= ReIndexingSensitivity.high
      ) {
        // on the fly reindexing
        Logger.silly(LOG_TAG, 'lazy reindexing reason: cache timeout: lastScanned: ' + (Date.now() - dir.lastScanned) +
          'ms ago, cachedFolderTimeout:' + Config.Indexing.cachedFolderTimeout);
        ObjectManagers.getInstance()
          .IndexingManager.indexDirectory(relativeDirectoryName)
          .catch(console.error);
      }
      return await getDir(dir.id);
    }

    // never scanned (deep indexed), do it and return with it
    Logger.silly(LOG_TAG, 'Reindexing reason: never scanned');
    if (session?.projectionQuery) {
      // Save must be completed to query with projection
      await ObjectManagers.getInstance().IndexingManager.indexDirectory(
        relativeDirectoryName,
        true
      );
      const connection = await SQLConnection.getConnection();
      const dir = await this.getDirIdAndTime(connection, directoryPath.name, directoryPath.parent);
      return await getDir(dir.id);
    }
    const indexed = await ObjectManagers.getInstance().IndexingManager.indexDirectory(relativeDirectoryName);
    if (indexed && !withMetaFiles) {
      indexed.metaFile = [];
    }
    return indexed;
  }

  async countDirectories(): Promise<number> {
    const connection = await SQLConnection.getConnection();
    return await connection
      .getRepository(DirectoryEntity)
      .createQueryBuilder('directory')
      .getCount();
  }

  async countMediaSize(): Promise<number> {
    const connection = await SQLConnection.getConnection();
    const {sum} = await connection
      .getRepository(MediaEntity)
      .createQueryBuilder('media')
      .select('SUM(media.metadata.fileSize)', 'sum')
      .getRawOne();
    return sum || 0;
  }

  async countPhotos(): Promise<number> {
    const connection = await SQLConnection.getConnection();
    return await connection
      .getRepository(PhotoEntity)
      .createQueryBuilder('directory')
      .getCount();
  }

  async countVideos(): Promise<number> {
    const connection = await SQLConnection.getConnection();
    return await connection
      .getRepository(VideoEntity)
      .createQueryBuilder('directory')
      .getCount();
  }

  public async getPossibleDuplicates(): Promise<DuplicatesDTO[]> {
    const connection = await SQLConnection.getConnection();
    const mediaRepository = connection.getRepository(MediaEntity);

    let duplicates = await mediaRepository
      .createQueryBuilder('media')
      .innerJoin(
        (query) =>
          query
            .from(MediaEntity, 'innerMedia')
            .select([
              'innerMedia.name as name',
              'innerMedia.metadata.fileSize as fileSize',
              'count(*)',
            ])
            .groupBy('innerMedia.name, innerMedia.metadata.fileSize')
            .having('count(*)>1'),
        'innerMedia',
        'media.name=innerMedia.name AND media.metadata.fileSize = innerMedia.fileSize'
      )
      .innerJoinAndSelect('media.directory', 'directory')
      .orderBy('media.name, media.metadata.fileSize')
      .limit(Config.Duplicates.listingLimit)
      .getMany();

    const duplicateParis: DuplicatesDTO[] = [];
    const processDuplicates = (
      duplicateList: MediaEntity[],
      equalFn: (a: MediaEntity, b: MediaEntity) => boolean,
      checkDuplicates = false
    ): void => {
      let i = duplicateList.length - 1;
      while (i >= 0) {
        const list = [duplicateList[i]];
        let j = i - 1;
        while (j >= 0 && equalFn(duplicateList[i], duplicateList[j])) {
          list.push(duplicateList[j]);
          j--;
        }
        i = j;
        // if we cut the select list with the SQL LIMIT, filter unpaired media
        if (list.length < 2) {
          continue;
        }
        if (checkDuplicates) {
          // ad to group if one already existed
          const foundDuplicates = duplicateParis.find(
            (dp): boolean =>
              !!dp.media.find(
                (m): boolean => !!list.find((lm): boolean => lm.id === m.id)
              )
          );
          if (foundDuplicates) {
            list.forEach((lm): void => {
              if (
                foundDuplicates.media.find((m): boolean => m.id === lm.id)
              ) {
                return;
              }
              foundDuplicates.media.push(lm);
            });
            continue;
          }
        }

        duplicateParis.push({media: list});
      }
    };

    processDuplicates(
      duplicates,
      (a, b): boolean =>
        a.name === b.name && a.metadata.fileSize === b.metadata.fileSize
    );

    duplicates = await mediaRepository
      .createQueryBuilder('media')
      .innerJoin(
        (query) =>
          query
            .from(MediaEntity, 'innerMedia')
            .select([
              'innerMedia.metadata.creationDate as creationDate',
              'innerMedia.metadata.fileSize as fileSize',
              'count(*)',
            ])
            .groupBy(
              'innerMedia.metadata.creationDate, innerMedia.metadata.fileSize'
            )
            .having('count(*)>1'),
        'innerMedia',
        'media.metadata.creationDate=innerMedia.creationDate AND media.metadata.fileSize = innerMedia.fileSize'
      )
      .innerJoinAndSelect('media.directory', 'directory')
      .orderBy('media.metadata.creationDate, media.metadata.fileSize')
      .limit(Config.Duplicates.listingLimit)
      .getMany();

    processDuplicates(
      duplicates,
      (a, b): boolean =>
        a.metadata.creationDate === b.metadata.creationDate &&
        a.metadata.fileSize === b.metadata.fileSize,
      true
    );

    return duplicateParis;
  }

  /**
   * Returns with the directories only, does not include media or metafiles
   */
  public async selectDirStructure(
    relativeDirectoryName: string
  ): Promise<DirectoryEntity> {
    const directoryPath = GalleryManager.parseRelativeDirPath(
      relativeDirectoryName
    );
    const connection = await SQLConnection.getConnection();
    const query = connection
      .getRepository(DirectoryEntity)
      .createQueryBuilder('directory')
      .where('directory.name = :name AND directory.path = :path', {
        name: directoryPath.name,
        path: directoryPath.parent,
      })
      .leftJoinAndSelect('directory.directories', 'directories');

    return await query.getOne();
  }

  /**
   * Sets cover for the directory and caches it in the DB
   */
  public async fillCacheForSubDir(
    connection: Connection,
    session: SessionContext,
    dir: SubDirectoryDTO
  ): Promise<void> {
    if (!dir.cache?.valid) {
      dir.cache = await ObjectManagers.getInstance().ProjectedCacheManager.setAndGetCacheForDirectory(connection, session, dir);
    }

    dir.media = [];
    dir.isPartial = true;
  }

  async getMedia(session: SessionContext, mediaPath: string): Promise<MediaEntity> {
    // Validate media is available under projectionQuery
    const fileName = path.basename(mediaPath);
    const dirRelPath = path.dirname(mediaPath);
    const directoryName = path.basename(dirRelPath);
    const directoryParent = path.join(path.dirname(dirRelPath), path.sep);

    const connection = await SQLConnection.getConnection();
    const qb = connection
      .getRepository(MediaEntity)
      .createQueryBuilder('media')
      .innerJoinAndSelect('media.directory', 'directory')
      .where('media.name = :name', {name: fileName})
      .andWhere('directory.name = :dname AND directory.path = :dpath', {dname: directoryName, dpath: directoryParent});
    if (session.projectionQuery) {
      qb.andWhere(session.projectionQuery);
    }
    return await qb.getOne();
  }

  async authoriseMedia(session: SessionContext, mediaPath: string) {
    // If no projection set for session, proceed
    if (!session?.projectionQuery) {
      return true;
    }

    // Validate media is available under projectionQuery
    const fileName = path.basename(mediaPath);
    const dirRelPath = path.dirname(mediaPath);
    const directoryName = path.basename(dirRelPath);
    const directoryParent = path.join(path.dirname(dirRelPath), path.sep);

    const connection = await SQLConnection.getConnection();
    const qb = connection
      .getRepository(MediaEntity)
      .createQueryBuilder('media')
      .innerJoin('media.directory', 'directory')
      .where('media.name = :name', {name: fileName})
      .andWhere('directory.name = :dname AND directory.path = :dpath', {dname: directoryName, dpath: directoryParent})
      .andWhere(session.projectionQuery);

    const count = await qb.getCount();

    return count !== 0;
  }

  /**
   * Metafiles belong to their directory: they are available if the directory is available (see DirectoryAccess).
   */
  async authoriseMetaFile(session: SessionContext, p: string): Promise<boolean> {
    return session.directoryAccess.isAvailable(path.dirname(p));
  }

  protected async getDirIdAndTime(connection: Connection, name: string, path: string): Promise<{
    id: number,
    lastScanned: number,
    lastModified: number
  }> {
    return await connection
      .getRepository(DirectoryEntity)
      .createQueryBuilder('directory')
      .where('directory.name = :name AND directory.path = :path', {
        name: name,
        path: path,
      })
      .select([
        'directory.id',
        'directory.lastScanned',
        'directory.lastModified',
      ]).getOne();
  }

  protected async getParentDirFromId(
    connection: Connection,
    session: SessionContext,
    partialDirId: number,
    withMetaFiles = true
  ): Promise<ParentDirectoryDTO> {

    const query = connection
      .getRepository(DirectoryEntity)
      .createQueryBuilder('directory')
      .where('directory.id = :id', {
        id: partialDirId
      })
      .leftJoinAndSelect('directory.cache', 'cache', 'cache.projectionKey = :pk AND cache.valid = 1', {pk: session.user.projectionKey});


    try {
      const dir = await query.getOne();

      if (!dir.cache?.valid) {
        dir.cache = await ObjectManagers.getInstance().ProjectedCacheManager.setAndGetCacheForDirectory(connection, session, dir);
      }

      const dirQuery = connection
        .getRepository(DirectoryEntity)
        .createQueryBuilder('directories')
        .where('directories.parent = :id', {id: partialDirId})
        .leftJoinAndSelect('directories.cache', 'dcache', 'dcache.projectionKey = :pk AND dcache.valid = 1', {pk: session.user.projectionKey})
        .leftJoinAndSelect('dcache.cover', 'dcover')
        .leftJoinAndSelect('dcover.directory', 'dcoverDirectory')
        .select([
          'directories',
          'dcache',
          'dcover.name',
          'dcoverDirectory.name',
          'dcoverDirectory.path',
        ]);

      // search does not return a directory if that is recursively having 0 media
      // gallery listing should otherwise, we won't be able to trigger lazy indexing
      // this behavior lets us explicitly hid a directory if it is explicitly blocked
      if (session.projectionQueryForSubDir) {
        dirQuery.andWhere(new Brackets(q => {
          q.where(session.projectionQueryForSubDir);
          // also select directories when they have no child dirs.
          q.orWhere('directories.id is NULL');
        }));
      }

      dir.directories = await dirQuery.getMany();

      if (dir.directories) {
        for (const item of dir.directories) {
          await this.fillCacheForSubDir(connection, session, item);
        }
      }
      // directory allow/block list, needs the cache to be filled
      dir.directories = await session.directoryAccess.filterSubDirectories(dir, dir.directories);

      const mQuery = connection.getRepository(MediaEntity)
        .createQueryBuilder('media')
        .leftJoin('media.directory', 'directory')
        .where('media.directory = :id', {
          id: partialDirId
        });
      if (session.projectionQuery) {
        mQuery.andWhere(session.projectionQuery);
      }
      dir.media = await mQuery.getMany();

      // Separate query for meta files
      dir.metaFile = [];
      if (
        withMetaFiles && (Config.MetaFile.gpx === true ||
        Config.MetaFile.pg2conf === true ||
        Config.MetaFile.markdown === true)
      ) {
        const metaFileQuery = connection
          .getRepository(FileEntity)
          .createQueryBuilder('metaFile')
          .where('metaFile.directory = :id', {id: partialDirId});

        dir.metaFile = await metaFileQuery.getMany();
      }

      return dir;
    } catch (e) {
      Logger.error(LOG_TAG, 'Failed to get parent directory: ' + e);
      Logger.debug(LOG_TAG, query.getQuery(), query.getParameters());
      throw e;
    }
  }
}
