import {ParentDirectoryDTO, SubDirectoryDTO,} from '../../../common/entities/DirectoryDTO';
import * as path from 'path';
import * as fs from 'fs';
import {DirectoryEntity} from './enitites/DirectoryEntity';
import {SQLConnection} from './SQLConnection';
import {PhotoEntity} from './enitites/PhotoEntity';
import {ProjectPath} from '../../ProjectPath';
import {Config} from '../../../common/config/private/Config';
import {Connection} from 'typeorm';
import {MediaEntity} from './enitites/MediaEntity';
import {VideoEntity} from './enitites/VideoEntity';
import {Logger} from '../../Logger';
import {ObjectManagers} from '../ObjectManagers';
import {DuplicatesDTO} from '../../../common/entities/DuplicatesDTO';
import {ReIndexingSensitivity} from '../../../common/config/private/PrivateConfig';
import { DiskManager } from '../fileaccess/DiskManager';

const LOG_TAG = '[GalleryManager]';

export class GalleryManager {
  public static parseRelativeDirePath(relativeDirectoryName: string): {
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
      relativeDirectoryName: string,
      knownLastModified?: number,
      knownLastScanned?: number
  ): Promise<ParentDirectoryDTO> {
    const directoryPath = GalleryManager.parseRelativeDirePath(
        relativeDirectoryName
    );

    const connection = await SQLConnection.getConnection();
    const dir = await this.getDirIdAndTime(connection, directoryPath.name, directoryPath.parent);


    if (dir && dir.lastScanned != null) {
      // Return as soon as possible without touching the original data source (hdd)
      // See https://github.com/bpatrik/pigallery2/issues/613
      if (
          Config.Indexing.reIndexingSensitivity ===
          ReIndexingSensitivity.never
      ) {
        return null;
      }

      const stat = fs.statSync(
          path.join(ProjectPath.ImageFolder, relativeDirectoryName)
      );
      const lastModified = DiskManager.calcLastModified(stat);

      // If it seems that the content did not change, do not work on it
      if (
          knownLastModified &&
          knownLastScanned &&
          lastModified === knownLastModified &&
          dir.lastScanned === knownLastScanned
      ) {
        if (
            Config.Indexing.reIndexingSensitivity ===
            ReIndexingSensitivity.low
        ) {
          return null;
        }
        if (
            Date.now() - dir.lastScanned <=
            Config.Indexing.cachedFolderTimeout &&
            Config.Indexing.reIndexingSensitivity ===
            ReIndexingSensitivity.medium
        ) {
          return null;
        }
      }

      if (dir.lastModified !== lastModified) {
        Logger.silly(
            LOG_TAG,
            'Reindexing reason: lastModified mismatch: known: ' +
            dir.lastModified +
            ', current:' +
            lastModified
        );
        const ret =
            await ObjectManagers.getInstance().IndexingManager.indexDirectory(
                relativeDirectoryName
            );
        for (const subDir of ret.directories) {
          if (!subDir.cover) {
            // if subdirectories do not have photos, so cannot show a cover, try getting one from DB
            await this.fillCoverForSubDir(connection, subDir);
          }
        }
        return ret;
      }

      // not indexed since a while, index it in a lazy manner
      if (
          (Date.now() - dir.lastScanned >
              Config.Indexing.cachedFolderTimeout &&
              Config.Indexing.reIndexingSensitivity >=
              ReIndexingSensitivity.medium) ||
          Config.Indexing.reIndexingSensitivity >=
          ReIndexingSensitivity.high
      ) {
        // on the fly reindexing

        Logger.silly(
            LOG_TAG,
            'lazy reindexing reason: cache timeout: lastScanned: ' +
            (Date.now() - dir.lastScanned) +
            'ms ago, cachedFolderTimeout:' +
            Config.Indexing.cachedFolderTimeout
        );
        ObjectManagers.getInstance()
            .IndexingManager.indexDirectory(relativeDirectoryName)
            .catch(console.error);
      }
      return await this.getParentDirFromId(connection, dir.id);
    }

    // never scanned (deep indexed), do it and return with it
    Logger.silly(LOG_TAG, 'Reindexing reason: never scanned');
    return ObjectManagers.getInstance().IndexingManager.indexDirectory(
        relativeDirectoryName
    );
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
    const directoryPath = GalleryManager.parseRelativeDirePath(
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
  public async fillCoverForSubDir(
      connection: Connection,
      dir: SubDirectoryDTO
  ): Promise<void> {
    if (!dir.validCover) {
      dir.cover =
          await ObjectManagers.getInstance().CoverManager.setAndGetCoverForDirectory(
              dir
          );
    }

    dir.media = [];
    dir.isPartial = true;
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
      partialDirId: number
  ): Promise<ParentDirectoryDTO> {
    const query = connection
        .getRepository(DirectoryEntity)
        .createQueryBuilder('directory')
        .where('directory.id = :id', {
          id: partialDirId
        })
        .leftJoinAndSelect('directory.directories', 'directories')
        .leftJoinAndSelect('directory.media', 'media')
        .leftJoinAndSelect('directories.cover', 'cover')
        .leftJoinAndSelect('cover.directory', 'coverDirectory')
        .select([
          'directory',
          'directories',
          'media',
          'cover.name',
          'coverDirectory.name',
          'coverDirectory.path',
        ]);

    // TODO: do better filtering
    // NOTE: it should not cause an issue as it also do not save to the DB
    if (
        Config.MetaFile.gpx === true ||
        Config.MetaFile.pg2conf === true ||
        Config.MetaFile.markdown === true
    ) {
      query.leftJoinAndSelect('directory.metaFile', 'metaFile');
    }

    const dir = await query.getOne();
    if (dir.directories) {
      for (const item of dir.directories) {
        await this.fillCoverForSubDir(connection, item);
      }
    }

    return dir;
  }
}
