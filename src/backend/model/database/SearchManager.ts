/* eslint-disable no-case-declarations */
import {AutoCompleteItem} from '../../../common/entities/AutoCompleteItem';
import {SearchResultDTO} from '../../../common/entities/SearchResultDTO';
import {SQLConnection} from './SQLConnection';
import {PhotoEntity} from './enitites/PhotoEntity';
import {DirectoryEntity} from './enitites/DirectoryEntity';
import {MediaEntity} from './enitites/MediaEntity';
import {PersonEntry} from './enitites/person/PersonEntry';
import {Brackets, SelectQueryBuilder, WhereExpression} from 'typeorm';
import {Config} from '../../../common/config/private/Config';
import {
  ANDSearchQuery,
  DatePatternFrequency,
  DatePatternSearch,
  DistanceSearch,
  NegatableSearchQuery,
  OrientationSearch,
  ORSearchQuery,
  RangeSearch,
  SearchListQuery,
  SearchQueryDTO,
  SearchQueryTypes,
  SomeOfSearchQuery,
  TextSearch,
  TextSearchQueryMatchTypes,
  TextSearchQueryTypes,
} from '../../../common/entities/SearchQueryDTO';
import {GalleryManager} from './GalleryManager';
import {ObjectManagers} from '../ObjectManagers';
import {DatabaseType} from '../../../common/config/private/PrivateConfig';
import {Utils} from '../../../common/Utils';
import {FileEntity} from './enitites/FileEntity';
import {SQL_COLLATE} from './enitites/EntityUtils';
import {GroupSortByTypes, SortByTypes, SortingMethod} from '../../../common/entities/SortingMethods';
import {SessionContext} from '../SessionContext';

export class SearchManager {
  private DIRECTORY_SELECT = [
    'directory.id',
    'directory.name',
    'directory.path',
  ];
  // makes all search query params unique, so typeorm won't mix them
  private queryIdBase = 0;

  public static setSorting<T>(
    query: SelectQueryBuilder<T>,
    sortings: SortingMethod[]
  ): SelectQueryBuilder<T> {
    if (!sortings || !Array.isArray(sortings)) {
      return query;
    }
    if (sortings.findIndex(s => s.method == SortByTypes.Random) !== -1 && sortings.length > 1) {
      throw new Error('Error during applying sorting: Can\' randomize and also sort the result. Bad input:' + sortings.map(s => GroupSortByTypes[s.method]).join(', '));
    }
    for (const sort of sortings) {
      switch (sort.method) {
        case SortByTypes.Date:
          if (Config.Gallery.ignoreTimestampOffset === true) {
            query.addOrderBy('media.metadata.creationDate + (coalesce(media.metadata.creationDateOffset,0) * 60000)', sort.ascending ? 'ASC' : 'DESC');
          } else {
            query.addOrderBy('media.metadata.creationDate', sort.ascending ? 'ASC' : 'DESC');
          }
          break;
        case SortByTypes.Rating:
          query.addOrderBy('media.metadata.rating', sort.ascending ? 'ASC' : 'DESC');
          break;
        case SortByTypes.Name:
          query.addOrderBy('media.name', sort.ascending ? 'ASC' : 'DESC');
          break;
        case SortByTypes.PersonCount:
          query.addOrderBy('media.metadata.personsLength', sort.ascending ? 'ASC' : 'DESC');
          break;
        case SortByTypes.FileSize:
          query.addOrderBy('media.metadata.fileSize', sort.ascending ? 'ASC' : 'DESC');
          break;
        case SortByTypes.Random:
          if (Config.Database.type === DatabaseType.mysql) {
            query.groupBy('RAND(), media.id');
          } else {
            query.groupBy('RANDOM()');
          }
          break;
      }
    }

    return query;
  }

  private static autoCompleteItemsUnique(
    array: Array<AutoCompleteItem>
  ): Array<AutoCompleteItem> {
    const a = array.concat();
    for (let i = 0; i < a.length; ++i) {
      for (let j = i + 1; j < a.length; ++j) {
        if (a[i].equals(a[j])) {
          a.splice(j--, 1);
        }
      }
    }

    return a;
  }

