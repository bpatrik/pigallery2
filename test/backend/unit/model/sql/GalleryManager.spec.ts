import fs from 'fs';
import * as path from 'path';
import {DBTestHelper} from '../../../DBTestHelper';
import {GalleryManager} from '../../../../../src/backend/model/database/GalleryManager';
import {ParentDirectoryDTO} from '../../../../../src/common/entities/DirectoryDTO';
import {Connection} from 'typeorm';
import {SessionContext} from '../../../../../src/backend/model/SessionContext';
import {SearchQueryTypes, TextSearch, TextSearchQueryMatchTypes} from '../../../../../src/common/entities/SearchQueryDTO';
import {ObjectManagers} from '../../../../../src/backend/model/ObjectManagers';
import {SQLConnection} from '../../../../../src/backend/model/database/SQLConnection';
import {Config} from '../../../../../src/common/config/private/Config';
import {ReIndexingSensitivity} from '../../../../../src/common/config/private/PrivateConfig';
import {IndexingManager} from '../../../../../src/backend/model/database/IndexingManager';
import {ProjectedDirectoryCacheEntity} from '../../../../../src/backend/model/database/enitites/ProjectedDirectoryCacheEntity';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const deepEqualInAnyOrder = require('deep-equal-in-any-order');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const chai = require('chai');

chai.use(deepEqualInAnyOrder);
const {expect} = chai;

// to help WebStorm to handle the test cases
declare let describe: any;
declare const before: any;
declare const after: any;
declare const beforeEach: any;
declare const afterEach: any;
declare const it: any;
const tmpDescribe = describe;
describe = DBTestHelper.describe();


class GalleryManagerTest extends GalleryManager {

  public async getDirIdAndTime(connection: Connection, directoryName: string, directoryParent: string) {
    return super.getDirIdAndTime(connection, directoryName, directoryParent);
  }

  public async getParentDirFromId(connection: Connection, session: SessionContext, dir: number): Promise<ParentDirectoryDTO> {
    return super.getParentDirFromId(connection, session, dir);
  }
}

