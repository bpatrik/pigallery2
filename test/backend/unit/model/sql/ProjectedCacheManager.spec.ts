import {mock} from 'node:test';
import {DBTestHelper} from '../../../DBTestHelper';
import {DataSource} from 'typeorm';
import {SQLConnection} from '../../../../../src/backend/model/database/SQLConnection';
import {ProjectedCacheManager} from '../../../../../src/backend/model/database/ProjectedCacheManager';
import {DirectoryEntity} from '../../../../../src/backend/model/database/enitites/DirectoryEntity';
import {ProjectedDirectoryCacheEntity} from '../../../../../src/backend/model/database/enitites/ProjectedDirectoryCacheEntity';
import {ProjectedPersonCacheEntity} from '../../../../../src/backend/model/database/enitites/person/ProjectedPersonCacheEntity';
import {ProjectedAlbumCacheEntity} from '../../../../../src/backend/model/database/enitites/album/ProjectedAlbumCacheEntity';
import {UserEntity} from '../../../../../src/backend/model/database/enitites/UserEntity';
import {UserRoles} from '../../../../../src/common/entities/UserDTO';
import {SessionManager} from '../../../../../src/backend/model/database/SessionManager';
import {DiskManager} from '../../../../../src/backend/model/fileaccess/DiskManager';
import {TestHelper} from '../../../../TestHelper';
import {DirectoryBaseDTO, ParentDirectoryDTO, SubDirectoryDTO} from '../../../../../src/common/entities/DirectoryDTO';
import {FaceRegion, PhotoDTO} from '../../../../../src/common/entities/PhotoDTO';
import {VideoDTO} from '../../../../../src/common/entities/VideoDTO';
import {Config} from '../../../../../src/common/config/private/Config';
import {ClientSortingConfig} from '../../../../../src/common/config/public/ClientConfig';
import {SortByTypes} from '../../../../../src/common/entities/SortingMethods';
import {DatePatternFrequency, DatePatternSearch, SearchQueryTypes, TextSearch} from '../../../../../src/common/entities/SearchQueryDTO';
import {ObjectManagers} from '../../../../../src/backend/model/ObjectManagers';
import {SessionContext} from '../../../../../src/backend/model/SessionContext';
import {MediaDTO} from '../../../../../src/common/entities/MediaDTO';
import {Utils} from '../../../../../src/common/Utils';
import {GalleryManager} from '../../../../../src/backend/model/database/GalleryManager';

const chai = require('chai');
const {expect} = chai;

