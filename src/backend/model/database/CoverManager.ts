import {Config} from '../../../common/config/private/Config';
import {Brackets, SelectQueryBuilder, WhereExpression} from 'typeorm';
import {MediaEntity} from './enitites/MediaEntity';
import {DiskManager} from '../fileaccess/DiskManager';
import {ObjectManagers} from '../ObjectManagers';
import {DatabaseType} from '../../../common/config/private/PrivateConfig';
import {SQLConnection} from './SQLConnection';
import {SearchQueryDTO, SearchQueryTypes, TextSearch,} from '../../../common/entities/SearchQueryDTO';
import {DirectoryEntity} from './enitites/DirectoryEntity';
import {ParentDirectoryDTO} from '../../../common/entities/DirectoryDTO';
import * as path from 'path';
import {Utils} from '../../../common/Utils';
import {CoverPhotoDTO} from '../../../common/entities/PhotoDTO';
import {IObjectManager} from './IObjectManager';
import {Logger} from '../../Logger';
import {SearchManager} from './SearchManager';
import {ExtensionDecorator} from '../extension/ExtensionDecorator';

const LOG_TAG = '[CoverManager]';

// ID is need within the backend so it can be saved to DB (ID is the external key)
export interface CoverPhotoDTOWithID extends CoverPhotoDTO {
  id: number;
}

export class CoverManager implements IObjectManager {
  private static DIRECTORY_SELECT = ['directory.name', 'directory.path'];


  public async resetCovers(): Promise<void> {
    const connection = await SQLConnection.getConnection();
    await connection
      .createQueryBuilder()
      .update(DirectoryEntity)
      .set({validCover: false})
      .execute();
  }

  @ExtensionDecorator(e => e.gallery.CoverManager.invalidateDirectoryCovers)
  protected async invalidateDirectoryCovers(dir: ParentDirectoryDTO) {
    // Invalidating Album cover
    let fullPath = DiskManager.normalizeDirPath(
      path.join(dir.path, dir.name)
    );
    const query = (await SQLConnection.getConnection())
      .createQueryBuilder()
      .update(DirectoryEntity)
      .set({validCover: false});

    let i = 0;
    const root = DiskManager.pathFromRelativeDirName('.');
    while (fullPath !== root) {
      const name = DiskManager.dirName(fullPath);
      const parentPath = DiskManager.pathFromRelativeDirName(fullPath);
      fullPath = parentPath;
      ++i;
      query.orWhere(
        new Brackets((q: WhereExpression) => {
          const param: { [key: string]: string } = {};
          param['name' + i] = name;
          param['path' + i] = parentPath;
          q.where(`path = :path${i}`, param);
          q.andWhere(`name = :name${i}`, param);
        })
      );
    }

    ++i;
    query.orWhere(
      new Brackets((q: WhereExpression) => {
        const param: { [key: string]: string } = {};
        param['name' + i] = DiskManager.dirName('.');
        param['path' + i] = DiskManager.pathFromRelativeDirName('.');
        q.where(`path = :path${i}`, param);
        q.andWhere(`name = :name${i}`, param);
      })
    );

    await query.execute();
  }

  public async onNewDataVersion(changedDir: ParentDirectoryDTO): Promise<void> {
    await this.invalidateDirectoryCovers(changedDir);
  }