  async autocomplete(
    session: SessionContext,
    value: string,
    type: SearchQueryTypes
  ): Promise<AutoCompleteItem[]> {
    const connection = await SQLConnection.getConnection();

    const photoRepository = connection.getRepository(PhotoEntity);
    const mediaRepository = connection.getRepository(MediaEntity);
    const personRepository = connection.getRepository(PersonEntry);
    const directoryRepository = connection.getRepository(DirectoryEntity);

    const partialResult: AutoCompleteItem[][] = [];

    if (
      type === SearchQueryTypes.any_text ||
      type === SearchQueryTypes.keyword
    ) {
      const acList: AutoCompleteItem[] = [];
      const q = photoRepository
        .createQueryBuilder('media')
        .select('DISTINCT(media.metadata.keywords)')
        .where('media.metadata.keywords LIKE :valueKW COLLATE ' + SQL_COLLATE, {
          valueKW: '%' + value + '%',
        });

      if (session.projectionQuery) {
        if (session.hasDirectoryProjection) {
          q.leftJoin('media.directory', 'directory');
        }
        q.andWhere(session.projectionQuery);
      }

      q.limit(Config.Search.AutoComplete.ItemsPerCategory.keyword);
      (await q.getRawMany())
        .map(
          (r): Array<string> =>
            (r.metadataKeywords as string).split(',') as Array<string>
        )
        .forEach((keywords): void => {
          acList.push(
            ...this.encapsulateAutoComplete(
              keywords.filter(
                (k): boolean =>
                  k.toLowerCase().indexOf(value.toLowerCase()) !== -1
              ),
              SearchQueryTypes.keyword
            )
          );
        });
      partialResult.push(acList);
    }

    if (
      type === SearchQueryTypes.any_text ||
      type === SearchQueryTypes.person
    ) {
      // make sure all persons have up-to-date cache
      await ObjectManagers.getInstance().PersonManager.getAll(session);
      partialResult.push(
        this.encapsulateAutoComplete(
          (
            await personRepository
              .createQueryBuilder('person')
              .select('DISTINCT(person.name), cache.count')
              .leftJoin('person.cache', 'cache', 'cache.projectionKey = :pk', {pk: session.user.projectionKey})
              .where('person.name LIKE :value COLLATE ' + SQL_COLLATE, {
                value: '%' + value + '%',
              })
              .andWhere('cache.count > 0 AND cache.valid = 1')
              .limit(
                Config.Search.AutoComplete.ItemsPerCategory.person
              )
              .orderBy('cache.count', 'DESC')
              .getRawMany()
          ).map((r) => r.name),
          SearchQueryTypes.person
        )
      );
    }

    if (
      type === SearchQueryTypes.any_text ||
      type === SearchQueryTypes.position ||
      type === SearchQueryTypes.distance
    ) {
      const acList: AutoCompleteItem[] = [];
      const q = photoRepository
        .createQueryBuilder('media')
        .select(
          'media.metadata.positionData.country as country, ' +
          'media.metadata.positionData.state as state, media.metadata.positionData.city as city'
        );
      const b = new Brackets((q) => {
        q.where(
          'media.metadata.positionData.country LIKE :value COLLATE ' +
          SQL_COLLATE,
          {value: '%' + value + '%'}
        ).orWhere(
          'media.metadata.positionData.state LIKE :value COLLATE ' +
          SQL_COLLATE,
          {value: '%' + value + '%'}
        ).orWhere(
          'media.metadata.positionData.city LIKE :value COLLATE ' +
          SQL_COLLATE,
          {value: '%' + value + '%'}
        );
      });
      q.where(b);

      if (session.projectionQuery) {
        if (session.hasDirectoryProjection) {
          q.leftJoin('media.directory', 'directory');
        }
        q.andWhere(session.projectionQuery);
      }

      q.groupBy(
        'media.metadata.positionData.country, media.metadata.positionData.state, media.metadata.positionData.city'
      )
        .limit(Config.Search.AutoComplete.ItemsPerCategory.position);
      (

        await q.getRawMany()
      )
        .filter((pm): boolean => !!pm)
        .map(
          (pm): Array<string> =>
            [pm.city || '', pm.country || '', pm.state || ''] as Array<string>
        )
        .forEach((positions): void => {
          acList.push(
            ...this.encapsulateAutoComplete(
              positions.filter(
                (p): boolean =>
                  p.toLowerCase().indexOf(value.toLowerCase()) !== -1
              ),
              type === SearchQueryTypes.distance
                ? type
                : SearchQueryTypes.position
            )
          );
        });
      partialResult.push(acList);
    }

    if (
      type === SearchQueryTypes.any_text ||
      type === SearchQueryTypes.file_name
    ) {
      const q = mediaRepository
        .createQueryBuilder('media')
        .select('DISTINCT(media.name)')
        .where('media.name LIKE :value COLLATE ' + SQL_COLLATE, {
          value: '%' + value + '%',
        });


      if (session.projectionQuery) {
        if (session.hasDirectoryProjection) {
          q.leftJoin('media.directory', 'directory');
        }
        q.andWhere(session.projectionQuery);
      }
      q.limit(
        Config.Search.AutoComplete.ItemsPerCategory.fileName
      );
      partialResult.push(
        this.encapsulateAutoComplete(
          (
            await q.getRawMany()
          ).map((r) => r.name),
          SearchQueryTypes.file_name
        )
      );
    }

    if (
      type === SearchQueryTypes.any_text ||
      type === SearchQueryTypes.caption
    ) {
      const q = photoRepository
        .createQueryBuilder('media')
        .select('DISTINCT(media.metadata.caption) as caption')
        .where(
          'media.metadata.caption LIKE :value COLLATE ' + SQL_COLLATE,
          {value: '%' + value + '%'}
        );

      if (session.projectionQuery) {
        if (session.hasDirectoryProjection) {
          q.leftJoin('media.directory', 'directory');
        }
        q.andWhere(session.projectionQuery);
      }
      q.limit(
        Config.Search.AutoComplete.ItemsPerCategory.caption
      );
      partialResult.push(
        this.encapsulateAutoComplete(
          (
            await q.getRawMany()
          ).map((r) => r.caption),
          SearchQueryTypes.caption
        )
      );
    }

    if (
      type === SearchQueryTypes.any_text ||
      type === SearchQueryTypes.directory
    ) {
      const dirs = await directoryRepository
        .createQueryBuilder('directory')
        .leftJoinAndSelect('directory.cache', 'cache', 'cache.projectionKey = :pk AND cache.valid = 1', {pk: session.user.projectionKey})
        .where('directory.name LIKE :value COLLATE ' + SQL_COLLATE, {
          value: '%' + value + '%',
        })
        .andWhere('(cache.recursiveMediaCount > 0 OR cache.id is NULL)')
        .limit(
          Config.Search.AutoComplete.ItemsPerCategory.directory
        )
        .getMany();
      // fill cache as we need it for this autocomplete search
      for (const dir of dirs) {
        if (!dir.cache?.valid) {
          dir.cache = await ObjectManagers.getInstance().ProjectedCacheManager.setAndGetCacheForDirectory(connection, session, dir);
        }
      }
      partialResult.push(
        this.encapsulateAutoComplete(
          dirs.filter(d => d.cache.valid && d.cache.recursiveMediaCount > 0).map((r) => r.name),
          SearchQueryTypes.directory
        )
      );
    }

    const result: AutoCompleteItem[] = [];

    while (result.length < Config.Search.AutoComplete.ItemsPerCategory.maxItems) {
      let adding = false;
      for (let i = 0; i < partialResult.length; ++i) {
        if (partialResult[i].length <= 0) {
          continue;
        }
        result.push(partialResult[i].shift()); // first elements are more important
        adding = true;
      }
      if (!adding) {
        break;
      }
    }


    return SearchManager.autoCompleteItemsUnique(result);
  }

