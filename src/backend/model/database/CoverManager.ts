import {Config} from '../../../common/config/private/Config';
import {Brackets, SelectQueryBuilder, WhereExpression} from 'typeorm';
import {MediaEntity} from './enitites/MediaEntity';
import {DiskManager} from '../fileaccess/DiskManager';
import {ObjectManagers} from '../ObjectManagers';
import {DatabaseType} from '../../../common/config/private/PrivateConfig';
import {SQLConnection} from './SQLConnection';
import {SearchQueryDTO, SearchQueryTypes, TextSearch,} from '../../../common/entities/SearchQueryDTO';
import {DirectoryEntity} from './enitites/DirectoryEntity';
import {Utils} from '../../../common/Utils';
import {CoverPhotoDTO} from '../../../common/entities/PhotoDTO';
import {Logger} from '../../Logger';
import {SearchManager} from './SearchManager';
import {ExtensionDecorator} from '../extension/ExtensionDecorator';
import {SessionContext} from '../SessionContext';
import {ProjectedDirectoryCacheEntity} from './enitites/ProjectedDirectoryCacheEntity';
import {SortByTypes} from '../../../common/entities/SortingMethods';

const LOG_TAG = '[CoverManager]';

// ID is need within the backend so it can be saved to DB (ID is the external key)
export interface CoverPhotoDTOWithID extends CoverPhotoDTO {
  id: number;
}

export class CoverManager {
  private static DIRECTORY_SELECT = ['directory.name', 'directory.path'];

  /**
   * Applies the configured cover sorting and adds media.id as a tie-breaker,
   * so equally ranked media (e.g.: no rating) resolve to the same cover on every DB.
   * Without it, MySQL may return tied rows in any order.
   */
  private static setCoverSorting(query: SelectQueryBuilder<MediaEntity>): void {
    SearchManager.setSorting(query, Config.AlbumCover.Sorting);
    if (Config.AlbumCover.Sorting?.some(s => s.method === SortByTypes.Random)) {
      return;
    }
    query.addOrderBy('media.id', 'ASC');
  }


  public async resetCovers(): Promise<void> {
    const connection = await SQLConnection.getConnection();
    await connection
      .createQueryBuilder()
      .update(ProjectedDirectoryCacheEntity)
      .set({valid: false})
      .execute();
  }


  @ExtensionDecorator(e => e.gallery.CoverManager.getCoverForAlbum)
  public async getCoverForAlbum(
    session: SessionContext,
    album: {
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

      if (session.projectionQuery) {
        query.andWhere(session.projectionQuery);
      }

      CoverManager.setCoverSorting(query);
      return query;
    };
    let coverMedia = null;
    if (
      Config.AlbumCover.SearchQuery &&
      !Utils.equalsFilter(Config.AlbumCover.SearchQuery, {
        type: SearchQueryTypes.any_text,
        value: '',
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

  public async getPartialDirsWithoutCovers(projectionKeys?: string[]): Promise<
    { id: number; name: string; path: string }[]
  > {
    const connection = await SQLConnection.getConnection();
    const q = connection
      .getRepository(DirectoryEntity)
      .createQueryBuilder('directory')
      .leftJoin('directory.cache', 'cache')
      .where(new Brackets(qb => {
        qb.where('cache.valid = :valid', {valid: 0})
          .orWhere('cache.valid IS NULL');
      }));
    if (projectionKeys) {
      q.andWhere('cache.projectionKey IN (:...projectionKeys)', {projectionKeys});
    }
    return await q.select(['directory.name as name', 'directory.id as id', 'directory.path as path'])
      .distinct(true)
      .getRawMany();
  }

  @ExtensionDecorator(e => e.gallery.CoverManager.getCoverForDirectory)
  public async getCoverForDirectory(
    session: SessionContext,
    dir: {
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
      if (session.projectionQuery) {
        query.andWhere(session.projectionQuery);
      }

      CoverManager.setCoverSorting(query);
      return query;
    };

    let coverMedia: CoverPhotoDTOWithID = null;
    if (
      Config.AlbumCover.SearchQuery &&
      !Utils.equalsFilter(Config.AlbumCover.SearchQuery, {
        type: SearchQueryTypes.any_text,
        value: '',
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

}
