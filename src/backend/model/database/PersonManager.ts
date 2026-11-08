import {SQLConnection} from './SQLConnection';
import {PersonEntry} from './enitites/person/PersonEntry';
import {PersonDTO} from '../../../common/entities/PersonDTO';
import {Logger} from '../../Logger';
import {SQL_COLLATE} from './enitites/EntityUtils';
import {PersonJunctionTable} from './enitites/person/PersonJunctionTable';
import {DirectoryPathDTO} from '../../../common/entities/DirectoryDTO';
import {ProjectedPersonCacheEntity} from './enitites/person/ProjectedPersonCacheEntity';
import {SessionContext} from '../SessionContext';
import {ProjectionAwareManager} from './ProjectionAwareManager';

const LOG_TAG = '[PersonManager]';

export class PersonManager extends ProjectionAwareManager<PersonEntry> {

  async updatePerson(
    name: string,
    partialPerson: PersonDTO
  ): Promise<void> {
    const connection = await SQLConnection.getConnection();
    const repository = connection.getRepository(PersonEntry);
    const person = await repository
      .createQueryBuilder('person')
      .limit(1)
      .where('person.name LIKE :name COLLATE ' + SQL_COLLATE, {name})
      .getOne();

    if (!person) {
      throw new Error('Person not found: ' + name);
    }
    if (typeof partialPerson.name !== 'undefined') {
      person.name = partialPerson.name;
    }
    if (typeof partialPerson.isFavourite !== 'undefined') {
      person.isFavourite = partialPerson.isFavourite;
    }
    await repository.save(person);

    // reset memory cache after person update. DB cache entry did not change, no need to reset that
    this.resetMemoryCache();

    return;
  }

  /**
   * Used for statistic
   */
  public async countFaces(): Promise<number> {
    const connection = await SQLConnection.getConnection();
    return await connection
      .getRepository(PersonJunctionTable)
      .createQueryBuilder('personJunction')
      .getCount();
  }

  public async get(session: SessionContext, name: string): Promise<PersonEntry | undefined> {
    const persons = await this.getAll(session);
    return persons.find((p): boolean => p.name === name);
  }

  public async saveAll(
    persons: { name: string; mediaId: number }[]
  ): Promise<void> {
    const toSave: { name: string; mediaId: number }[] = [];
    const connection = await SQLConnection.getConnection();
    const personRepository = connection.getRepository(PersonEntry);
    const personJunction = connection.getRepository(PersonJunctionTable);

    const savedPersons = await personRepository.find();
    // filter already existing persons
    for (const personToSave of persons) {
      const person = savedPersons.find(
        (p): boolean => p.name === personToSave.name
      );
      if (!person) {
        toSave.push(personToSave);
      }
    }

    if (toSave.length > 0) {
      for (let i = 0; i < toSave.length / 200; i++) {
        const saving = toSave.slice(i * 200, (i + 1) * 200);
        // saving person
        const inserted = await personRepository.insert(
          saving.map((p) => ({name: p.name}))
        );
        // saving junction table
        const junctionTable = inserted.identifiers.map((idObj, j) => ({person: idObj, media: {id: saving[j].mediaId}}));
        await personJunction.insert(junctionTable);
      }
    }
  }

  // only a scanned directory comes with its id
  protected async invalidateDBCache(changedDir?: DirectoryPathDTO & {id?: number}): Promise<void> {
    if (!changedDir || !changedDir.id) {
      await this.invalidateAllDBCache();
      return;
    }
    try {
      const connection = await SQLConnection.getConnection();

      // Collect affected person ids from this directory (non-recursive)
      const rows = await connection.getRepository(PersonJunctionTable)
        .createQueryBuilder('pjt')
        .innerJoin('pjt.media', 'm')
        .innerJoin('m.directory', 'd')
        .innerJoin('pjt.person', 'person')
        .where('d.id = :dirId', {dirId: changedDir.id})
        .select('DISTINCT person.id', 'pid')
        .getRawMany<{ pid: string }>();

      const pids = rows.map((r) => parseInt(r.pid, 10)).filter((n: number) => !isNaN(n));
      if (pids.length === 0) {
        return;
      }

      // Mark projection-aware person cache entries invalid for these persons
      await connection.getRepository(ProjectedPersonCacheEntity)
        .createQueryBuilder()
        .update()
        .set({valid: false})
        .where('personId IN (:...pids)', {pids})
        .execute();
    } catch (err) {
      Logger.warn(LOG_TAG, 'Failed to invalidate projected person cache on data change', err);
    }
  }

  protected async loadEntities(session: SessionContext): Promise<PersonEntry[]> {
    await this.updateCacheForAll(session);
    const connection = await SQLConnection.getConnection();
    const personRepository = connection.getRepository(PersonEntry);
    return await personRepository
      .createQueryBuilder('person')
      .leftJoin('person.cache', 'cache', 'cache.projectionKey = :pk', {pk: session.user.projectionKey})
      .leftJoin('cache.sampleRegion', 'sampleRegion')
      .leftJoin('sampleRegion.media', 'media')
      .leftJoin('media.directory', 'directory')
      .select([
        'person.id',
        'person.name',
        'person.isFavourite',
        'cache.count',
        'sampleRegion',
        'media',
        'directory.path',
        'directory.name'
      ])
      .where('cache.valid = 1 AND cache.count > 0')
      .getMany();
  }

