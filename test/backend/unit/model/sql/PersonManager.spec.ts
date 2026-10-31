import {expect} from 'chai';
import {PersonManager} from '../../../../../src/backend/model/database/PersonManager';
import {DBTestHelper} from '../../../DBTestHelper';
import {TestHelper} from '../../../../TestHelper';
import {PhotoDTO} from '../../../../../src/common/entities/PhotoDTO';
import {Utils} from '../../../../../src/common/Utils';
import {ParentDirectoryDTO} from '../../../../../src/common/entities/DirectoryDTO';
import {VideoDTO} from '../../../../../src/common/entities/VideoDTO';
import {SQLConnection} from '../../../../../src/backend/model/database/SQLConnection';
import {PersonEntry} from '../../../../../src/backend/model/database/enitites/person/PersonEntry';
import {PersonJunctionTable} from '../../../../../src/backend/model/database/enitites/person/PersonJunctionTable';
import {ProjectedPersonCacheEntity} from '../../../../../src/backend/model/database/enitites/person/ProjectedPersonCacheEntity';
import {ObjectManagers} from '../../../../../src/backend/model/ObjectManagers';
import {SearchQueryTypes, TextSearch, TextSearchQueryMatchTypes} from '../../../../../src/common/entities/SearchQueryDTO';
import {SessionContext} from '../../../../../src/backend/model/SessionContext';


// to help WebStorm to handle the test cases
declare let describe: any;
declare const after: any;
declare const before: any;
declare const beforeEach: any;
declare const afterEach: any;
declare const it: any;


const tmpDescribe = describe;
// eslint-disable-next-line prefer-const
describe = DBTestHelper.describe();