  async search(session: SessionContext, queryIN: SearchQueryDTO): Promise<SearchResultDTO> {
    const query = await this.prepareQuery(queryIN);
    const connection = await SQLConnection.getConnection();

    const result: SearchResultDTO = {
      searchQuery: queryIN,
      directories: [],
      media: [],
      metaFile: [],
      resultOverflow: false,
    };

    const q = connection
      .getRepository(MediaEntity)
      .createQueryBuilder('media')
      .select(['media', ...this.DIRECTORY_SELECT])
      .where(this.buildWhereQuery(query))
      .leftJoin('media.directory', 'directory')
      .limit(Config.Search.maxMediaResult + 1);

    if (session.projectionQuery) {
      q.andWhere(session.projectionQuery);
    }

    result.media = await q.getMany();

    if (result.media.length > Config.Search.maxMediaResult) {
      result.resultOverflow = true;
    }


    if (Config.Search.listMetafiles === true) {
      const dIds = Array.from(new Set(result.media.map(m => (m.directory as unknown as { id: number }).id)));
      result.metaFile = [];
      if (dIds.length > 0) {
        result.metaFile = await connection
          .getRepository(FileEntity)
          .createQueryBuilder('file')
          .select(['file', ...this.DIRECTORY_SELECT])
          .where(`file.directoryId IN(${dIds})`)
          .leftJoin('file.directory', 'directory')
          .getMany();
      }
    }

    if (Config.Search.listDirectories === true) {
      const dirQuery = this.filterDirectoryQuery(query);
      if (dirQuery !== null) {
        result.directories = await connection
          .getRepository(DirectoryEntity)
          .createQueryBuilder('directory')
          .where(this.buildWhereQuery(dirQuery, true))
          .leftJoin('directory.cache', 'cache', 'cache.projectionKey = :pk AND cache.valid = 1', {pk: session.user.projectionKey})
          .leftJoin('cache.cover', 'cover')
          .leftJoin('cover.directory', 'coverDirectory')
          .limit(Config.Search.maxDirectoryResult + 1)
          .select([
            'directory',
            'cache.valid',
            'cache.oldestMedia',
            'cache.youngestMedia',
            'cache.mediaCount',
            'cache.recursiveMediaCount',
            'cover.name',
            'coverDirectory.name',
            'coverDirectory.path',
          ])
          .getMany();

        // setting covers
        if (result.directories) {
          for (const item of result.directories) {
            await ObjectManagers.getInstance().GalleryManager.fillCacheForSubDir(connection, session, item as DirectoryEntity);
          }
        }
        // do not show empty directories in search results
        result.directories = result.directories.filter(d => d.cache.recursiveMediaCount > 0);
        if (
          result.directories.length > Config.Search.maxDirectoryResult
        ) {
          result.resultOverflow = true;
        }
      }
    }

    return result;
  }

  public async getNMedia(session: SessionContext, query: SearchQueryDTO, sortings: SortingMethod[], take: number, photoOnly = false) {
    const connection = await SQLConnection.getConnection();
    const sqlQuery: SelectQueryBuilder<PhotoEntity> = connection
      .getRepository(photoOnly ? PhotoEntity : MediaEntity)
      .createQueryBuilder('media')
      .select(['media', ...this.DIRECTORY_SELECT])
      .innerJoin('media.directory', 'directory')
      .where(await this.prepareAndBuildWhereQuery(query));

    if (session.projectionQuery) {
      sqlQuery.andWhere(session.projectionQuery);
    }
    SearchManager.setSorting(sqlQuery, sortings);

    return sqlQuery.limit(take).getMany();

  }

  public async getCount(session: SessionContext, query: SearchQueryDTO): Promise<number> {
    const connection = await SQLConnection.getConnection();

    const q = connection
      .getRepository(MediaEntity)
      .createQueryBuilder('media')
      .innerJoin('media.directory', 'directory')
      .where(await this.prepareAndBuildWhereQuery(query));
    if (session.projectionQuery) {
      q.andWhere(session.projectionQuery);
    }
    return await q.getCount();
  }

  public async prepareAndBuildWhereQuery(
    queryIN: SearchQueryDTO, directoryOnly = false,
    aliases: { [key: string]: string } = {}): Promise<Brackets> {
    let query = await this.prepareQuery(queryIN);
    if (directoryOnly) {
      query = this.filterDirectoryQuery(query);
      if (query === null) {
        return null;
      }
    }
    return this.buildWhereQuery(query, directoryOnly, aliases);
  }

  public async prepareQuery(queryIN: SearchQueryDTO): Promise<SearchQueryDTO> {
    let query: SearchQueryDTO = this.assignQueryIDs(Utils.clone(queryIN)); // assign local ids before flattening SOME_OF queries
    query = this.flattenSameOfQueries(query);
    query = await this.getGPSData(query);
    return query;
  }