  @ExtensionDecorator(e => e.gallery.CoverManager.getCoverForAlbum)
  public async getCoverForAlbum(album: {
    searchQuery: SearchQueryDTO;
  }): Promise<CoverPhotoDTOWithID> {
    const albumQuery: Brackets = await
      ObjectManagers.getInstance().SearchManager.prepareAndBuildWhereQuery(album.searchQuery);
    const connection = await SQLConnection.getConnection();

    const coverQuery = (): SelectQueryBuilder<MediaEntity> => {
      const query = connection
        .getRepository(MediaEntity)
        .createQueryBuilder('media')
        .innerJoin('media.directory', 'directory')
        .select(['media.name', 'media.id', ...CoverManager.DIRECTORY_SELECT])
        .where(albumQuery);
      SearchManager.setSorting(query, Config.AlbumCover.Sorting);
      return query;
    };
    let coverMedia = null;
    if (
      Config.AlbumCover.SearchQuery &&
      !Utils.equalsFilter(Config.AlbumCover.SearchQuery, {
        type: SearchQueryTypes.any_text,
        text: '',
      } as TextSearch)
    ) {
      try {
        const coverFilterQuery = await
          ObjectManagers.getInstance().SearchManager.prepareAndBuildWhereQuery(Config.AlbumCover.SearchQuery);
        coverMedia = await coverQuery()
          .andWhere(coverFilterQuery)
          .limit(1)
          .getOne();
      } catch (e) {
        Logger.error(LOG_TAG, 'Cant get album cover using:', JSON.stringify(album.searchQuery), JSON.stringify(Config.AlbumCover.SearchQuery));
        throw e;
      }
    }

    if (!coverMedia) {
      try {
        coverMedia = await coverQuery().limit(1).getOne();
      } catch (e) {
        Logger.error(LOG_TAG, 'Cant get album cover using:', JSON.stringify(album.searchQuery));
        throw e;
      }
    }
    return coverMedia || null;
  }

  public async getPartialDirsWithoutCovers(): Promise<
    { id: number; name: string; path: string }[]
  > {
    const connection = await SQLConnection.getConnection();
    return await connection
      .getRepository(DirectoryEntity)
      .createQueryBuilder('directory')
      .where('directory.validCover = :validCover', {validCover: 0}) // 0 === false
      .select(['name', 'id', 'path'])
      .getRawMany();
  }

  @ExtensionDecorator(e => e.gallery.CoverManager.getCoverForDirectory)
  protected async getCoverForDirectory(dir: {
    id: number;
    name: string;
    path: string;
  }) {
    const connection = await SQLConnection.getConnection();
    const coverQuery = (): SelectQueryBuilder<MediaEntity> => {
      const query = connection
        .getRepository(MediaEntity)
        .createQueryBuilder('media')
        .innerJoin('media.directory', 'directory')
        .select(['media.name', 'media.id', ...CoverManager.DIRECTORY_SELECT])
        .where(
          new Brackets((q: WhereExpression) => {
            q.where('media.directory = :dir', {
              dir: dir.id,
            });
            if (Config.Database.type === DatabaseType.mysql) {
              q.orWhere('directory.path like :path || \'%\'', {
                path: DiskManager.pathFromParent(dir),
              });
            } else {
              q.orWhere('directory.path GLOB :path', {
                path: DiskManager.pathFromParent(dir)
                  // glob escaping. see https://github.com/bpatrik/pigallery2/issues/621
                  .replaceAll('[', '[[]') + '*',
              });
            }
          })
        );
      // Select from the directory if any otherwise from any subdirectories.
      // (There is no priority between subdirectories)
      query.orderBy(
        `CASE WHEN directory.id = ${dir.id} THEN 0 ELSE 1 END`,
        'ASC'
      );

      SearchManager.setSorting(query, Config.AlbumCover.Sorting);
      return query;
    };

    let coverMedia: CoverPhotoDTOWithID = null;
    if (
      Config.AlbumCover.SearchQuery &&
      !Utils.equalsFilter(Config.AlbumCover.SearchQuery, {
        type: SearchQueryTypes.any_text,
        text: '',
      } as TextSearch)
    ) {
      coverMedia = await coverQuery()
        .andWhere(
          await ObjectManagers.getInstance().SearchManager.prepareAndBuildWhereQuery(Config.AlbumCover.SearchQuery)
        )
        .limit(1)
        .getOne();
    }

    if (!coverMedia) {
      coverMedia = await coverQuery().limit(1).getOne();
    }
    return coverMedia;
  }

  public async setAndGetCoverForDirectory(dir: {
    id: number;
    name: string;
    path: string;
  }): Promise<CoverPhotoDTOWithID> {
    const connection = await SQLConnection.getConnection();
    const coverMedia = await this.getCoverForDirectory(dir);

    // set validCover bit to true even if there is no cover (to prevent future updates)
    await connection
      .createQueryBuilder()
      .update(DirectoryEntity)
      .set({cover: coverMedia, validCover: true})
      .where('id = :dir', {
        dir: dir.id,
      })
      .execute();

    return coverMedia || null;
  }
}