describe('GalleryManager', (sqlHelper: DBTestHelper) => {
  describe = tmpDescribe;

  let galleryManager: GalleryManagerTest;
  let connection: Connection;

  before(async () => {
    await sqlHelper.initDB();
    await sqlHelper.setUpTestGallery();
    await ObjectManagers.getInstance().init();
    connection = await SQLConnection.getConnection();
    galleryManager = new GalleryManagerTest();
  });

  after(async () => {
    await sqlHelper.clearDB();
  });

  describe('Projection Query Tests', () => {

    it('should return all media when no projection query is provided', async () => {
      // Setup a session with no projection query
      const session = DBTestHelper.defaultSession;


      // Get the directory contents without any filtering using our directory's name and path
      const dirInfo = await galleryManager.getDirIdAndTime(connection, sqlHelper.testGalleyEntities.dir.name, sqlHelper.testGalleyEntities.dir.path);
      expect(dirInfo).to.not.be.null;

      const directory = await galleryManager.getParentDirFromId(connection, session, dirInfo.id);

      // Verify that all media is returned
      expect(directory.media).to.not.be.empty;
      const originalMediaCount = directory.media.length;
      expect(originalMediaCount).to.be.greaterThan(0);
    });

    it('should filter media based on the projection query', async () => {

      // Create a projection query that filters based on media name
      const searchQuery = {
        type: SearchQueryTypes.file_name,
        value: 'photo1', // We've named our test photo specifically with this pattern
        matchType: TextSearchQueryMatchTypes.like
      } as TextSearch;
      const session = await ObjectManagers.getInstance().SessionManager.buildContext({
        allowQuery: searchQuery,
        overrideAllowBlockList: true
      } as any);


      // Get the directory contents with filtering using our directory's name and path
      const dirInfo = await galleryManager.getDirIdAndTime(connection, sqlHelper.testGalleyEntities.dir.name, sqlHelper.testGalleyEntities.dir.path);
      expect(dirInfo).to.not.be.null;

      // Get the directory contents with filtering
      const directory = await galleryManager.getParentDirFromId(connection, session, dirInfo.id);

      // Verify that only media matching the query is returned
      expect(directory.media).to.not.be.undefined;

      // All returned media should match the query (name contains 'photo1')
      if (directory.media.length > 0) {
        directory.media.forEach(media => {
          expect(media.name.toLowerCase()).to.include('photo1');
        });
      }

    });

    it('should return directory with empty media when projection filters out all media', async () => {

      const searchQuery = {
        type: SearchQueryTypes.file_name,
        value: 'this_file_name_does_not_exist_anywhere',
        matchType: TextSearchQueryMatchTypes.like
      } as TextSearch;


      const session = await ObjectManagers.getInstance().SessionManager.buildContext({
        allowQuery: searchQuery,
        overrideAllowBlockList: true
      } as any);


      const dirInfo = await galleryManager.getDirIdAndTime(connection, sqlHelper.testGalleyEntities.dir.name, sqlHelper.testGalleyEntities.dir.path);
      expect(dirInfo).to.not.be.null;

      const directory = await galleryManager.getParentDirFromId(connection, session, dirInfo.id);

      // The directory itself should still be returned
      expect(directory).to.not.be.undefined;
      expect(directory).to.not.be.null;

      // And media should be an empty array when nothing matches the projection
      expect(directory.media).to.be.an('array');
      expect(directory.media.length).to.equal(0);

    });

    it('blocks child directory when blockQuery contains normal directory search', async () => {
      const root = sqlHelper.testGalleyEntities.dir;
      const child = sqlHelper.testGalleyEntities.subDir;

      const blockQuery = {
        type: SearchQueryTypes.directory,
        matchType: TextSearchQueryMatchTypes.like,
        value: child.name
      } as TextSearch;

      const session = await ObjectManagers.getInstance().SessionManager.buildContext({
        blockQuery,
        overrideAllowBlockList: true
      } as any);

      const dirInfo = await galleryManager.getDirIdAndTime(connection, root.name, root.path);
      const directory = await galleryManager.getParentDirFromId(connection, session, dirInfo.id);

      expect(((await galleryManager.getParentDirFromId(connection, DBTestHelper.defaultSession, dirInfo.id)).directories || [])
        .map(d => d.name)).to.include(child.name);
      expect(((await galleryManager.getParentDirFromId(connection, session, dirInfo.id)).directories || [])
        .map(d => d.name)).to.not.include(child.name);

    });
  });


  describe('GalleryManager.listDirectory - reindexing severities and projection behavior', () => {
    const origStatSync = fs.statSync;

    let gm: GalleryManagerTest;
    let sessionNoProj: SessionContext;
    let sessionProj: SessionContext;

    const indexed: any = {id: 1, lastScanned: 0, lastModified: 0};
    let calledArgs: any[] = [];
    let bgCalls = 0;

    beforeEach(() => {
      // Reset config defaults that matter for tests
      Config.loadSync();

      gm = new GalleryManagerTest();
      sessionNoProj = new SessionContext();
      sessionProj = new SessionContext();
      // Make projectionQuery truthy without relying on SearchManager
      (sessionProj as any).projectionQuery = {} as any;

      // Stub fs.statSync to control directory mtime/ctime -> lastModified
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      fs.statSync = ((): any => ({ctime: new Date(0), mtime: new Date(0)})) as any;

      // Stub getDirIdAndTime and getParentDirFromId to avoid DB
      (gm as any).getDirIdAndTime = () => Promise.resolve(indexed);
      (gm as any).getParentDirFromId = () => Promise.resolve('DB_RESULT' as any);

      // Stub IndexingManager.indexDirectory to capture calls
      calledArgs = [];
      bgCalls = 0;
      ObjectManagers.getInstance().IndexingManager = new IndexingManager();
      ObjectManagers.getInstance().IndexingManager.indexDirectory = ((...args: any[]) => {
        calledArgs = args;
        bgCalls++;
        const retObj = {directories: [], media: [], metaFile: [], name: 'INDEX_RESULT'} as any;
        return Promise.resolve(retObj);
      }) as any;
    });

    afterEach(() => {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      fs.statSync = origStatSync;
    });

    const setStatTime = (t: number) => {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      fs.statSync = ((): any => ({ctime: new Date(t), mtime: new Date(t)})) as any;
    };

    it('never: returns DB result when already scanned (no projection) and known times are missing', async () => {
      Config.Indexing.reIndexingSensitivity = ReIndexingSensitivity.never;
      indexed.lastScanned = 123;
      indexed.lastModified = 1;
      setStatTime(1);

      const res = await gm.listDirectory(sessionNoProj, './');
      expect(res).to.equal('DB_RESULT');
    });

    it('never: returns DB result when already scanned (with projection) and known times are missing', async () => {
      Config.Indexing.reIndexingSensitivity = ReIndexingSensitivity.never;
      indexed.lastScanned = 123;
      indexed.lastModified = 1;
      setStatTime(1);

      const res = await gm.listDirectory(sessionProj, './');
      expect(res).to.equal('DB_RESULT');
    });

    it('low + mismatch: returns DB result when no projection', async () => {
      Config.Indexing.reIndexingSensitivity = ReIndexingSensitivity.low;
      indexed.lastScanned = 10;
      indexed.lastModified = 0; // DB says 0
      setStatTime(1); // FS says 1 -> mismatch

      const res = await gm.listDirectory(sessionNoProj, './');
      expect(res).to.equal('DB_RESULT');
      expect(calledArgs[0]).to.equal('./');
      expect(calledArgs[1]).to.equal(true); // waitForSave
    });

    it('low + mismatch: waits for save and returns DB result when projection set', async () => {
      Config.Indexing.reIndexingSensitivity = ReIndexingSensitivity.low;
      indexed.lastScanned = 10;
      indexed.lastModified = 0;
      setStatTime(1);

      const res = await gm.listDirectory(sessionProj, './');
      expect(res).to.equal('DB_RESULT');
      expect(calledArgs[0]).to.equal('./');
      expect(calledArgs[1]).to.equal(true); // waitForSave
    });

    it('low + unchanged with known times: returns null (no projection)', async () => {
      Config.Indexing.reIndexingSensitivity = ReIndexingSensitivity.low;
      indexed.lastScanned = 10;
      indexed.lastModified = 1;
      setStatTime(1);

      const res = await gm.listDirectory(sessionNoProj, './', 1, 10);
      expect(res).to.equal(null);
    });

    it('low + unchanged with known times: returns null (with projection)', async () => {
      Config.Indexing.reIndexingSensitivity = ReIndexingSensitivity.low;
      indexed.lastScanned = 10;
      indexed.lastModified = 1;
      setStatTime(1);

      const res = await gm.listDirectory(sessionProj, './', 1, 10);
      expect(res).to.equal(null);
    });

    it('medium + unchanged within cache (known times): returns null', async () => {
      Config.Indexing.reIndexingSensitivity = ReIndexingSensitivity.medium;
      // Set lastScanned close to now so within cachedFolderTimeout
      indexed.lastScanned = Date.now();
      indexed.lastModified = 1;
      setStatTime(1);

      const res = await gm.listDirectory(sessionNoProj, './', 1, indexed.lastScanned);
      expect(res).to.equal(null);
    });

    it('medium + cache expired (no known times): background reindex and DB result (no projection)', async () => {
      Config.Indexing.reIndexingSensitivity = ReIndexingSensitivity.medium;
      indexed.lastScanned = Date.now() - (Config.Indexing.cachedFolderTimeout + 1000);
      indexed.lastModified = 1;
      setStatTime(1);

      const res = await gm.listDirectory(sessionNoProj, './');
      expect(res).to.equal('DB_RESULT');
      expect(bgCalls).to.be.greaterThan(0);
    });

    it('medium + cache expired (no known times): background reindex and DB result (with projection)', async () => {
      Config.Indexing.reIndexingSensitivity = ReIndexingSensitivity.medium;
      indexed.lastScanned = Date.now() - (Config.Indexing.cachedFolderTimeout + 1000);
      indexed.lastModified = 1;
      setStatTime(1);

      const res = await gm.listDirectory(sessionProj, './');
      expect(res).to.equal('DB_RESULT');
      expect(bgCalls).to.be.greaterThan(0);
    });

    it('high + unchanged: background reindex and DB result (no projection)', async () => {
      Config.Indexing.reIndexingSensitivity = ReIndexingSensitivity.high;
      indexed.lastScanned = Date.now();
      indexed.lastModified = 1;
      setStatTime(1);

      const res = await gm.listDirectory(sessionNoProj, './');
      expect(res).to.equal('DB_RESULT');
      expect(bgCalls).to.be.greaterThan(0);
    });

    it('high + unchanged: background reindex and DB result (with projection)', async () => {
      Config.Indexing.reIndexingSensitivity = ReIndexingSensitivity.high;
      indexed.lastScanned = Date.now();
      indexed.lastModified = 1;
      setStatTime(1);

      const res = await gm.listDirectory(sessionProj, './');
      expect(res).to.equal('DB_RESULT');
      expect(bgCalls).to.be.greaterThan(0);
    });

    it('never scanned (lastScanned=null): without projection returns scanned result', async () => {
      // Simulate never scanned dir
      indexed.lastScanned = null;
      indexed.lastModified = 0;
      setStatTime(0);

      const res = await gm.listDirectory(sessionNoProj, './');
      expect(res).to.be.an('object');
      expect((res as any).name).to.equal('INDEX_RESULT');
    });

    it('never scanned (lastScanned=null): with projection waits for save and returns DB result', async () => {
      // Simulate never scanned dir
      indexed.lastScanned = null;
      indexed.lastModified = 0;
      setStatTime(0);

      const res = await gm.listDirectory(sessionProj, './');
      expect(res).to.equal('DB_RESULT');
      expect(calledArgs[1]).to.equal(true);
    });
  });
  describe('GalleryManager authorisation', () => {

    let gm: GalleryManager;

    before(async () => {
      await sqlHelper.initDB();
      await sqlHelper.setUpTestGallery();
      await ObjectManagers.getInstance().init();
      gm = new GalleryManager();
    });

    after(async () => {
      await sqlHelper.clearDB();
    });


    describe('authoriseMedia', () => {
      it('returns true without projection', async () => {
        const session = new SessionContext();
        const root = sqlHelper.testGalleyEntities.dir;
        const media = sqlHelper.testGalleyEntities.p; // Photo1_*.jpg in root
        const mediaPath = path.join(root.path, root.name, media.name);

        const res = await gm.authoriseMedia(session, mediaPath);
        expect(res).to.equal(true);
      });

      it('enforces projection: allows only matching media name (like "Photo1")', async () => {
        const searchQuery = {
          type: SearchQueryTypes.file_name,
          value: 'photo1',
          matchType: TextSearchQueryMatchTypes.like,
        } as TextSearch;
        const session = await ObjectManagers.getInstance().SessionManager.buildContext({
          allowQuery: searchQuery,
          overrideAllowBlockList: true,
        } as any);

        const root = sqlHelper.testGalleyEntities.dir;
        const p1 = sqlHelper.testGalleyEntities.p; // Photo1_*.jpg
        const p2 = sqlHelper.testGalleyEntities.p2; // Photo2_*.jpg

        const p1Path = path.join(root.path, root.name, p1.name);
        const p2Path = path.join(root.path, root.name, p2.name);

        expect(await gm.authoriseMedia(session, p1Path)).to.equal(true);
        expect(await gm.authoriseMedia(session, p2Path)).to.equal(false);
      });

      it('returns false when file exists but under different directory (directory constraint)', async () => {
        const searchQuery = {
          type: SearchQueryTypes.file_name,
          value: 'photo1',
          matchType: TextSearchQueryMatchTypes.like,
        } as TextSearch;
        const session = await ObjectManagers.getInstance().SessionManager.buildContext({
          allowQuery: searchQuery,
          overrideAllowBlockList: true,
        } as any);

        const subDir = sqlHelper.testGalleyEntities.subDir; // The Phantom Menace
        const p1 = sqlHelper.testGalleyEntities.p; // lives in root
        const wrongPath = path.join(subDir.path, subDir.name, p1.name);

        expect(await gm.authoriseMedia(session, wrongPath)).to.equal(false);
      });

      it('returns false for non-existent file under projection', async () => {
        const searchQuery = {
          type: SearchQueryTypes.file_name,
          value: 'photo1',
          matchType: TextSearchQueryMatchTypes.like,
        } as TextSearch;
        const session = await ObjectManagers.getInstance().SessionManager.buildContext({
          allowQuery: searchQuery,
          overrideAllowBlockList: true,
        } as any);

        const root = sqlHelper.testGalleyEntities.dir;
        const nonExist = path.join(root.path, root.name, 'does_not_exist.jpg');
        expect(await gm.authoriseMedia(session, nonExist)).to.equal(false);
      });
    });

    describe('authoriseMetaFile', () => {
      it('returns true without projection', async () => {
        const session = new SessionContext();
        const root = sqlHelper.testGalleyEntities.dir;
        const metaPath = path.join(root.path, root.name, 'README.md');
        expect(await gm.authoriseMetaFile(session, metaPath)).to.equal(true);
      });

      it('allows directory that contains matching media (projection applied)', async () => {
        const searchQuery = {
          type: SearchQueryTypes.file_name,
          value: 'photo1',
          matchType: TextSearchQueryMatchTypes.like,
        } as TextSearch;
        const session = await ObjectManagers.getInstance().SessionManager.buildContext({
          allowQuery: searchQuery,
          overrideAllowBlockList: true,
        } as any);

        const root = sqlHelper.testGalleyEntities.dir; // root contains Photo1_*.jpg
        const metaPath = path.join(root.path, root.name, 'folder.gpx');
        expect(await gm.authoriseMetaFile(session, metaPath)).to.equal(true);
      });

      it('denies directory that has no matching media under projection', async () => {
        const searchQuery = {
          type: SearchQueryTypes.file_name,
          value: 'photo1',
          matchType: TextSearchQueryMatchTypes.like,
        } as TextSearch;
        const session = await ObjectManagers.getInstance().SessionManager.buildContext({
          allowQuery: searchQuery,
          overrideAllowBlockList: true,
        } as any);

        const subDir = sqlHelper.testGalleyEntities.subDir; // contains Photo3_*.jpg
        const metaPath = path.join(subDir.path, subDir.name, 'info.md');
        expect(await gm.authoriseMetaFile(session, metaPath)).to.equal(false);
      });
    });
  });

  describe('Cache optimization tests', () => {
    before(async () => {
      await sqlHelper.initDB();
      await sqlHelper.setUpTestGallery();
      await ObjectManagers.getInstance().init();
    });

    after(async () => {
      await sqlHelper.clearDB();
    });
    it('should not call setAndGetCacheForDirectory when gallery is fully indexed with valid caches', async () => {

      // make sure gallery is fully indexed and caches are valid
      await ObjectManagers.getInstance().GalleryManager.listDirectory(DBTestHelper.defaultSession, './');
      const fn =  ObjectManagers.getInstance().ProjectedCacheManager.setAndGetCacheForDirectory;
      ObjectManagers.getInstance().ProjectedCacheManager.setAndGetCacheForDirectory = async (...args) => {
        await fn(...args);
        throw new Error('Should not be called');
      }
      await ObjectManagers.getInstance().GalleryManager.listDirectory(DBTestHelper.defaultSession, './');
      ObjectManagers.getInstance().ProjectedCacheManager.setAndGetCacheForDirectory = fn;
    });
  });
});