  /**
   * Builds the SQL Where query from search query
   * @param query input search query
   * @param directoryOnly Only builds directory related queries
   * @param aliases for SQL alias mapping
   * @private
   */
  public buildWhereQuery(
    query: SearchQueryDTO,
    directoryOnly = false,
    aliases: { [key: string]: string } = {}
  ): Brackets {
    const queryId = (query as SearchQueryDTOWithID).queryId;
    switch (query.type) {
      case SearchQueryTypes.AND:
        return new Brackets((q): unknown => {
          (query as ANDSearchQuery).list.forEach((sq) => {
              q.andWhere(this.buildWhereQuery(sq, directoryOnly));
            }
          );
          return q;
        });
      case SearchQueryTypes.OR:
        return new Brackets((q): unknown => {
          (query as ANDSearchQuery).list.forEach((sq) => {
              q.orWhere(this.buildWhereQuery(sq, directoryOnly));
            }
          );
          return q;
        });

      case SearchQueryTypes.distance:
        if (directoryOnly) {
          throw new Error('not supported in directoryOnly mode');
        }
        /**
         * This is a best effort calculation, not fully accurate in order to have higher performance.
         * see: https://stackoverflow.com/a/50506609
         */
        const earth = 6378.137; // radius of the earth in kilometer
        const latDelta = 1 / (((2 * Math.PI) / 360) * earth); // 1 km in degree
        const lonDelta = 1 / (((2 * Math.PI) / 360) * earth); // 1 km in degree

        // TODO: properly handle latitude / longitude boundaries
        const trimRange = (value: number, min: number, max: number): number => {
          return Math.min(Math.max(value, min), max);
        };

        const minLat = trimRange(
          (query as DistanceSearch).from.GPSData.latitude -
          (query as DistanceSearch).distance * latDelta,
          -90,
          90
        );
        const maxLat = trimRange(
          (query as DistanceSearch).from.GPSData.latitude +
          (query as DistanceSearch).distance * latDelta,
          -90,
          90
        );
        const minLon = trimRange(
          (query as DistanceSearch).from.GPSData.longitude -
          ((query as DistanceSearch).distance * lonDelta) /
          Math.cos(minLat * (Math.PI / 180)),
          -180,
          180
        );
        const maxLon = trimRange(
          (query as DistanceSearch).from.GPSData.longitude +
          ((query as DistanceSearch).distance * lonDelta) /
          Math.cos(maxLat * (Math.PI / 180)),
          -180,
          180
        );

        return new Brackets((q): unknown => {
          const textParam: { [key: string]: number | string } = {};
          textParam['maxLat' + queryId] = maxLat;
          textParam['minLat' + queryId] = minLat;
          textParam['maxLon' + queryId] = maxLon;
          textParam['minLon' + queryId] = minLon;
          if (!(query as DistanceSearch).negate) {
            q.where(
              `media.metadata.positionData.GPSData.latitude < :maxLat${queryId}`,
              textParam
            );
            q.andWhere(
              `media.metadata.positionData.GPSData.latitude > :minLat${queryId}`,
              textParam
            );
            q.andWhere(
              `media.metadata.positionData.GPSData.longitude < :maxLon${queryId}`,
              textParam
            );
            q.andWhere(
              `media.metadata.positionData.GPSData.longitude > :minLon${queryId}`,
              textParam
            );
          } else {
            q.where(
              `media.metadata.positionData.GPSData.latitude > :maxLat${queryId}`,
              textParam
            );
            q.orWhere(
              `media.metadata.positionData.GPSData.latitude < :minLat${queryId}`,
              textParam
            );
            q.orWhere(
              `media.metadata.positionData.GPSData.longitude > :maxLon${queryId}`,
              textParam
            );
            q.orWhere(
              `media.metadata.positionData.GPSData.longitude < :minLon${queryId}`,
              textParam
            );
          }
          return q;
        });

      case SearchQueryTypes.rating:
      case SearchQueryTypes.date:
      case SearchQueryTypes.person_count:
      case SearchQueryTypes.resolution:
        if (directoryOnly) {
          throw new Error('not supported in directoryOnly mode');
        }
        if (typeof (query as RangeSearch).min === 'undefined' && typeof (query as RangeSearch).max === 'undefined') {
          throw new Error(
            `Invalid search query: ${SearchQueryTypes[query.type]}(type: ${query.type}) query should contain min or max value. Query got: ${JSON.stringify(query)}`
          );
        }

        let field = '';
        let timeOffset = '';
        let min = (query as RangeSearch).min;
        let max = (query as RangeSearch).max;

        switch (query.type) {
          case SearchQueryTypes.date:
            timeOffset = Config.Gallery.ignoreTimestampOffset === true ? ' + (coalesce(media.metadata.creationDateOffset,0) * 60000)' : '';
            field = 'media.metadata.creationDate';
            break;

          case SearchQueryTypes.rating:
            field = 'media.metadata.rating';
            break;

          case SearchQueryTypes.person_count:
            field = 'media.metadata.personsLength';
            break;

          case SearchQueryTypes.resolution:
            field = 'media.metadata.size.width * media.metadata.size.height';
            if (min) {
              min *= 1000 * 1000;
            }
            if (max) {
              max *= 1000 * 1000;
            }
            break;
        }


        return new Brackets((q): unknown => {


          const textParam: { [key: string]: unknown } = {};
          if (min === max) {
            textParam['eql' + queryId] = min;
            q.where(
              `${field} ${timeOffset} = :eql${queryId}`,
              textParam
            );
            return q;
          }
          const minRelation = (query as NegatableSearchQuery).negate ? '<' : '>=';
          const maxRelation = (query as NegatableSearchQuery).negate ? '>' : '<=';

          if (typeof min !== 'undefined') {
            textParam['min' + queryId] = min;
            q.where(
              `${field} ${timeOffset} ${minRelation} :min${queryId}`,
              textParam
            );
          }
          if (typeof max !== 'undefined') {
            textParam['max' + queryId] = max;
            q.andWhere(
              `${field} ${timeOffset} ${maxRelation} :max${queryId}`,
              textParam
            );
          }

          return q;
        });

      case SearchQueryTypes.orientation:
        if (directoryOnly) {
          throw new Error('not supported in directoryOnly mode');
        }
        return new Brackets((q): unknown => {
          if ((query as OrientationSearch).landscape) {
            q.where('media.metadata.size.width >= media.metadata.size.height');
          } else {
            q.where('media.metadata.size.width <= media.metadata.size.height');
          }
          return q;
        });

      case SearchQueryTypes.date_pattern: {
        if (directoryOnly) {
          throw new Error('not supported in directoryOnly mode');
        }
        const tq = query as DatePatternSearch;

        return new Brackets((q): unknown => {
          // Fixed frequency
          if ((tq.frequency === DatePatternFrequency.years_ago ||
            tq.frequency === DatePatternFrequency.months_ago ||
            tq.frequency === DatePatternFrequency.weeks_ago ||
            tq.frequency === DatePatternFrequency.days_ago)) {

            if (isNaN(tq.agoNumber)) {
              throw new Error('ago number is missing on date pattern search query with frequency: ' + DatePatternFrequency[tq.frequency] + ', ago number: ' + tq.agoNumber);
            }
            const to = new Date();
            to.setHours(0, 0, 0, 0);
            to.setUTCDate(to.getUTCDate() + 1);

            switch (tq.frequency) {
              case DatePatternFrequency.days_ago:
                to.setUTCDate(to.getUTCDate() - tq.agoNumber);
                break;
              case DatePatternFrequency.weeks_ago:
                to.setUTCDate(to.getUTCDate() - tq.agoNumber * 7);
                break;

              case DatePatternFrequency.months_ago:
                to.setTime(Utils.addMonthToDate(to, -1 * tq.agoNumber).getTime());
                break;

              case DatePatternFrequency.years_ago:
                to.setUTCFullYear(to.getUTCFullYear() - tq.agoNumber);
                break;
            }
            const from = new Date(to);
            from.setUTCDate(from.getUTCDate() - tq.daysLength);

            const textParam: { [key: string]: unknown } = {};
            textParam['to' + queryId] = to.getTime();
            textParam['from' + queryId] = from.getTime();
            if (tq.negate) {
              if (Config.Gallery.ignoreTimestampOffset === true) {
                q.where(
                  `(media.metadata.creationDate + (coalesce(media.metadata.creationDateOffset,0) * 60000)) >= :to${queryId}`,
                  textParam
                ).orWhere(`(media.metadata.creationDate + (coalesce(media.metadata.creationDateOffset,0) * 60000)) < :from${queryId}`,
                  textParam);
              } else {
                q.where(
                  `media.metadata.creationDate >= :to${queryId}`,
                  textParam
                ).orWhere(`media.metadata.creationDate < :from${queryId}`,
                  textParam);

              }
            } else {
              if (Config.Gallery.ignoreTimestampOffset === true) {
                q.where(
                  `(media.metadata.creationDate + (coalesce(media.metadata.creationDateOffset,0) * 60000)) < :to${queryId}`,
                  textParam
                ).andWhere(`(media.metadata.creationDate + (coalesce(media.metadata.creationDateOffset,0) * 60000)) >= :from${queryId}`,
                  textParam);
              } else {
                q.where(
                  `media.metadata.creationDate < :to${queryId}`,
                  textParam
                ).andWhere(`media.metadata.creationDate >= :from${queryId}`,
                  textParam);
              }
            }

          } else {
            // recurring

            const textParam: { [key: string]: unknown } = {};
            textParam['diff' + queryId] = tq.daysLength;
            const addWhere = (duration: string, crossesDateBoundary: boolean) => {

              const relationEql = tq.negate ? '!=' : '=';

              // reminder: !(a&&b) = (!a || !b), that is what happening here if negate is true
              const relationTop = tq.negate ? '>' : '<=';
              const relationBottom = tq.negate ? '<=' : '>';
              // this is an XoR. during date boundary crossing we swap boolean logic again
              const whereFN = !!tq.negate !== crossesDateBoundary ? 'orWhere' : 'andWhere';


              if (Config.Database.type === DatabaseType.sqlite) {
                if (tq.daysLength == 0) {
                  if (Config.Gallery.ignoreTimestampOffset === true) {
                    q.where(
                      `CAST(strftime('${duration}',(media.metadataCreationDate + (media.metadataCreationDateOffset * 60000))/1000, 'unixepoch') AS INTEGER) ${relationEql} CAST(strftime('${duration}','now') AS INTEGER)`
                    );
                  } else {
                    q.where(
                      `CAST(strftime('${duration}',media.metadataCreationDate/1000, 'unixepoch') AS INTEGER) ${relationEql} CAST(strftime('${duration}','now') AS INTEGER)`
                    );
                  }
                } else {
                  if (Config.Gallery.ignoreTimestampOffset === true) {
                    q.where(
                      `CAST(strftime('${duration}',(media.metadataCreationDate + (media.metadataCreationDateOffset * 60000))/1000, 'unixepoch') AS INTEGER) ${relationTop} CAST(strftime('${duration}','now') AS INTEGER)`
                    )[whereFN](`CAST(strftime('${duration}',(media.metadataCreationDate + (media.metadataCreationDateOffset * 60000))/1000, 'unixepoch') AS INTEGER) ${relationBottom} CAST(strftime('${duration}','now','-:diff${queryId} day') AS INTEGER)`,
                      textParam);
                  } else {
                    q.where(
                      `CAST(strftime('${duration}',media.metadataCreationDate/1000, 'unixepoch') AS INTEGER) ${relationTop} CAST(strftime('${duration}','now') AS INTEGER)`
                    )[whereFN](`CAST(strftime('${duration}',media.metadataCreationDate/1000, 'unixepoch') AS INTEGER) ${relationBottom} CAST(strftime('${duration}','now','-:diff${queryId} day') AS INTEGER)`,
                      textParam);
                  }
                }
              } else {
                if (tq.daysLength == 0) {
                  if (Config.Gallery.ignoreTimestampOffset === true) {
                    q.where(
                      `CAST(FROM_UNIXTIME((media.metadataCreationDate + (media.metadataCreationDateOffset * 60000))/1000, '${duration}') AS SIGNED) ${relationEql} CAST(DATE_FORMAT(CURDATE(),'${duration}') AS SIGNED)`
                    );
                  } else {
                    q.where(
                      `CAST(FROM_UNIXTIME(media.metadataCreationDate/1000, '${duration}') AS SIGNED) ${relationEql} CAST(DATE_FORMAT(CURDATE(),'${duration}') AS SIGNED)`
                    );
                  }
                } else {
                  if (Config.Gallery.ignoreTimestampOffset === true) {
                    q.where(
                      `CAST(FROM_UNIXTIME((media.metadataCreationDate + (media.metadataCreationDateOffset * 60000))/1000, '${duration}') AS SIGNED) ${relationTop} CAST(DATE_FORMAT(CURDATE(),'${duration}') AS SIGNED)`
                    )[whereFN](`CAST(FROM_UNIXTIME((media.metadataCreationDate + (media.metadataCreationDateOffset * 60000))/1000, '${duration}') AS SIGNED) ${relationBottom} CAST(DATE_FORMAT((DATE_ADD(curdate(), INTERVAL -:diff${queryId} DAY)),'${duration}') AS SIGNED)`,
                      textParam);
                  } else {
                    q.where(
                      `CAST(FROM_UNIXTIME(media.metadataCreationDate/1000, '${duration}') AS SIGNED) ${relationTop} CAST(DATE_FORMAT(CURDATE(),'${duration}') AS SIGNED)`
                    )[whereFN](`CAST(FROM_UNIXTIME(media.metadataCreationDate/1000, '${duration}') AS SIGNED) ${relationBottom} CAST(DATE_FORMAT((DATE_ADD(curdate(), INTERVAL -:diff${queryId} DAY)),'${duration}') AS SIGNED)`,
                      textParam);
                  }
                }
              }
            };
            switch (tq.frequency) {
              case DatePatternFrequency.every_year:
                const d = new Date();
                if (tq.daysLength >= (Utils.isDateFromLeapYear(d) ? 366 : 365)) { // trivial result includes all photos
                  if (tq.negate) {
                    q.andWhere('FALSE');
                  }
                  return q;
                }

                const dayOfYear = Utils.getDayOfYear(d);
                addWhere('%m%d', dayOfYear - tq.daysLength < 0);
                break;
              case DatePatternFrequency.every_month:
                if (tq.daysLength >= 31) { // trivial result includes all photos
                  if (tq.negate) {
                    q.andWhere('FALSE');
                  }
                  return q;
                }
                addWhere('%d', (new Date()).getUTCDate() - tq.daysLength < 0);
                break;
              case DatePatternFrequency.every_week:
                if (tq.daysLength >= 7) { // trivial result includes all photos
                  if (tq.negate) {
                    q.andWhere('FALSE');
                  }
                  return q;
                }
                addWhere('%w', (new Date()).getUTCDay() - tq.daysLength < 0);
                break;
            }


          }

          return q;
        });
      }

      case SearchQueryTypes.SOME_OF:
        throw new Error('Some of not supported');
    }


    if (!TextSearchQueryTypes.includes(query.type)) {
      throw new Error(
        `Invalid search query: Unknown query type: ${SearchQueryTypes[query.type]}(type: ${query.type})`
      );
    }

    if (typeof (query as TextSearch).value === 'undefined') {
      throw new Error(
        `Invalid search query: ${SearchQueryTypes[query.type]}(type: ${query.type}) query should contain 'value' property. Query got: ${JSON.stringify(query)}`
      );
    }

    return new Brackets((q: WhereExpression) => {
      const createMatchString = (str: string): string => {
        if (
          (query as TextSearch).matchType ===
          TextSearchQueryMatchTypes.exact_match
        ) {
          return str;
        }
        // MySQL uses C escape syntax in strings, details:
        // https://stackoverflow.com/questions/14926386/how-to-search-for-slash-in-mysql-and-why-escaping-not-required-for-wher
        if (Config.Database.type === DatabaseType.mysql) {
          /// this reqExp replaces the "\\" to "\\\\\"
          return '%' + str.replace(new RegExp('\\\\', 'g'), '\\\\') + '%';
        }
        return `%${str}%`;
      };

      const LIKE = (query as TextSearch).negate ? 'NOT LIKE' : 'LIKE';
      // if the expression is negated, we use AND instead of OR as nowhere should that match
      const whereFN = (query as TextSearch).negate ? 'andWhere' : 'orWhere';
      const whereFNRev = (query as TextSearch).negate ? 'orWhere' : 'andWhere';

      const textParam: { [key: string]: unknown } = {};
      textParam['text' + queryId] = createMatchString(
        (query as TextSearch).value
      );

      if (
        query.type === SearchQueryTypes.any_text ||
        query.type === SearchQueryTypes.directory
      ) {
        const dirPathStr = (query as TextSearch).value.replace(
          new RegExp('\\\\', 'g'),
          '/'
        );
        const alias = aliases['directory'] ?? 'directory';
        textParam['fullPath' + queryId] = createMatchString(dirPathStr);
        q[whereFN](
          `${alias}.path ${LIKE} :fullPath${queryId} COLLATE ` + SQL_COLLATE,
          textParam
        );

        const directoryPath = GalleryManager.parseRelativeDirPath(dirPathStr);
        q[whereFN](
          new Brackets((dq): unknown => {
            textParam['dirName' + queryId] = createMatchString(
              directoryPath.name
            );
            dq[whereFNRev](
              `${alias}.name ${LIKE} :dirName${queryId} COLLATE ${SQL_COLLATE}`,
              textParam
            );
            if (dirPathStr.includes('/')) {
              textParam['parentName' + queryId] = createMatchString(
                directoryPath.parent
              );
              dq[whereFNRev](
                `${alias}.path ${LIKE} :parentName${queryId} COLLATE ${SQL_COLLATE}`,
                textParam
              );
            }
            return dq;
          })
        );
      }

      if (
        (query.type === SearchQueryTypes.any_text && !directoryOnly) ||
        query.type === SearchQueryTypes.file_name
      ) {
        q[whereFN](
          `media.name ${LIKE} :text${queryId} COLLATE ${SQL_COLLATE}`,
          textParam
        );
      }

      if (
        (query.type === SearchQueryTypes.any_text && !directoryOnly) ||
        query.type === SearchQueryTypes.caption
      ) {
        q[whereFN](
          `media.metadata.caption ${LIKE} :text${queryId} COLLATE ${SQL_COLLATE}`,
          textParam
        );
      }

      if (
        (query.type === SearchQueryTypes.any_text && !directoryOnly) ||
        query.type === SearchQueryTypes.position
      ) {
        q[whereFN](
          `media.metadata.positionData.country ${LIKE} :text${queryId} COLLATE ${SQL_COLLATE}`,
          textParam
        )[whereFN](
          `media.metadata.positionData.state ${LIKE} :text${queryId} COLLATE ${SQL_COLLATE}`,
          textParam
        )[whereFN](
          `media.metadata.positionData.city ${LIKE} :text${queryId} COLLATE ${SQL_COLLATE}`,
          textParam
        );
      }

      // Matching for array type fields
      const matchArrayField = (fieldName: string): void => {
        q[whereFN](
          new Brackets((qbr): void => {
            if (
              (query as TextSearch).matchType !==
              TextSearchQueryMatchTypes.exact_match
            ) {
              qbr[whereFN](
                `${fieldName} ${LIKE} :text${queryId} COLLATE ${SQL_COLLATE}`,
                textParam
              );
            } else {
              qbr[whereFN](
                new Brackets((qb): void => {
                  textParam['CtextC' + queryId] = `%,${
                    (query as TextSearch).value
                  },%`;
                  textParam['Ctext' + queryId] = `%,${
                    (query as TextSearch).value
                  }`;
                  textParam['textC' + queryId] = `${
                    (query as TextSearch).value
                  },%`;
                  textParam['text_exact' + queryId] = `${
                    (query as TextSearch).value
                  }`;

                  qb[whereFN](
                    `${fieldName} ${LIKE} :CtextC${queryId} COLLATE ${SQL_COLLATE}`,
                    textParam
                  );
                  qb[whereFN](
                    `${fieldName} ${LIKE} :Ctext${queryId} COLLATE ${SQL_COLLATE}`,
                    textParam
                  );
                  qb[whereFN](
                    `${fieldName} ${LIKE} :textC${queryId} COLLATE ${SQL_COLLATE}`,
                    textParam
                  );
                  qb[whereFN](
                    `${fieldName} ${LIKE} :text_exact${queryId} COLLATE ${SQL_COLLATE}`,
                    textParam
                  );
                })
              );
            }
            if ((query as TextSearch).negate) {
              qbr.orWhere(`${fieldName} IS NULL`);
            }
          })
        );
      };

      if (
        (query.type === SearchQueryTypes.any_text && !directoryOnly) ||
        query.type === SearchQueryTypes.person
      ) {
        matchArrayField('media.metadata.persons');
      }

      if (
        (query.type === SearchQueryTypes.any_text && !directoryOnly) ||
        query.type === SearchQueryTypes.keyword
      ) {
        matchArrayField('media.metadata.keywords');
      }
      return q;
    });
  }