describe('PersonManager', (sqlHelper: DBTestHelper) => {
  before(TestHelper.resetConfig);
  describe = tmpDescribe;


  let dir: ParentDirectoryDTO;

  let v: VideoDTO;
  let p: PhotoDTO;
  let p2: PhotoDTO;
  let pFaceLess: PhotoDTO;

  let savedPerson: PersonEntry[] = [];

  const setUpSqlDB = async () => {
    await sqlHelper.initDB();
    const directory: ParentDirectoryDTO = TestHelper.getDirectoryEntry();
    p = TestHelper.getPhotoEntry1(directory);
    p2 = TestHelper.getPhotoEntry2(directory);
    const pFaceLessTmp = TestHelper.getPhotoEntry3(directory);
    delete pFaceLessTmp.metadata.faces;
    v = TestHelper.getVideoEntry1(directory);

    dir = await DBTestHelper.persistTestDir(directory);
    p = (dir.media.filter(m => m.name === p.name)[0] as any);
    p2 = (dir.media.filter(m => m.name === p2.name)[0] as any);
    pFaceLess = (dir.media[2] as any);
    v = (dir.media.filter(m => m.name === v.name)[0] as any);
    savedPerson = await (await SQLConnection.getConnection()).getRepository(PersonEntry).createQueryBuilder('person')
      .leftJoin('person.cache', 'cache', 'cache.projectionKey = :pk AND cache.valid = 1', {pk: DBTestHelper.defaultSession.user.projectionKey})
      .leftJoin('cache.sampleRegion', 'sampleRegion')
      .leftJoin('sampleRegion.media', 'media')
      .leftJoin('media.directory', 'directory')
      .select([
        'person.id',
        'person.name',
        'person.isFavourite',
        'cache.count',
        'sampleRegion',
        'media.name',
        'directory.path',
        'directory.name'
      ])
      .getMany();
  };

  const createProjectionSession = async (query: any): Promise<SessionContext> => {
    await ObjectManagers.getInstance().init();
    return await ObjectManagers.getInstance().SessionManager.buildContext({
      allowQuery: query,
      overrideAllowBlockList: true
    } as any);
  };

  before(async () => {
    await setUpSqlDB();
  });

  after(sqlHelper.clearDB);

  describe('Basic Operations', () => {

    it('should get person with default session', async () => {
      const pm = new PersonManager();
      const person = Utils.clone(savedPerson[0]);

      const selected = Utils.clone(await pm.get(DBTestHelper.defaultSession, 'Boba Fett'));
      expect(selected).to.not.be.undefined;
      expect(selected.cache).to.be.not.undefined;
      expect(selected.cache.count).to.be.greaterThan(0);
      delete selected.cache;
      delete person.cache;
      expect(selected).to.deep.equal(person);
    });

    it('should get all persons with default session', async () => {
      const pm = new PersonManager();

      const allPersons = await pm.getAll(DBTestHelper.defaultSession);
      expect(allPersons).to.not.be.undefined;
      expect(allPersons.length).to.be.greaterThan(0);

      // Check that persons have expected properties
      allPersons.forEach(person => {
        expect(person).to.have.property('id');
        expect(person).to.have.property('name');
        expect(person).to.have.property('isFavourite');

        // Check that cache is a single object, not an array
        if (person.cache) {
          expect(Array.isArray(person.cache)).to.be.false;
          expect(person.cache).to.have.property('count');
          expect(person.cache.count).to.be.a('number');
        }
      });
    });

    it('should get person that does not exist', async () => {
      const pm = new PersonManager();

      const selected = await pm.get(DBTestHelper.defaultSession, 'Non Existent Person');
      expect(selected).to.be.undefined;
    });

    it('should count faces', async () => {
      const pm = new PersonManager();

      const count = await pm.countFaces();
      expect(count).to.be.a('number');
      expect(count).to.be.equal(10);
    });

    it('should update person', async () => {
      const pm = new PersonManager();
      const originalPerson = await pm.get(DBTestHelper.defaultSession, 'Boba Fett');
      expect(originalPerson).to.not.be.undefined;

      await pm.updatePerson('Boba Fett', {
        id: originalPerson.id,
        name: 'Updated Boba Fett',
        isFavourite: !originalPerson.isFavourite
      });


      // Verify the person was actually updated in the database
      const fetchedPerson = await pm.get(DBTestHelper.defaultSession, 'Updated Boba Fett');
      expect(fetchedPerson).to.not.be.undefined;
      expect(fetchedPerson.name).to.equal('Updated Boba Fett');
      expect(fetchedPerson.isFavourite).to.equal(!originalPerson.isFavourite);
    });

    it('should save new persons', async () => {
      const pm = new PersonManager();
      const connection = await SQLConnection.getConnection();

      // Get initial count
      const initialPersonCount = await connection.getRepository(PersonEntry).count();
      const initialJunctionCount = await connection.getRepository(PersonJunctionTable).count();

      // Add new persons
      const newPersons = [
        {name: 'New Person 1', mediaId: p.id},
        {name: 'New Person 2', mediaId: p2.id}
      ];

      await pm.saveAll(newPersons);

      // Verify persons were added
      const finalPersonCount = await connection.getRepository(PersonEntry).count();
      const finalJunctionCount = await connection.getRepository(PersonJunctionTable).count();

      expect(finalPersonCount).to.equal(initialPersonCount + 2);
      expect(finalJunctionCount).to.equal(initialJunctionCount + 2);

      // Verify we can retrieve the new persons
      const newPerson1 = await connection.getRepository(PersonEntry).findOne({
        where: {name: 'New Person 1'}
      });
      const newPerson2 = await connection.getRepository(PersonEntry).findOne({
        where: {name: 'New Person 2'}
      });

      expect(newPerson1).to.not.be.null;
      expect(newPerson2).to.not.be.null;
    });

    it('should not save duplicate persons', async () => {
      const pm = new PersonManager();
      const connection = await SQLConnection.getConnection();

      // Get initial count
      const initialPersonCount = await connection.getRepository(PersonEntry).count();

      // Try to add existing person
      const duplicatePersons = [
        {name: 'Unkle Ben', mediaId: p.id}
      ];

      await pm.saveAll(duplicatePersons);

      // Verify no new persons were added
      const persons = await connection.getRepository(PersonEntry).find();
      expect(persons.length).to.equal(initialPersonCount, JSON.stringify(persons.map(p => p.name)));
    });

  });

  describe('Projection Tests', () => {

    beforeEach(async () => {
      // Reset cache before each projection test
      const pm = new PersonManager();
      await pm.invalidateCache();
    });

    it('should get persons with projection session filtering by filename', async () => {
      const pm = new PersonManager();

      // Create projection session that filters by filename
      const projectionSession = await createProjectionSession({
        type: SearchQueryTypes.file_name,
        value: 'photo1',
        matchType: TextSearchQueryMatchTypes.like
      } as TextSearch);

      const personsWithProjection = await pm.getAll(projectionSession);
      const personsWithDefault = await pm.getAll(DBTestHelper.defaultSession);

      expect(personsWithProjection).to.not.be.undefined;
      expect(personsWithProjection.length).to.equal(0);
      expect(personsWithDefault).to.not.be.undefined;
      expect(personsWithDefault.length).to.equal(10);

      // With projection, some persons might have different counts or be filtered out
      // The exact behavior depends on which photos match the projection
      expect(projectionSession.user.projectionKey).to.not.equal(DBTestHelper.defaultSession.user.projectionKey);
    });

    it('should handle cache correctly with different projections', async () => {
      const pm = new PersonManager();
      const connection = await SQLConnection.getConnection();

      // Get persons with default session first
      const personsDefault = await pm.getAll(DBTestHelper.defaultSession);
      expect(personsDefault.length).to.be.equal(10);

      // Create projection session
      const projectionSession = await createProjectionSession({
        type: SearchQueryTypes.file_name,
        value: 'photo1',
        matchType: TextSearchQueryMatchTypes.like
      } as TextSearch);

      // Trigger cache filling
      await pm.getAll(projectionSession);

      // Verify that cache entries exist for both projection keys
      const defaultCacheEntries = await connection.getRepository(ProjectedPersonCacheEntity)
        .count({where: {projectionKey: DBTestHelper.defaultSession.user.projectionKey}});
      const projectionCacheEntries = await connection.getRepository(ProjectedPersonCacheEntity)
        .count({where: {projectionKey: projectionSession.user.projectionKey}});

      expect(defaultCacheEntries).to.be.equal(10);
      expect(projectionCacheEntries).to.be.equal(10);
    });

    it('should get single person with projection session', async () => {
      const pm = new PersonManager();

      // Create projection session
      const projectionSession = await createProjectionSession({
        type: SearchQueryTypes.file_name,
        value: 'sw1',
        matchType: TextSearchQueryMatchTypes.like
      } as TextSearch);

      const personWithProjection = await pm.get(projectionSession, 'Unkle Ben');
      const personWithDefault = await pm.get(DBTestHelper.defaultSession, 'Unkle Ben');

      expect(personWithProjection).to.not.be.undefined;
      expect(personWithDefault).to.not.be.undefined;
      expect(personWithProjection.name).to.equal(personWithDefault.name);


      expect(await pm.get(projectionSession, 'Padmé Amidala')).to.be.undefined;
    });

    it('should filter out persons with count = 0 from getAll()', async () => {
      const pm = new PersonManager();
      const connection = await SQLConnection.getConnection();

      // Create a test person with no media associations (count will be 0)
      const personRepo = connection.getRepository(PersonEntry);
      const testPerson = new PersonEntry();
      testPerson.name = 'Test Person Zero Count';
      testPerson.isFavourite = false;
      const savedTestPerson = await personRepo.save(testPerson);

      // Force cache invalidation to rebuild with the new person
      await pm.invalidateCache();

      // Get all persons - the person with count = 0 should not be included
      const allPersons = await pm.getAll(DBTestHelper.defaultSession);

      // Verify the test person is not in the results
      const foundPerson = allPersons.find(p => p.name === 'Test Person Zero Count');
      expect(foundPerson).to.be.undefined;

      // Verify that all returned persons have count > 0
      for (const person of allPersons) {
        expect(person.cache).to.not.be.undefined;
        expect(person.cache.count).to.be.greaterThan(0);
      }

      // Verify the person exists in the database but not in results
      const dbPerson = await personRepo.findOne({where: {name: 'Test Person Zero Count'}});
      expect(dbPerson).to.not.be.undefined;
      expect(dbPerson.name).to.equal('Test Person Zero Count');

      // Clean up
      await personRepo.remove(savedTestPerson);
    });

    it('should handle persons with exactly count = 0 correctly', async () => {
      const pm = new PersonManager();
      const connection = await SQLConnection.getConnection();

      // Create a person and manually set their cache count to 0
      const personRepo = connection.getRepository(PersonEntry);
      const cacheRepo = connection.getRepository(ProjectedPersonCacheEntity);

      const testPerson = new PersonEntry();
      testPerson.name = 'Test Person Exact Zero';
      testPerson.isFavourite = false;
      const savedTestPerson = await personRepo.save(testPerson);

      // Manually create a cache entry with count = 0
      const cacheEntry = new ProjectedPersonCacheEntity();
      cacheEntry.projectionKey = DBTestHelper.defaultSession.user.projectionKey;
      cacheEntry.person = savedTestPerson;
      cacheEntry.count = 0;
      cacheEntry.valid = true;
      cacheEntry.sampleRegion = null;
      await cacheRepo.save(cacheEntry);

      // Reset memory cache to force reload from database
      await pm.invalidateCache();

      // Verify the person is not returned by getAll
      const allPersons = await pm.getAll(DBTestHelper.defaultSession);
      const foundInAll = allPersons.find(p => p.name === 'Test Person Exact Zero');
      expect(foundInAll).to.be.undefined;

      // Verify the person is not returned by get
      const foundByGet = await pm.get(DBTestHelper.defaultSession, 'Test Person Exact Zero');
      expect(foundByGet).to.be.undefined;

      // Clean up
      await cacheRepo.remove(cacheEntry);
      await personRepo.remove(savedTestPerson);
    });

  });

  describe('Cache Management', () => {

    it('should reset previews and invalidate cache', async () => {
      const pm = new PersonManager();
      const connection = await SQLConnection.getConnection();

      // Ensure there are valid cache entries
      await pm.getAll(DBTestHelper.defaultSession);

      let validCacheCount = await connection.getRepository(ProjectedPersonCacheEntity)
        .count({where: {valid: true}});
      expect(validCacheCount).to.be.equal(10);

      // Reset previews
      await pm.invalidateCache();

      // Check that all cache entries are now invalid
      validCacheCount = await connection.getRepository(ProjectedPersonCacheEntity)
        .count({where: {valid: true}});
      expect(validCacheCount).to.equal(0);
    });

    it('should invalidate cache for specific directory', async () => {
      const pm = new PersonManager();
      const connection = await SQLConnection.getConnection();

      // Ensure there are valid cache entries
      await pm.getAll(DBTestHelper.defaultSession);

      let validCacheCount = await connection.getRepository(ProjectedPersonCacheEntity)
        .count({where: {valid: true}});
      expect(validCacheCount).to.be.equal(10);

      // Trigger cache invalidation for the directory
      await pm.onNewDataVersion(dir);

      // Some cache entries should be invalidated
      const validCacheCountAfter = await connection.getRepository(ProjectedPersonCacheEntity)
        .count({where: {valid: true}});
      expect(validCacheCountAfter).to.be.lessThan(validCacheCount);
    });

    it('should handle cache invalidation for non-existent directory', async () => {
      const pm = new PersonManager();

      // Should not throw error
      await pm.onNewDataVersion(null);
      await pm.onNewDataVersion({} as ParentDirectoryDTO);
      await pm.onNewDataVersion({id: 999999} as ParentDirectoryDTO);
    });

    it('should rebuild cache when accessing persons after invalidation', async () => {
      const pm = new PersonManager();
      const connection = await SQLConnection.getConnection();

      // Reset cache
      await pm.invalidateCache();

      // Verify cache is invalid
      let validCacheCount = await connection.getRepository(ProjectedPersonCacheEntity)
        .count({where: {valid: true}});
      expect(validCacheCount).to.equal(0);

      // Access persons - this should rebuild cache
      const persons = await pm.getAll(DBTestHelper.defaultSession);
      expect(persons).to.not.be.undefined;
      expect(persons.length).to.be.equal(10);

      // Verify cache is now valid
      validCacheCount = await connection.getRepository(ProjectedPersonCacheEntity)
        .count({where: {valid: true}});
      expect(validCacheCount).to.be.equal(10);
    });

  });

  describe('Edge Cases', () => {

    it('should handle empty person list in saveAll', async () => {
      const pm = new PersonManager();

      // Should not throw error
      await pm.saveAll([]);
    });

    it('should handle large batch of persons in saveAll', async () => {
      const pm = new PersonManager();
      const connection = await SQLConnection.getConnection();

      // Create a large batch of persons (more than 200 to test batching)
      const largeBatch = [];
      for (let i = 0; i < 250; i++) {
        largeBatch.push({name: `Batch Person ${i}`, mediaId: p.id});
      }

      const initialCount = await connection.getRepository(PersonEntry).count();
      await pm.saveAll(largeBatch);
      const finalCount = await connection.getRepository(PersonEntry).count();

      expect(finalCount).to.equal(initialCount + 250);
    });

    it('should handle cache when no persons exist', async () => {
      const pm = new PersonManager();
      const connection = await SQLConnection.getConnection();

      // Remove all persons temporarily - need to check if any exist first
      const junctionCount = await connection.getRepository(PersonJunctionTable).count();
      const personCount = await connection.getRepository(PersonEntry).count();
      const cacheCount = await connection.getRepository(ProjectedPersonCacheEntity).count();

      if (junctionCount > 0) {
        await connection.getRepository(PersonJunctionTable).createQueryBuilder().delete().execute();
      }
      if (personCount > 0) {
        await connection.getRepository(PersonEntry).createQueryBuilder().delete().execute();
      }
      if (cacheCount > 0) {
        await connection.getRepository(ProjectedPersonCacheEntity).createQueryBuilder().delete().execute();
      }

      const persons = await pm.getAll(DBTestHelper.defaultSession);
      expect(persons).to.be.an('array');
      expect(persons.length).to.equal(0);

      const nonExistentPerson = await pm.get(DBTestHelper.defaultSession, 'Nobody');
      expect(nonExistentPerson).to.be.undefined;

      const faceCount = await pm.countFaces();
      expect(faceCount).to.equal(0);
    });

  });

});