declare let describe: any;
declare const before: any;
declare const after: any;
declare const it: any;
const tmpDescribe = describe;
describe = DBTestHelper.describe();
describe('ProjectedCacheManager', (sqlHelper: DBTestHelper) => {
  before(TestHelper.resetConfig);
  describe = tmpDescribe;
  let connection: DataSource;
  let pcm: ProjectedCacheManager;

  const setup = async () => {
    await sqlHelper.initDB();
    await sqlHelper.setUpTestGallery();
    connection = await SQLConnection.getConnection();
    pcm = new ProjectedCacheManager();
  };

  after(sqlHelper.clearDB);

  describe('ProjectedCacheManager.invalidateDirectoryCache', async () => {
    beforeEach(setup);

    it('invalidates the given directory and all of its parents, but not descendants', async () => {
      const repoDir = connection.getRepository(DirectoryEntity);
      const repoCache = connection.getRepository(ProjectedDirectoryCacheEntity);

      // Entities from helper
      const root = sqlHelper.testGalleyEntities.dir;            // ParentDirectoryDTO of root
      const child = sqlHelper.testGalleyEntities.subDir;        // direct child of root
      const child2 = sqlHelper.testGalleyEntities.subDir2;      // another child of root

      // For descendant, use a grandchild under child (if not present, we simulate by using child itself as descendant context-wise)
      // Our sample gallery only has one level of subdirs; to test descendant unaffected, we will use subDir2 as unrelated descendant (sibling),
      // and also ensure caches under child remain valid if targeting root's child.

      // Resolve DirectoryEntity records
      const rootEnt = await repoDir.findOne({where: {name: root.name, path: root.path}});
      const childEnt = await repoDir.findOne({where: {name: child.name, path: DiskManager.pathFromParent(root)}});
      const child2Ent = await repoDir.findOne({where: {name: child2.name, path: DiskManager.pathFromParent(root)}});
      expect(rootEnt).to.not.be.null;
      expect(childEnt).to.not.be.null;
      expect(child2Ent).to.not.be.null;

      const projectionKey1 = SessionManager.NO_PROJECTION_KEY;
      const projectionKey2 = 'OTHER_PROJECTION_KEY';

      // Seed cache rows with valid=true initially for both projection keys
      const seed = async (directory: DirectoryEntity, projectionKey: string) => {
        const row = new ProjectedDirectoryCacheEntity();
        row.directory = directory as any;
        row.projectionKey = projectionKey;
        row.mediaCount = 0;
        row.valid = true;
        return repoCache.save(row);
      };

      await repoCache.createQueryBuilder().delete().from(ProjectedDirectoryCacheEntity).execute();

      const rootCache1 = await seed(rootEnt!, projectionKey1);
      const rootCache2 = await seed(rootEnt!, projectionKey2);
      const childCache1 = await seed(childEnt!, projectionKey1);
      const childCache2 = await seed(childEnt!, projectionKey2);
      const child2Cache1 = await seed(child2Ent!, projectionKey1);
      const child2Cache2 = await seed(child2Ent!, projectionKey2);

      // Target: child directory => should invalidate child and its parents (root), but not sibling (child2)
      const target = {name: child.name, path: root.path} as any; // ParentDirectoryDTO minimal

      await (pcm as any).invalidateDirectoryCache(target);

      // Reload caches for both projection keys
      const rc1 = await repoCache.findOne({where: {id: rootCache1.id}});
      const rc2 = await repoCache.findOne({where: {id: rootCache2.id}});
      const cc1 = await repoCache.findOne({where: {id: childCache1.id}});
      const cc2 = await repoCache.findOne({where: {id: childCache2.id}});
      const c2c1 = await repoCache.findOne({where: {id: child2Cache1.id}});
      const c2c2 = await repoCache.findOne({where: {id: child2Cache2.id}});

      expect(rc1!.valid).to.equal(false, 'root (key1) should be invalidated');
      expect(rc2!.valid).to.equal(false, 'root (key2) should be invalidated');
      expect(cc1!.valid).to.equal(false, 'target child (key1) should be invalidated');
      expect(cc2!.valid).to.equal(false, 'target child (key2) should be invalidated');
      expect(c2c1!.valid).to.equal(true, 'sibling (key1) should not be invalidated');
      expect(c2c2!.valid).to.equal(true, 'sibling (key2) should not be invalidated');
    });
  });

  describe('ProjectedCacheManager.setAndGetCacheForDirectory', async () => {
    let dir: ParentDirectoryDTO;
    let subDir: SubDirectoryDTO;
    let subDir2: SubDirectoryDTO;
    let v: VideoDTO;
    let p: PhotoDTO;
    let p2: PhotoDTO;
    let pFaceLess: PhotoDTO;
    let p4: PhotoDTO;

    const buildDeterministicGallery = async () => {
      const directory: ParentDirectoryDTO = TestHelper.getDirectoryEntry(null, '.');
      subDir = TestHelper.getDirectoryEntry(directory, 'The Phantom Menace');
      subDir2 = TestHelper.getDirectoryEntry(directory, 'Return of the Jedi');
      p = TestHelper.getPhotoEntry1(subDir);
      p.metadata.rating = 4;
      p.metadata.creationDate = 10000;
      p2 = TestHelper.getPhotoEntry2(subDir);
      p2.metadata.rating = 4;
      p2.metadata.creationDate = 20000;
      v = TestHelper.getVideoEntry1(subDir);
      v.metadata.creationDate = 500;
      const pFaceLessTmp = TestHelper.getPhotoEntry3(subDir);
      pFaceLessTmp.metadata.rating = 0;
      pFaceLessTmp.metadata.creationDate = 400000;
      delete (pFaceLessTmp as any).metadata.faces;
      p4 = TestHelper.getPhotoEntry4(subDir2);
      p4.metadata.rating = 5;
      p4.metadata.creationDate = 100;

      dir = await DBTestHelper.persistTestDir(directory);

      subDir = dir.directories[0];
      subDir2 = dir.directories[1];
      p = (subDir.media!.filter(m => m.name === p.name)[0] as any);
      (p as any).directory = subDir;
      p2 = (subDir.media!.filter(m => m.name === p2.name)[0] as any);
      (p2 as any).directory = subDir;
      v = (subDir.media!.filter(m => m.name === v.name)[0] as any);
      (v as any).directory = subDir;
      pFaceLess = (subDir.media!.filter(m => m.name === pFaceLessTmp.name)[0] as any);
      (pFaceLess as any).directory = subDir;
      p4 = (subDir2.media![0] as any);
      (p4 as any).directory = subDir2;
    };

    beforeEach(async () => {
      await sqlHelper.initDB();
      await buildDeterministicGallery();
      connection = await SQLConnection.getConnection();
      pcm = new ProjectedCacheManager();
      // default sorting
      Config.AlbumCover.Sorting = [
        new ClientSortingConfig(SortByTypes.Rating, false),
        new ClientSortingConfig(SortByTypes.Date, false)
      ];
      Config.AlbumCover.SearchQuery = null as any;
      // match behavior of old CoverManager tests
      Config.Gallery.ignoreTimestampOffset = false;
    });

    const getCacheRow = async (d: { id: number }) => {
      return await connection.getRepository(ProjectedDirectoryCacheEntity)
        .createQueryBuilder('pdc')
        .leftJoin('pdc.cover', 'cover')
        .leftJoin('cover.directory', 'cd')
        .where('pdc.directoryId = :dir AND pdc.projectionKey = :pk', {dir: d.id, pk: SessionManager.NO_PROJECTION_KEY})
        .select(['pdc', 'cd.name', 'cd.path', 'cover.name'])
        .getOne();
    };

    const coverify = (mIn: MediaDTO) => {
      const tmpDir = mIn.directory as any;
      delete (mIn as {directory?: unknown}).directory;
      const m = Utils.clone(mIn);
      mIn.directory = tmpDir;
      m.directory = {
        name: mIn.directory.name,
        path: mIn.directory.path,
      } as DirectoryBaseDTO;
      delete (m as {metadata?: unknown}).metadata;
      delete (m as {id?: unknown}).id;
      return m;
    };

    it('should sort directory cover', async () => {
      // Rating desc, then Date desc -> expect p2 for subDir
      let saved = await pcm.setAndGetCacheForDirectory(connection, DBTestHelper.defaultSession as any, {
        id: subDir.id,
        name: subDir.name,
        path: subDir.path
      });
      let row = await getCacheRow(subDir);
      expect(row!.cover!).to.deep.equal(saved!.cover!);
      expect(row!.cover!).to.deep.equal(coverify(p2));
      expect(row!.mediaCount).to.equal(4);
      expect(row!.recursiveMediaCount).to.equal(4);

      // Date desc only -> expect pFaceLess (latest by date even with no faces)
      Config.AlbumCover.Sorting = [new ClientSortingConfig(SortByTypes.Date, false)];
      saved = await pcm.setAndGetCacheForDirectory(connection, DBTestHelper.defaultSession as any, {
        id: subDir.id,
        name: subDir.name,
        path: subDir.path
      });
      row = await getCacheRow(subDir);
      expect(row!.cover!).to.deep.equal(saved!.cover!);
      expect(row!.cover!).to.deep.equal(coverify(pFaceLess));

      // Rating desc only on root -> expect highest rated across subs => p4
      Config.AlbumCover.Sorting = [new ClientSortingConfig(SortByTypes.Rating, false)];
      saved = await pcm.setAndGetCacheForDirectory(connection, DBTestHelper.defaultSession as any, {
        id: dir.id,
        name: dir.name,
        path: dir.path
      });
      row = await getCacheRow(dir);
      expect(row!.cover!).to.deep.equal(saved!.cover!);
      expect(row!.cover!).to.deep.equal(coverify(p4));

      // Name asc on root -> expect first by name (video v)
      Config.AlbumCover.Sorting = [new ClientSortingConfig(SortByTypes.Name, false)];
      saved = await pcm.setAndGetCacheForDirectory(connection, DBTestHelper.defaultSession as any, {
        id: dir.id,
        name: dir.name,
        path: dir.path
      });
      row = await getCacheRow(dir);
      expect(row!.cover!).to.deep.equal(saved!.cover!);
      expect(row!.cover!).to.deep.equal(coverify(v));
      expect(row!.recursiveMediaCount).to.equal(5);
    });

    it('should get cover for directory with search filter', async () => {
      // Under subDir with search queries
      Config.AlbumCover.SearchQuery = {type: SearchQueryTypes.any_text, value: 'Boba'} as TextSearch;
      await pcm.setAndGetCacheForDirectory(connection, DBTestHelper.defaultSession as any, {
        id: subDir.id,
        name: subDir.name,
        path: subDir.path
      });
      let row = await getCacheRow(subDir);
      expect(row!.cover!).to.deep.equal(coverify(p));

      Config.AlbumCover.SearchQuery = {type: SearchQueryTypes.any_text, value: 'Derem'} as TextSearch;
      let saved = await pcm.setAndGetCacheForDirectory(connection, DBTestHelper.defaultSession as any, {
        id: subDir.id,
        name: subDir.name,
        path: subDir.path
      });
      row = await getCacheRow(subDir);
      expect(row!.cover!).to.deep.equal(saved!.cover!);
      expect(row!.cover!).to.deep.equal(coverify(p2));

      // Root cover should be selected from subDir by same query outcome
      saved = await pcm.setAndGetCacheForDirectory(connection, DBTestHelper.defaultSession as any, {
        id: dir.id,
        name: dir.name,
        path: dir.path
      });
      const rootRow = await getCacheRow(dir);
      expect(rootRow!.cover!).to.deep.equal(saved!.cover!);
      expect(rootRow!.cover!).to.deep.equal(coverify(p2));

      // SubDir2 should resolve to p4
      saved = await pcm.setAndGetCacheForDirectory(connection, DBTestHelper.defaultSession as any, {
        id: subDir2.id,
        name: subDir2.name,
        path: subDir2.path
      });
      const row2 = await getCacheRow(subDir2);
      expect(row2!.cover!).to.deep.equal(saved!.cover!);
      expect(row2!.cover!).to.deep.equal(coverify(p4));
      expect(row2!.mediaCount).to.equal(1);
      expect(row2!.recursiveMediaCount).to.equal(1);
    });
  });


  describe('recursiveMediaCount of the root', () => {
    before(async () => {
      await sqlHelper.initDB();
      await sqlHelper.setUpNestedTestGallery();
    });

    after(sqlHelper.clearDB);

    it('counts the media of all levels below the root', async () => {
      const conn = await SQLConnection.getConnection();
      const root = GalleryManager.parseRelativeDirPath('.');
      const rootDir = await conn.getRepository(DirectoryEntity).findOneBy({name: root.name, path: root.parent});
      const cache = await ObjectManagers.getInstance().ProjectedCacheManager
        .getCacheForDirectory(conn, DBTestHelper.defaultSession, rootDir!);
      // nested gallery: one photo in each of the 6 directories, 3 of them are deeper than the root's children
      expect(cache.mediaCount).to.equal(1);
      expect(cache.recursiveMediaCount).to.equal(6);
    });
  });

  describe('relative-date cache refresh and cleanup', () => {
    const setupRelativeGallery = async (day1: Date, day2: Date): Promise<void> => {
      const root = TestHelper.getDirectoryEntry(null, '.');
      const sub = TestHelper.getDirectoryEntry(root, 'sub');

      const p1 = TestHelper.getPhotoEntry(sub);
      p1.name = 'day1.jpg';
      p1.metadata.creationDate = day1.getTime();
      p1.metadata.creationDateOffset = '+00:00';
      p1.metadata.keywords = ['day-test'];
      p1.metadata.faces = [{
        name: 'Alice',
        box: {top: 0, left: 0, width: 10, height: 10}
      } as FaceRegion] as any[];

      const p2 = TestHelper.getPhotoEntry(sub);
      p2.name = 'day2.jpg';
      p2.metadata.creationDate = day2.getTime();
      p2.metadata.creationDateOffset = '+00:00';
      p2.metadata.keywords = ['day-test'];
      p2.metadata.faces = [{
        name: 'Bob',
        box: {top: 0, left: 0, width: 10, height: 10}
      } as FaceRegion] as any[];

      await DBTestHelper.persistTestDir(root);
    };

    afterEach(() => {
      mock.timers.reset();
    });

    after(sqlHelper.clearDB);

    it('refreshes folder, person, and album caches across days for relative-date projections and cleans up old keys', async () => {
      const day1 = new Date(2026, 5, 10, 12, 0, 0);
      const day2 = new Date(2026, 5, 11, 12, 0, 0);
      mock.timers.enable({apis: ['Date'], now: day1});

      await sqlHelper.initDB();
      await setupRelativeGallery(day1, day2);

      const om = ObjectManagers.getInstance();
      await om.AlbumManager.addSavedSearch('Day Test Album', {
        type: SearchQueryTypes.keyword,
        value: 'day-test'
      } as TextSearch);

      const conn = await SQLConnection.getConnection();
      const user = new UserEntity();
      user.name = 'rel-user';
      user.password = 'pw';
      user.role = UserRoles.User;
      user.overrideAllowBlockList = true;
      user.allowQuery = {
        type: SearchQueryTypes.date_pattern,
        daysLength: 1,
        frequency: DatePatternFrequency.days_ago,
        agoNumber: 0
      } as DatePatternSearch;
      const savedUser = await conn.getRepository(UserEntity).save(user);

      // Day 1: caches are populated with day1.jpg and Alice
      const session1 = await om.SessionManager.buildContext(Utils.clone(savedUser));
      const day1Key = session1.user.projectionKey;
      const root1 = await om.GalleryManager.listDirectory(session1, '.', undefined, undefined, {allowIndexing: false});
      expect(root1!.cache!.recursiveMediaCount).to.equal(1);
      expect(root1!.directories![0].cache!.mediaCount).to.equal(1);
      expect(root1!.directories![0].cache!.cover!.name).to.equal('day1.jpg');

      const persons1 = await om.PersonManager.getAll(session1);
      expect(persons1.map(p => p.name)).to.deep.equal(['Alice']);
      expect(persons1[0].cache.count).to.equal(1);
      expect(persons1[0].cache.sampleRegion!.media.name).to.equal('day1.jpg');

      const albums1 = await om.AlbumManager.getAll(session1);
      expect(albums1).to.have.lengthOf(1);
      expect(albums1[0].cache.itemCount).to.equal(1);
      expect(albums1[0].cache.cover.name).to.equal('day1.jpg');

      // Day 2: key rotates, Day 1 cache rows are cleaned up, and caches reflect day2.jpg and Bob
      mock.timers.setTime(day2.getTime());

      const session2 = await om.SessionManager.buildContext(Utils.clone(savedUser));
      expect(session2.user.projectionKey).to.not.equal(day1Key);

      expect(await conn.getRepository(ProjectedDirectoryCacheEntity).count({where: {projectionKey: day1Key}})).to.equal(0);
      expect(await conn.getRepository(ProjectedPersonCacheEntity).count({where: {projectionKey: day1Key}})).to.equal(0);
      expect(await conn.getRepository(ProjectedAlbumCacheEntity).count({where: {projectionKey: day1Key}})).to.equal(0);

      const root2 = await om.GalleryManager.listDirectory(session2, '.', undefined, undefined, {allowIndexing: false});
      expect(root2!.cache!.recursiveMediaCount).to.equal(1);
      expect(root2!.directories![0].cache!.mediaCount).to.equal(1);
      expect(root2!.directories![0].cache!.cover!.name).to.equal('day2.jpg');

      const persons2 = await om.PersonManager.getAll(session2);
      expect(persons2.map(p => p.name)).to.deep.equal(['Bob']);
      expect(persons2[0].cache.count).to.equal(1);
      expect(persons2[0].cache.sampleRegion!.media.name).to.equal('day2.jpg');

      const albums2 = await om.AlbumManager.getAll(session2);
      expect(albums2).to.have.lengthOf(1);
      expect(albums2[0].cache.itemCount).to.equal(1);
      expect(albums2[0].cache.cover.name).to.equal('day2.jpg');
    });

    it('invalidates saved-search album caches across days when the album query has a relative date', async () => {
      const day1 = new Date(2026, 5, 10, 12, 0, 0);
      const day2 = new Date(2026, 5, 11, 12, 0, 0);
      mock.timers.enable({apis: ['Date'], now: day1});

      await sqlHelper.initDB();
      await setupRelativeGallery(day1, day2);

      const om = ObjectManagers.getInstance();
      await om.AlbumManager.addSavedSearch('Today Album', {
        type: SearchQueryTypes.date_pattern,
        daysLength: 1,
        frequency: DatePatternFrequency.days_ago,
        agoNumber: 0
      } as DatePatternSearch);

      // every request builds its context, which runs the day-change cleanup
      const adminSession = (): Promise<SessionContext> =>
        om.SessionManager.buildContext({name: 'admin', role: UserRoles.Admin} as UserEntity);

      const albums1 = await om.AlbumManager.getAll(await adminSession());
      expect(albums1).to.have.lengthOf(1);
      expect(albums1[0].cache.itemCount).to.equal(1);
      expect(albums1[0].cache.cover.name).to.equal('day1.jpg');

      mock.timers.setTime(day2.getTime());

      const albums2 = await om.AlbumManager.getAll(await adminSession());
      expect(albums2).to.have.lengthOf(1);
      expect(albums2[0].cache.itemCount).to.equal(1);
      expect(albums2[0].cache.cover.name).to.equal('day2.jpg');
    });
  });
});