  public hasDirectoryQuery(query: SearchQueryDTO): boolean {
    switch (query.type) {
      case SearchQueryTypes.AND:
      case SearchQueryTypes.OR:
      case SearchQueryTypes.SOME_OF:
        return (query as SearchListQuery).list.some(q => this.hasDirectoryQuery(q));
      case SearchQueryTypes.any_text:
      case SearchQueryTypes.directory:
        return true;
    }
    return false;
  }

  protected flattenSameOfQueries(query: SearchQueryDTO): SearchQueryDTO {
    switch (query.type) {
      case SearchQueryTypes.AND:
      case SearchQueryTypes.OR:
        return {
          type: query.type,
          list: ((query as SearchListQuery).list || []).map(
            (q): SearchQueryDTO => this.flattenSameOfQueries(q)
          ),
        } as SearchListQuery;
      case SearchQueryTypes.SOME_OF:
        const someOfQ = query as SomeOfSearchQuery;
        someOfQ.min = someOfQ.min || 1;

        if (someOfQ.min === 1) {
          return this.flattenSameOfQueries({
            type: SearchQueryTypes.OR,
            list: (someOfQ as SearchListQuery).list,
          } as ORSearchQuery);
        }

        if (someOfQ.min === ((query as SearchListQuery).list || []).length) {
          return this.flattenSameOfQueries({
            type: SearchQueryTypes.AND,
            list: (someOfQ as SearchListQuery).list,
          } as ANDSearchQuery);
        }

        const getAllCombinations = (
          num: number,
          arr: SearchQueryDTO[],
          start = 0
        ): SearchQueryDTO[] => {
          if (num <= 0 || num > arr.length || start >= arr.length) {
            return null;
          }
          if (num <= 1) {
            return arr.slice(start);
          }
          if (num === arr.length - start) {
            return [
              {
                type: SearchQueryTypes.AND,
                list: arr.slice(start),
              } as ANDSearchQuery,
            ];
          }
          const ret: ANDSearchQuery[] = [];
          for (let i = start; i < arr.length; ++i) {
            const subRes = getAllCombinations(num - 1, arr, i + 1);
            if (subRes === null) {
              break;
            }
            const and: ANDSearchQuery = {
              type: SearchQueryTypes.AND,
              list: [arr[i]],
            };
            if (subRes.length === 1) {
              if (subRes[0].type === SearchQueryTypes.AND) {
                and.list.push(...(subRes[0] as ANDSearchQuery).list);
              } else {
                and.list.push(subRes[0]);
              }
            } else {
              and.list.push({
                type: SearchQueryTypes.OR,
                list: subRes,
              } as ORSearchQuery);
            }
            ret.push(and);
          }

          if (ret.length === 0) {
            return null;
          }
          return ret;
        };

        return this.flattenSameOfQueries({
          type: SearchQueryTypes.OR,
          list: getAllCombinations(
            someOfQ.min,
            (query as SearchListQuery).list
          ),
        } as ORSearchQuery);
    }
    return query;
  }