  private async invalidateAllDBCache(): Promise<void> {
    const connection = await SQLConnection.getConnection();
    await connection.getRepository(ProjectedPersonCacheEntity)
      .createQueryBuilder()
      .update()
      .set({valid: false})
      .execute();
  }

  private async updateCacheForAll(session: SessionContext): Promise<void> {
    const connection = await SQLConnection.getConnection();
    const projectionKey = session.user.projectionKey;

    // Get all persons that need cache updates (either missing or invalid)
    const personsNeedingUpdate = await connection
      .getRepository(PersonEntry)
      .createQueryBuilder('person')
      .leftJoin('person.cache', 'cache', 'cache.projectionKey = :projectionKey', {projectionKey})
      .where('cache.id IS NULL OR cache.valid = false')
      .select(['person.id'])
      .getMany();

    if (personsNeedingUpdate.length === 0) {
      return;
    }

    // Process persons in batches to avoid memory issues
    const batchSize = 200;
    for (let i = 0; i < personsNeedingUpdate.length; i += batchSize) {
      const batch = personsNeedingUpdate.slice(i, i + batchSize);
      const personIds = batch.map(p => p.id);

      // Build base query for person junction table with projection constraints
      const baseQb = connection
        .getRepository(PersonJunctionTable)
        .createQueryBuilder('pjt')
        .innerJoin('pjt.media', 'media')
        .where('pjt.person IN (:...personIds)', {personIds});

      // Apply projection query if it exists
      if (session.projectionQuery) {
        if (session.hasDirectoryProjection) {
          baseQb.leftJoin('media.directory', 'directory');
        }
        baseQb.andWhere(session.projectionQuery);
      }

      // Compute counts per person
      const countResults = await baseQb
        .clone()
        .select(['pjt.person as personId', 'COUNT(*) as count'])
        .groupBy('pjt.person')
        .getRawMany<{ personId: string, count: string }>();
      // Compute sample regions per person (best rated/newest photo)
      // Use individual queries per person to ensure compatibility with older SQLite versions
      const topSamples: Record<number, number> = {};
      for (const personId of personIds) {
        const sampleQb = connection
          .getRepository(PersonJunctionTable)
          .createQueryBuilder('pjt')
          .innerJoin('pjt.media', 'media')
          .where('pjt.person = :personId', {personId});

        // Apply projection query if it exists
        if (session.projectionQuery) {
          if (session.hasDirectoryProjection) {
            sampleQb.leftJoin('media.directory', 'directory');
          }
          sampleQb.andWhere(session.projectionQuery);
        }

        const sampleResult = await sampleQb
          .select('pjt.id')
          .orderBy('media.metadataRating', 'DESC')
          .addOrderBy('media.metadataCreationdate', 'DESC')
          .limit(1)
          .getOne();

        if (sampleResult) {
          topSamples[personId] = sampleResult.id;
        }
      }

      // Build count lookup
      const counts = countResults.reduce((acc: Record<number, number>, r) => {
        acc[parseInt(r.personId, 10)] = parseInt(r.count, 10);
        return acc;
      }, {});

      // Batch upsert cache entries to minimize DB transactions
      const cacheRepo = connection.getRepository(ProjectedPersonCacheEntity);
      const cacheEntriesToSave: ProjectedPersonCacheEntity[] = [];

      // Get existing cache entries for this batch
      const existingEntries = await cacheRepo
        .createQueryBuilder('cache')
        .leftJoinAndSelect('cache.person', 'person')
        .where('cache.projectionKey = :projectionKey', {projectionKey})
        .andWhere('cache.person IN (:...personIds)', {personIds})
        .getMany();

      const existingByPersonId = existingEntries.reduce((acc, entry) => {
        acc[entry.person.id] = entry;
        return acc;
      }, {} as Record<number, ProjectedPersonCacheEntity>);

      for (const person of batch) {
        const count = counts[person.id] || 0;
        const sampleRegionId = topSamples[person.id] || null;

        let cacheEntry = existingByPersonId[person.id];
        if (cacheEntry) {
          // Update existing entry
          cacheEntry.count = count;
          cacheEntry.sampleRegion = sampleRegionId ? {id: sampleRegionId} as PersonJunctionTable : null;
          cacheEntry.valid = true;
        } else {
          // Create new entry
          cacheEntry = new ProjectedPersonCacheEntity();
          cacheEntry.projectionKey = projectionKey;
          cacheEntry.person = {id: person.id} as PersonEntry;
          cacheEntry.count = count;
          cacheEntry.sampleRegion = sampleRegionId ? {id: sampleRegionId} as PersonJunctionTable : null;
          cacheEntry.valid = true;
        }

        cacheEntriesToSave.push(cacheEntry);
      }

      // Batch save all cache entries for this batch
      if (cacheEntriesToSave.length > 0) {
        await cacheRepo.save(cacheEntriesToSave);
      }
    }
  }

}