  /**
   * Assigning IDs to search queries. It is a help / simplification to typeorm,
   * so less parameters are needed to pass down to SQL.
   * Witch SOME_OF query the number of WHERE constrains have O(N!) complexity
   */
  private assignQueryIDs(
    queryIN: SearchQueryDTO,
    id = {value: 1}
  ): SearchQueryDTO {
    // It is possible that one SQL query contains multiple searchQueries
    // (like: where (<searchQuery1> AND (<searchQuery2>))
    // lets make params unique across multiple queries
    if (id.value === 1) {
      this.queryIdBase++;
      if (this.queryIdBase > 10000) {
        this.queryIdBase = 0;
      }
    }
    if ((queryIN as SearchListQuery).list) {
      (queryIN as SearchListQuery).list.forEach((q) =>
        this.assignQueryIDs(q, id)
      );
      return queryIN;
    }
    (queryIN as SearchQueryDTOWithID).queryId =
      this.queryIdBase + '_' + id.value;
    id.value++;
    return queryIN;
  }

  /**
   * Returns only those parts of a query tree that only contains directory-related search queries
   */
  private filterDirectoryQuery(query: SearchQueryDTO): SearchQueryDTO {
    switch (query.type) {
      case SearchQueryTypes.AND:
        const andRet = {
          type: SearchQueryTypes.AND,
          list: (query as SearchListQuery).list.map((q) =>
            this.filterDirectoryQuery(q)
          ),
        } as ANDSearchQuery;
        // if any of the queries contain non dir query the whole and query is a non dir query
        if (andRet.list.indexOf(null) !== -1) {
          return null;
        }
        return andRet;

      case SearchQueryTypes.OR:
        const orRet = {
          type: SearchQueryTypes.OR,
          list: (query as SearchListQuery).list
            .map((q) => this.filterDirectoryQuery(q))
            .filter((q) => q !== null),
        } as ORSearchQuery;
        if (orRet.list.length === 0) {
          return null;
        }
        return orRet;

      case SearchQueryTypes.any_text:
      case SearchQueryTypes.directory:
        return query;

      case SearchQueryTypes.SOME_OF:
        throw new Error('"Some of" queries should have been already flattened');
    }
    // of none of the above, its not a directory search
    return null;
  }

  private async getGPSData(query: SearchQueryDTO): Promise<SearchQueryDTO> {
    if ((query as ANDSearchQuery | ORSearchQuery).list) {
      for (
        let i = 0;
        i < (query as ANDSearchQuery | ORSearchQuery).list.length;
        ++i
      ) {
        (query as ANDSearchQuery | ORSearchQuery).list[i] =
          await this.getGPSData(
            (query as ANDSearchQuery | ORSearchQuery).list[i]
          );
      }
    }
    if (
      query.type === SearchQueryTypes.distance &&
      (query as DistanceSearch).from.value
    ) {
      (query as DistanceSearch).from.GPSData =
        await ObjectManagers.getInstance().LocationManager.getGPSData(
          (query as DistanceSearch).from.value
        );
    }
    return query;
  }

  private encapsulateAutoComplete(
    values: string[],
    type: SearchQueryTypes
  ): Array<AutoCompleteItem> {
    const res: AutoCompleteItem[] = [];
    values.forEach((value): void => {
      res.push(new AutoCompleteItem(value, type));
    });
    return res;
  }
}

export interface SearchQueryDTOWithID extends SearchQueryDTO {
  queryId: string;
}
